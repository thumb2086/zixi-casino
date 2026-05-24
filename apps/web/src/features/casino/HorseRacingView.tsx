import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './HorseRacing.css';
import './CasinoCommon.css';
import { BetQuickActions } from './BetQuickActions';

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
  const [bettedHorseId, setBettedHorseId] = useState<number | null>(null);
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
          setBettedHorseId(null);
          setWinner(null);
          setIsRacing(false);
          setProgress({});
          setStatusMsg('請選擇馬匹並下注。');
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
    if (!session || roundId === null || horses.length === 0 || bettedHorseId !== null) return;

    setBettedHorseId(selectedHorseId);
    setStatusMsg(`🐎 已下注 ${horses.find(h => h.id === selectedHorseId)?.name ?? ''}，等待開獎...`);
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

  useEffect(() => {
    if (bettedHorseId === null || isRacing || horses.length === 0 || roundId === null) return;
    if (!roundClosed && (countdown === null || countdown > 0)) return;

    const localWinner = pickWinner(horses, roundId);
    setWinner(localWinner);
    setIsRacing(true);
    setProgress(Object.fromEntries(horses.map((h) => [h.id, 0])));
  }, [bettedHorseId, roundClosed, countdown, isRacing, horses, roundId]);

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
    const isWin = winner.id === (bettedHorseId ?? selectedHorseId);
    const payout = isWin ? Number(betAmount) * winner.multiplier : 0;
    setStatusMsg(`🐎 ${winner.name} 獲勝！${isWin ? ` 🎉 贏得 ${payout} ZXC` : ' 😢 下次好運！'}`);
    setStatusColor(isWin ? '#00ff88' : '#ff4d4d');
  }, [winner, isRacing]);

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

      <div className="horse-choices">
        {horses.map((horse) => {
          const color = HORSE_COLORS[horse.id] ?? '#fff';
          const pct = Math.round(horse.weight / 104 * 100);
          const disabled = bettedHorseId !== null || isRacing;
          return (
            <button
              key={horse.id}
              type="button"
              className={`horse-choice ${selectedHorseId === horse.id ? 'active' : ''} ${bettedHorseId === horse.id ? 'betted' : ''}`}
              style={selectedHorseId === horse.id ? { borderColor: color, background: `${color}22` } : {}}
              onClick={() => !disabled && setSelectedHorseId(horse.id)}
              disabled={disabled}
            >
              <span className="horse-choice-emoji">🐎</span>
              <span className="horse-choice-name">{horse.name}</span>
              <span className="horse-choice-mult" style={{ color }}>{horse.multiplier}x</span>
              <span className="horse-choice-odds">{pct}%</span>
              {bettedHorseId === horse.id && <span className="betted-badge">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="race-track">
        <div className="race-hud">
          <div className="start-lights">
            {isRacing ? (
              <><span className="light green" /><span className="light green" /><span className="light green" /></>
            ) : bettedHorseId !== null ? (
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

      <div className="betting-controls">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          disabled={bettedHorseId !== null || isRacing}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} maxBet={maxBet} />
        <button className="btn-bet" onClick={handleBet} disabled={roundId === null || bettedHorseId !== null || isRacing || roundClosed}>
          {bettedHorseId !== null ? '已下注' : isRacing ? '比賽中...' : '立即下注'}
        </button>
      </div>

      {history && history.length > 0 && (
        <div className="horse-history">
          <h3>最近賽果</h3>
          <div className="history-scroll">
            {history.slice(0, 15).map((h: any, i: number) => {
              const meta = h.gameResult?.meta ?? h.meta ?? {};
              const winnerId = meta.winnerId;
              const wColor = HORSE_COLORS[winnerId as number] ?? '#888';
              const wName = meta.winnerName ?? `#${winnerId}`;
              return (
                <span key={i} className="history-chip" style={{ borderColor: wColor }}>
                  🐎 {wName}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
