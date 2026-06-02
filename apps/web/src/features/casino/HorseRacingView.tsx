import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './HorseRacing.css';
import './CasinoCommon.css';
import { BetQuickActions } from './BetQuickActions';
import { formatNumber } from '@repo/shared';
import { useTranslation } from 'react-i18next';

interface Horse {
  id: number; name: string; multiplier: number; weight: number;
}

const HORSE_COLORS: Record<number, string> = {
  1: '#ff4444',
  2: '#ffdd00',
  3: '#bb66ff',
  4: '#aaaaaa',
  5: '#66ddff',
  6: '#ffcc00',
};

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pickWinner(horses: Horse[], roundId: number): Horse {
  const totalWeight = horses.reduce((s, h) => s + h.weight, 0);
  let cursor = fnv1a32(`horse:${roundId}`) % totalWeight;
  for (const h of horses) {
    cursor -= h.weight;
    if (cursor < 0) return h;
  }
  return horses[horses.length - 1];
}

const STORAGE_KEY = 'horse_race_results';

function loadLocalResults(): Array<{ roundId: number; winnerId: number; winnerName: string }> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveLocalResult(result: { roundId: number; winnerId: number; winnerName: string }) {
  const all = loadLocalResults();
  if (!all.some((r) => r.roundId === result.roundId)) {
    all.push(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(-500))); // keep last 500
  }
}

