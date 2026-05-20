import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './HorseRacing.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { BetQuickActions } from './BetQuickActions';
import { useBetQueue } from './useBetQueue';

const HORSES = [
  { id: 1, name: '赤焰', multiplier: 3.6 },
  { id: 2, name: '雷霆', multiplier: 4.4 },
  { id: 3, name: '幻影', multiplier: 5.8 },
  { id: 4, name: '夜刃', multiplier: 8.0 },
  { id: 5, name: '霜牙', multiplier: 11.6 },
  { id: 6, name: '流星', multiplier: 17.0 },
];

type HorseResult = {
  selectedHorse: number;
  winnerId: number;
  winnerName: string;
  result: 'win' | 'lose';
  payout: number;
  multiplier: number;
};

export const HorseRacingView: React.FC = () => {
  const { session } = useAuth();
  const { enqueue, pending, lastResult, setLastResult } = useBetQueue();
  const [selectedHorseId, setSelectedHorseId] = useState(1);
  const [betAmount, setBetAmount] = useState('10');
  const [statusMsg, setStatusMsg] = useState('請選擇馬匹並下注。');
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [isRacing, setIsRacing] = useState(false);
  const [progress, setProgress] = useState<Record<number, number>>(() =>
    HORSES.reduce((acc, horse) => ({ ...acc, [horse.id]: 0 }), {})
  );

  const doBet = async () => {
    if (!session) throw new Error('No session');

    const res = await api.post('/api/v1/games/horse/play', {
      sessionId: session.id,
      betAmount: Number(betAmount),
      horseId: selectedHorseId,
    });

    const payload = res.data;
    if (!res.status || payload?.success === false) {
      throw new Error(extractGameError(payload));
    }

    return unwrapGameEnvelope<HorseResult>(payload);
  };

  const handleBet = () => {
    setIsRacing(true);
    setStatusMsg(`🏇 比賽開始！(${pending + 1})`);
    setStatusColor('#ffd36a');

    enqueue(async () => {
      const data = await doBet();
      setResult(data);
      return data;
    });
  };

  const setResult = (data: HorseResult) => {
    setLastResult(data);
    setStatusMsg(`冠軍：${data.winnerName}（${data.multiplier}x）`);
    setStatusColor(data.result === 'win' ? '#00ff88' : '#ff4d4d');
    setIsRacing(false);
  };

  // Race animation
  useEffect(() => {
    if (!isRacing) return;

    const raceTimer = window.setInterval(() => {
      setProgress((prev) => {
        let allFinished = true;
        const next: Record<number, number> = {};
        for (const horse of HORSES) {
          const value = Math.min(100, (prev[horse.id] ?? 0) + 0.75 + Math.random() * 0.5);
          next[horse.id] = value;
          if (value < 100) allFinished = false;
        }
        if (allFinished) {
          window.clearInterval(raceTimer);
        }
        return next;
      });
    }, 90);

    return () => window.clearInterval(raceTimer);
  }, [isRacing]);

  // Reset race when new result comes in
  useEffect(() => {
    if (!lastResult) return;
    setProgress(HORSES.reduce((acc, horse) => ({ ...acc, [horse.id]: 0 }), {}));
    setIsRacing(false);
    setStatusMsg(`冠軍：${lastResult.winnerName}（${lastResult.multiplier}x）`);
    setStatusColor(lastResult.result === 'win' ? '#00ff88' : '#ff4d4d');
  }, [lastResult]);

  return (
    <div className="horse-racing-container">
      <h2>賽馬</h2>

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
              className={`horse-avatar ${isRacing ? 'running' : ''} ${lastResult?.winnerId === horse.id && !isRacing ? 'winner' : ''}`}
              style={{ left: `${Math.min(92, progress[horse.id] ?? 0)}%` }}
            >
              🐎
            </span>
          </div>
        ))}
        <div className="status-panel" style={{ color: statusColor }}>
          {statusMsg}
          {lastResult && !isRacing && (
            <div className="mt-2 text-sm text-slate-300">
              你選了 #{lastResult.selectedHorse}，派彩 {lastResult.payout}
            </div>
          )}
        </div>
      </div>

      <div className="betting-controls">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} />
        <button className="btn-bet" onClick={handleBet}>
          {pending > 0 ? `下注中 (${pending})` : '立即下注'}
        </button>
      </div>
    </div>
  );
};
