import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './HorseRacing.css';
import './CasinoCommon.css';
import { BetQuickActions } from './BetQuickActions';
import { formatNumber } from '@repo/shared';

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

export const HorseRacingView: React.FC = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [betAmount, setBetAmount] = useState('10');
  const [selectedHorseId, setSelectedHorseId] = useState(1);
  const [statusMsg, setStatusMsg] = useState('請選擇馬匹並下注。');
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [isRacing, setIsRacing] = useState(false);
  const [winner, setWinner] = useState<Horse | null>(null);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [betRecords, setBetRecords] = useState<Array<{ horseId: number; amount: number }>>([]);
  const [raceBetRecords, setRaceBetRecords] = useState<Array<{ horseId: number; amount: number }>>([]);
  const raceTimerRef = useRef<number | null>(null);
  const winnerRef = useRef(winner);
  winnerRef.current = winner;

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
          if (!winnerRef.current) {
            setWinner(null);
            setRaceBetRecords([]);
            setStatusMsg('請選擇馬匹並下注。');
            setStatusColor('#ffd36a');
          }
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
      setStatusMsg(`⚠️ 單注上限 ${formatNumber(maxBet)} ZXC`);
      setStatusColor('#ff8800');
      return;
    }
    setBetRecords((prev) => [...prev, { horseId: selectedHorseId, amount }]);
    const total = betRecords.reduce((s, r) => s + r.amount, 0) + amount;
    setStatusMsg(`🐎 已下注 ${betRecords.length + 1} 筆，共 ${formatNumber(total)} ZXC`);
    setStatusColor('#ffd36a');

    api.post('/api/v1/games/horse/play', {
      sessionId: session.id,
      betAmount: Number(betAmount),
      horseId: selectedHorseId,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    }).catch((err: any) => {
      console.error('[horse] bet failed:', err);
    });
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
    const records = raceBetRecords.length > 0 ? raceBetRecords : betRecords;
    const totalBet = records.reduce((s, r) => s + r.amount, 0);
    const winRecords = records.filter((r) => r.horseId === winner.id);
    const totalPayout = winRecords.reduce((s, r) => s + r.amount * winner.multiplier, 0);
    if (winRecords.length === 0) {
      setStatusMsg(`🐎 ${winner.name} 獲勝！😢 未中獎（共下 ${records.length} 注 ${formatNumber(totalBet)} ZXC）`);
      setStatusColor('#ff4d4d');
    } else {
      setStatusMsg(`🐎 ${winner.name} 獲勝！🎉 贏得 ${formatNumber(totalPayout)} ZXC（${winRecords.length} 注中獎，下 ${formatNumber(totalBet)} ZXC）`);
      setStatusColor('#00ff88');
    }
  }, [winner, isRacing, raceBetRecords]);

  return (
    <div className="horse-racing-container">
      <div className="horse-header">
        <h2>🏇 賽馬</h2>
        <div className="horse-round-info">
          <span className="round-badge">第 {roundId ?? '...'} 局</span>
          {countdown !== null && countdown > 0 && (
            <span className="countdown-badge">⏱ {countdown}s</span>
          )}
          {countdown !== null && countdown <= 0 && (
            <span className="countdown-badge closed">🔒 開獎中</span>
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
                <span className="horse-choice-odds">勝率 {pct}%</span>
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
          {isRacing ? '比賽中...' : roundClosed ? '等待開獎' : betRecords.length > 0 ? `加注 (${betRecords.length})` : '立即下注'}
        </button>
      </div>

      {history && history.length > 0 && (
        <div className="horse-history">
          <h3>🏆 勝率統計</h3>
          <div className="stats-chart">
            {horses.map((horse) => {
              const wins = history.filter((h: any) => {
                const m = h.meta ?? h.gameResult?.meta ?? {};
                return m.winnerId === horse.id;
              }).length;
              const total = history.length;
              const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
              const maxWins = Math.max(1, ...horses.map((h) => history.filter((x: any) => {
                const m = x.meta ?? x.gameResult?.meta ?? {};
                return m.winnerId === h.id;
              }).length));
              const barWidth = Math.max(4, (wins / maxWins) * 100);
              const color = HORSE_COLORS[horse.id] ?? '#888';
              return (
                <div key={horse.id} className="stat-row">
                  <span className="stat-name" style={{ color }}>🐎 {horse.name}</span>
                  <div className="stat-bar-track">
                    <div className="stat-bar-fill" style={{ width: `${barWidth}%`, background: color }} />
                  </div>
                  <span className="stat-nums">{wins} 勝 ({pct}%)</span>
                </div>
              );
            })}
          </div>
          <h3 className="mt-3">📋 最近賽果</h3>
          <div className="history-scroll">
            {history.slice(0, 20).map((h: any, i: number) => {
              const meta = h.meta ?? h.gameResult?.meta ?? {};
              const winnerId = meta.winnerId;
              const wColor = HORSE_COLORS[winnerId as number] ?? '#888';
              const wName = meta.winnerName ?? `#${winnerId}`;
              return (
                <span key={i} className="history-chip" style={{ borderColor: wColor, background: `${wColor}15` }}>
                  {wName}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
