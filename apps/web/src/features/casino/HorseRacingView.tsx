import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './HorseRacing.css';
import './CasinoCommon.css';
import { BetQuickActions } from './BetQuickActions';

const HORSES = [
  { id: 1, name: '赤焰', multiplier: 3.6 },
  { id: 2, name: '雷霆', multiplier: 4.4 },
  { id: 3, name: '幻影', multiplier: 5.8 },
  { id: 4, name: '夜刃', multiplier: 8.0 },
  { id: 5, name: '霜牙', multiplier: 11.6 },
  { id: 6, name: '流星', multiplier: 17.0 },
];

// Same FNV-1a hash as server (auto-round.ts)
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hashInt(seed: string): number {
  return fnv1a32(String(seed));
}

function pickWinner(roundId: number): typeof HORSES[0] {
  const weighted = HORSES.map(h => ({ ...h, weight: 1 / h.multiplier }));
  const totalWeight = weighted.reduce((s, h) => s + h.weight, 0);
  let cursor = hashInt(`horse:${roundId}`) % Math.ceil(totalWeight);
  for (const h of weighted) {
    cursor -= h.weight;
    if (cursor < 0) return h;
  }
  return HORSES[HORSES.length - 1];
}

export const HorseRacingView: React.FC = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as { maxBet?: number } | undefined;
    },
    staleTime: 60000,
  });
  const maxBet = profile?.maxBet ?? 1_000_000;
  const [selectedHorseId, setSelectedHorseId] = useState(1);
  const [betAmount, setBetAmount] = useState('10');
  const [statusMsg, setStatusMsg] = useState('請選擇馬匹並下注。');
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [isRacing, setIsRacing] = useState(false);
  const [winner, setWinner] = useState<typeof HORSES[0] | null>(null);
  const [progress, setProgress] = useState<Record<number, number>>(() =>
    HORSES.reduce((acc, horse) => ({ ...acc, [horse.id]: 0 }), {})
  );

  // Sync round info from server
  const [roundId, setRoundId] = useState<number | null>(null);

  const fetchRound = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/games/horse/round");
      const data = res.data?.data?.data ?? res.data?.data;
      if (data?.roundId !== undefined) {
        setRoundId(data.roundId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchRound();
    const interval = setInterval(fetchRound, 10000);
    return () => clearInterval(interval);
  }, [fetchRound]);

  const handleBet = () => {
    if (!session || roundId === null) return;

    // Compute winner LOCALLY — instant result
    const localWinner = pickWinner(roundId);
    const isWin = localWinner.id === selectedHorseId;
    const payout = isWin ? Number(betAmount) * localWinner.multiplier : 0;

    setWinner(localWinner);
    setIsRacing(true);
    setStatusMsg(`🏇 ${localWinner.name} 獲勝！${isWin ? `🎉 贏得 ${payout} ZXC` : '😢 下次好運！'}`);
    setStatusColor(isWin ? '#00ff88' : '#ff4d4d');

    // Start race animation
    setProgress(HORSES.reduce((acc, horse) => ({ ...acc, [horse.id]: 0 }), {}));

    // Fire settlement API in background (no queue)
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

  // Race animation
  useEffect(() => {
    if (!isRacing) return;

    const raceTimer = window.setInterval(() => {
      setProgress((prev) => {
        let allFinished = true;
        const next: Record<number, number> = {};
        for (const horse of HORSES) {
          const speed = winner?.id === horse.id ? 1.6 : 0.75 + Math.random() * 0.5;
          const value = Math.min(100, (prev[horse.id] ?? 0) + speed);
          next[horse.id] = value;
          if (value < 100) allFinished = false;
        }
        if (allFinished) window.clearInterval(raceTimer);
        return next;
      });
    }, 90);

    return () => window.clearInterval(raceTimer);
  }, [isRacing, winner]);

  return (
    <div className="horse-racing-container">
      <h2>賽馬</h2>
      <p className="text-xs text-[#adaaaa] mb-2">第 {roundId ?? '...'} 局</p>

      <div className="horse-choices">
        {HORSES.map((horse) => (
          <button
            key={horse.id}
            type="button"
            className={`horse-choice ${selectedHorseId === horse.id ? 'active' : ''}`}
            onClick={() => setSelectedHorseId(horse.id)}
          >
            <span>{horse.name}</span>
            <span className="multiplier">{horse.multiplier}x</span>
          </button>
        ))}
      </div>

      <div className="race-track">
        <div className="race-hud">
          <div className="pace-meter">
            <div className="pace-fill" style={{ width: `${Math.max(...Object.values(progress))}%` }} />
          </div>
        </div>
        {HORSES.map((horse) => (
          <div key={horse.id} className="lane">
            <span className="lane-tag">#{horse.id}</span>
            <span
              className={`horse-avatar ${isRacing ? 'running' : ''} ${winner?.id === horse.id && !isRacing ? 'winner' : ''}`}
              style={{ left: `${Math.min(92, progress[horse.id] ?? 0)}%` }}
            >
              🐎
            </span>
          </div>
        ))}
        <div className="status-panel" style={{ color: statusColor }}>
          {statusMsg}
          
        </div>
      </div>

      <div className="betting-controls">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} maxBet={maxBet} />
        <button className="btn-bet" onClick={handleBet} disabled={roundId === null}>
          立即下注
        </button>
      </div>
    </div>
  );
};