export const HorseRacingView: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [betAmount, setBetAmount] = useState('10');
  const [selectedHorseId, setSelectedHorseId] = useState(1);
  const [statusMsg, setStatusMsg] = useState(t('casino_game.horse_bet_prompt'));
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [isRacing, setIsRacing] = useState(false);
  const [winner, setWinner] = useState<Horse | null>(null);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [betRecords, setBetRecords] = useState<Array<{ horseId: number; amount: number }>>([]);
  const [raceBetRecords, setRaceBetRecords] = useState<Array<{ horseId: number; amount: number }>>([]);
  const raceTimerRef = useRef<number | null>(null);

  const { data: horseData } = useQuery({
    queryKey: ['horse-info'],
    queryFn: async () => {
      const res = await api.get('/api/v1/games/horse/horses');
      const d = res.data?.data;
      return (Array.isArray(d) ? d : (d as any)?.data) as Horse[] | undefined;
    },
    staleTime: 300000,
  });
  const horses = horseData ?? [];

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as { maxBet?: number } | undefined;
    },
    staleTime: 60000,
  });
  const maxBet = profile?.maxBet ?? 1_000_000;

  const { data: history } = useQuery({
    queryKey: ['horse-history', session?.id],
    queryFn: async () => {
      if (!session?.id) return [];
      const res = await api.get('/api/v1/games/horse/history', { params: { sessionId: session.id } });
      const d = res.data?.data;
      return (Array.isArray(d) ? d : (d as any)?.data ?? []) as any[];
    },
    staleTime: 10000,
    enabled: !!session?.id,
  });

  const [roundId, setRoundId] = useState<number | null>(null);
  const [roundClosed, setRoundClosed] = useState(false);

  const fetchRound = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/games/horse/round');
      const data = res.data?.data?.data ?? res.data?.data;
      if (data?.roundId !== undefined) {
        if (data.roundId !== roundId) {
          setRoundId(data.roundId);
          setIsRacing(false);
          setProgress({});
          setWinner(null);
          setRaceBetRecords([]);
          setStatusMsg(t('casino_game.horse_bet_prompt'));
          setStatusColor('#ffd36a');
        }
        setRoundClosed(!data.isBettingOpen);
        if (data.bettingClosesAt) {
          const msLeft = Math.max(0, data.bettingClosesAt - Date.now());
          setCountdown(data.isBettingOpen ? Math.ceil(msLeft / 1000) : 0);
        }
      }
    } catch {}
  }, [roundId]);

  useEffect(() => {
    fetchRound();
    const interval = setInterval(fetchRound, 3000);
    return () => clearInterval(interval);
  }, [fetchRound]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const cd = window.setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(cd);
  }, [countdown]);

  const handleBet = () => {
    if (!session || roundId === null || horses.length === 0 || roundClosed) return;

    const amount = Number(betAmount);
    if (amount > maxBet) {
      setStatusMsg(t('casino_game.horse_max_bet', { max: formatNumber(maxBet) }));
      setStatusColor('#ff8800');
      return;
    }
    setBetRecords((prev) => [...prev, { horseId: selectedHorseId, amount }]);
    const total = betRecords.reduce((s, r) => s + r.amount, 0) + amount;
    setStatusMsg(t('casino_game.horse_bet_summary', { count: betRecords.length + 1, total: formatNumber(total) }));
    setStatusColor('#ffd36a');

    api.post('/api/v1/games/horse/play', {
      sessionId: session.id,
      betAmount: Number(betAmount),
      horseId: selectedHorseId,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    }).catch(() => {});
  };

  // Start race when round closes (with or without bets)
  useEffect(() => {
    if (isRacing || horses.length === 0 || roundId === null) return;
    const shouldStart = roundClosed || (countdown !== null && countdown <= 0);
    if (!shouldStart) return;

    const localWinner = pickWinner(horses, roundId);
    setWinner(localWinner);
    if (betRecords.length > 0) {
      setRaceBetRecords(betRecords);
      setBetRecords([]);
    }
    setIsRacing(true);
    setProgress(Object.fromEntries(horses.map((h) => [h.id, 0])));
  }, [roundClosed, countdown, isRacing, horses, roundId]);

  useEffect(() => {
    if (!isRacing || horses.length === 0) return;

    raceTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next: Record<number, number> = {};
        let allFinished = true;
        for (const h of horses) {
          const speed = winner?.id === h.id ? 1.8 : 0.6 + Math.random() * 0.7;
          const value = Math.min(100, (prev[h.id] ?? 0) + speed);
          next[h.id] = value;
          if (value < 100) allFinished = false;
        }
        if (allFinished && raceTimerRef.current) {
          window.clearInterval(raceTimerRef.current);
          raceTimerRef.current = null;
        }
        return next;
      });
    }, 80);

    return () => {
      if (raceTimerRef.current) {
        window.clearInterval(raceTimerRef.current);
        raceTimerRef.current = null;
      }
    };
  }, [isRacing, winner, horses]);

  useEffect(() => {
    if (!isRacing && raceTimerRef.current) {
      window.clearInterval(raceTimerRef.current);
      raceTimerRef.current = null;
    }
  }, [isRacing]);

  useEffect(() => {
    if (!isRacing || horses.length === 0) return;
    const allDone = horses.every((h) => (progress[h.id] ?? 0) >= 100);
    if (allDone && !raceTimerRef.current) {
      setIsRacing(false);
    }
  }, [progress, isRacing, horses]);

  useEffect(() => {
    if (!winner || isRacing) return;
    // Persist race result to localStorage (for long-term stats)
    if (roundId !== null) {
      saveLocalResult({ roundId, winnerId: winner.id, winnerName: winner.name });
    }
    const records = raceBetRecords.length > 0 ? raceBetRecords : betRecords;
    const totalBet = records.reduce((s, r) => s + r.amount, 0);
    const winRecords = records.filter((r) => r.horseId === winner.id);
    const totalPayout = winRecords.reduce((s, r) => s + r.amount * winner.multiplier, 0);
    if (winRecords.length === 0) {
      setStatusMsg(t('casino_game.horse_lose_result', { winner: winner.name, records: records.length, totalBet: formatNumber(totalBet) }));
      setStatusColor('#ff4d4d');
    } else {
      setStatusMsg(t('casino_game.horse_win_result', { winner: winner.name, payout: formatNumber(totalPayout), winRecords: winRecords.length, totalBet: formatNumber(totalBet) }));
      setStatusColor('#00ff88');
    }
  }, [winner, isRacing, raceBetRecords]);

  return (
    <div className="horse-racing-container">
      <div className="horse-header">
        <h2>{t('casino_game.horse_racing_icon')}</h2>
        <div className="horse-round-info">
          <span className="round-badge">{t('casino_game.horse_round', { round: roundId ?? '...' })}</span>
          {countdown !== null && countdown > 0 && (
            <span className="countdown-badge">⏱ {countdown}s</span>
          )}
          {countdown !== null && countdown <= 0 && (
            <span className="countdown-badge closed">{t('casino_game.horse_draw_label')}</span>
          )}
        </div>
      </div>

      <div className="race-track">
        <div className="race-hud">
          <div className="start-lights">
            {isRacing ? (
              <><span className="light green" /><span className="light green" /><span className="light green" /></>
            ) : betRecords.length > 0 ? (
              <><span className="light red" /><span className="light red" /><span className="light red" /></>
            ) : (
              <><span className="light" /><span className="light" /><span className="light" /></>
            )}
          </div>
          <div className="pace-meter">
            <div className="pace-fill" style={{ width: `${Math.max(...Object.values(progress), 0)}%` }} />
          </div>
        </div>
        {horses.map((horse) => {
          const color = HORSE_COLORS[horse.id] ?? '#fff';
          const pct = progress[horse.id] ?? 0;
          return (
            <div key={horse.id} className="lane">
              <span className="lane-tag" style={{ color }}>#{horse.id}</span>
              <div
                className={`horse-runner ${isRacing ? 'running' : ''} ${winner?.id === horse.id && !isRacing ? 'winner' : ''}`}
                style={{ left: `${Math.min(90, pct)}%`, '--horse-color': color } as React.CSSProperties}
              >
                <span className="horse-icon">🐎</span>
              </div>
              <div className="lane-line" style={{ borderColor: `${color}22` }} />
            </div>
          );
        })}
        <div className="finish-line" />
        <div className="status-panel" style={{ color: statusColor }}>
          {statusMsg}
        </div>
      </div>

      <div className="horse-choices">
        {horses.map((horse) => {
          const color = HORSE_COLORS[horse.id] ?? '#fff';
          const pct = Math.round(horse.weight / 104 * 100);
          const isBetted = betRecords.some((r) => r.horseId === horse.id);
          const disabled = isRacing || roundClosed;
          return (
            <button
              key={horse.id}
              type="button"
              className={`horse-choice ${selectedHorseId === horse.id ? 'active' : ''} ${isBetted ? 'betted' : ''}`}
              style={selectedHorseId === horse.id ? { borderColor: color, background: `${color}22` } : {}}
              onClick={() => !disabled && setSelectedHorseId(horse.id)}
              disabled={disabled}
            >
              <span className="horse-choice-emoji">🐎</span>
              <span className="horse-choice-name">{horse.name}</span>
              <span className="horse-choice-stats">
                <span className="horse-choice-mult" style={{ color }}>{horse.multiplier}x</span>
                <span className="horse-choice-odds">{t('casino_game.horse_win_rate', { rate: pct })}</span>
              </span>
              {isBetted && <span className="betted-badge">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="betting-controls">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          disabled={isRacing || roundClosed}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} maxBet={maxBet} />
        <button className="btn-bet" onClick={handleBet} disabled={roundId === null || isRacing || roundClosed}>
          {isRacing ? t('casino_game.horse_racing_label') : roundClosed ? t('casino_game.horse_wait_label') : betRecords.length > 0 ? t('casino_game.horse_add_bet', { count: betRecords.length }) : t('casino_game.horse_bet_now')}
        </button>
      </div>

      {(() => {
        // Merge API history + localStorage results, deduplicate by roundId
        const local = loadLocalResults();
        const allRaces = [...(history || []), ...local];
        const seenRounds = new Set<number>();
        const uniqueRaces = allRaces.filter((r: any) => {
          const roundId = r.roundId ?? (r.meta ?? r.gameResult?.meta ?? {}).roundId;
          if (seenRounds.has(roundId)) return false;
          seenRounds.add(roundId);
          return true;
        });
        if (uniqueRaces.length === 0) return null;
        const total = uniqueRaces.length;
        const maxWins = Math.max(1, ...horses.map((h) => uniqueRaces.filter((r: any) => {
          const winnerId = r.winnerId ?? (r.meta ?? r.gameResult?.meta ?? {}).winnerId;
          return winnerId === h.id;
        }).length));
        const seen2 = new Set<number>();
        const recentChips = allRaces.filter((r: any) => {
          const roundId = r.roundId ?? (r.meta ?? r.gameResult?.meta ?? {}).roundId;
          if (seen2.has(roundId)) return false;
          seen2.add(roundId);
          return true;
        }).slice(0, 20);
        return (
        <div className="horse-history">
          <h3>{t('casino_game.horse_win_stats')}</h3>
          <div className="stats-chart">{horses.map((horse) => {
            const wins = uniqueRaces.filter((r: any) => {
              const winnerId = r.winnerId ?? (r.meta ?? r.gameResult?.meta ?? {}).winnerId;
              return winnerId === horse.id;
            }).length;
            const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
            const barWidth = Math.max(4, (wins / maxWins) * 100);
            const color = HORSE_COLORS[horse.id] ?? '#888';
            return (
              <div key={horse.id} className="stat-row">
                <span className="stat-name" style={{ color }}>🐎 {horse.name}</span>
                <div className="stat-bar-track">
                  <div className="stat-bar-fill" style={{ width: `${barWidth}%`, background: color }} />
                </div>
                <span className="stat-nums">{t('casino_game.horse_wins_count', { wins, pct })}</span>
              </div>
            );
          })}</div>
          <h3 className="mt-3">{t('casino_game.horse_recent_results')}</h3>
          <div className="history-scroll">{recentChips.map((h: any, i: number) => {
            const winnerId = h.winnerId ?? (h.meta ?? h.gameResult?.meta ?? {}).winnerId;
            const wColor = HORSE_COLORS[winnerId as number] ?? '#888';
            const wName = h.winnerName ?? (h.meta ?? h.gameResult?.meta ?? {}).winnerName ?? `#${winnerId}`;
            return <span key={i} className="history-chip" style={{ borderColor: wColor, background: `${wColor}15` }}>{wName}</span>;
          })}</div>
        </div>);
      })()}
    </div>
  );
};
