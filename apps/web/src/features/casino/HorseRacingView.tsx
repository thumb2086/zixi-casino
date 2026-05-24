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

const HORSE_THEMES: Record<number, { emoji: string; color: string }> = {
  1: { emoji: '🔥', color: '#ff4444' },
  2: { emoji: '⚡', color: '#ffdd00' },
  3: { emoji: '👻', color: '#bb66ff' },
  4: { emoji: '🗡️', color: '#aaaaaa' },
  5: { emoji: '❄️', color: '#66ddff' },
  6: { emoji: '⭐', color: '#ffcc00' },
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
  const raceTimerRef = useRef<number | null>(null);

  const { data: horseData } = useQuery({
    queryKey: ['horse-info'],
    queryFn: async () => {
      const res = await api.get('/api/v1/games/horse/horses');
      return res.data?.data as Horse[] | undefined;
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

  const [roundId, setRoundId] = useState<number | null>(null);

  const fetchRound = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/games/horse/round');
      const data = res.data?.data?.data ?? res.data?.data;
      if (data?.roundId !== undefined) {
        setRoundId(data.roundId);
        if (data.bettingClosesAt) {
          const msLeft = Math.max(0, data.bettingClosesAt - Date.now());
          setCountdown(Math.ceil(msLeft / 1000));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchRound();
    const interval = setInterval(fetchRound, 10000);
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
    if (!session || roundId === null || horses.length === 0) return;

    const localWinner = pickWinner(horses, roundId);

    setWinner(localWinner);
    setIsRacing(true);
    setProgress(Object.fromEntries(horses.map((h) => [h.id, 0])));

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
    if (!winner || isRacing) return;
    const theme = HORSE_THEMES[winner.id] ?? { emoji: '🐎', color: '#fff' };
    const isWin = winner.id === selectedHorseId;
    const payout = isWin ? Number(betAmount) * winner.multiplier : 0;
    setStatusMsg(`${theme.emoji} ${winner.name} 獲勝！${isWin ? ` 🎉 贏得 ${payout} ZXC` : ' 😢 下次好運！'}`);
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
            <span className="countdown-badge closed">🔒 封盤</span>
          )}
        </div>
      </div>

      <div className="horse-choices">
        {horses.map((horse) => {
          const theme = HORSE_THEMES[horse.id] ?? { emoji: '🐎', color: '#fff' };
          return (
            <button
              key={horse.id}
              type="button"
              className={`horse-choice ${selectedHorseId === horse.id ? 'active' : ''}`}
              style={selectedHorseId === horse.id ? { borderColor: theme.color, background: `${theme.color}22` } : {}}
              onClick={() => setSelectedHorseId(horse.id)}
            >
              <span className="horse-choice-emoji">{theme.emoji}</span>
              <span className="horse-choice-name">{horse.name}</span>
              <span className="horse-choice-mult" style={{ color: theme.color }}>{horse.multiplier}x</span>
            </button>
          );
        })}
      </div>

      <div className="race-track">
        <div className="race-hud">
          <div className="start-lights">
            {isRacing ? (
              <>
                <span className="light green" />
                <span className="light green" />
                <span className="light green" />
              </>
            ) : (
              <>
                <span className="light red" />
                <span className="light red" />
                <span className="light red" />
              </>
            )}
          </div>
          <div className="pace-meter">
            <div className="pace-fill" style={{ width: `${Math.max(...Object.values(progress), 0)}%` }} />
          </div>
        </div>
        {horses.map((horse) => {
          const theme = HORSE_THEMES[horse.id] ?? { emoji: '🐎', color: '#fff' };
          const pct = progress[horse.id] ?? 0;
          return (
            <div key={horse.id} className="lane">
              <span className="lane-name" style={{ color: theme.color }}>{theme.emoji}</span>
              <div
                className={`horse-runner ${isRacing ? 'running' : ''} ${winner?.id === horse.id && !isRacing ? 'winner' : ''}`}
                style={{ left: `${Math.min(90, pct)}%`, '--horse-color': theme.color } as React.CSSProperties}
              >
                <span className="horse-icon">{theme.emoji}</span>
              </div>
              <div className="lane-line" style={{ borderColor: `${theme.color}33` }} />
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
          disabled={isRacing}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} maxBet={maxBet} />
        <button className="btn-bet" onClick={handleBet} disabled={roundId === null || isRacing}>
          {isRacing ? '比賽中...' : '立即下注'}
        </button>
      </div>
    </div>
  );
};
