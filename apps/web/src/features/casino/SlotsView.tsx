import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Slots.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { BetQuickActions } from './BetQuickActions';

const SYMBOLS = ['🍒', '🍋', '🍉', '⭐', '🔔', '💎', '7️⃣'];

export const SlotsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [betAmount, setBetAmount] = useState('10');
  const [isSpinning, setIsSpinning] = useState(false);
  const [grid, setGrid] = useState<string[]>(['🍒', '🍋', '🍉', '⭐', '🔔', '💎', '7️⃣', '🍒', '🍋'].slice(0, 9));
  const [status, setStatus] = useState('🎰 拉霸準備就緒，祝你好運！');
  const [winSymbols, setWinSymbols] = useState<number[]>([]);

  const spinMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session');

      const res = await api.post('/api/v1/games/slots/play', {
        sessionId: session.id,
        betAmount: Number(betAmount),
      });

      const payload = res.data;
      if (!res.status || payload?.success === false) {
        throw new Error(extractGameError(payload));
      }

      return unwrapGameEnvelope<any>(payload);
    },
    onSuccess: async (result) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setIsSpinning(false);

      const newGrid = [...grid];
      newGrid[3] = result.symbols[0];
      newGrid[4] = result.symbols[1];
      newGrid[5] = result.symbols[2];
      setGrid(newGrid);

      if (result.multiplier > 0) {
        setStatus(`🎉 中獎！倍率 ${result.multiplier}x`);
        setWinSymbols([3, 4, 5]);
      } else {
        setStatus('😢 本局未中，下一把再衝！');
        setWinSymbols([]);
      }

      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err: Error) => {
      setIsSpinning(false);
      setStatus(`❌ 下注失敗：${err.message}`);
    },
  });

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setStatus('🎲 轉動中...');
    setWinSymbols([]);
    spinMutation.mutate();
  };

  useEffect(() => {
    let interval: number;

    if (isSpinning) {
      interval = window.setInterval(() => {
        setGrid((prev) => prev.map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]));
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isSpinning]);

  return (
    <div className="slots-container">
      <div className="slots-board">
        <div className="slots-grid">
          {grid.map((symbol, i) => (
            <div
              key={i}
              className={`slot-cell ${isSpinning ? 'spinning' : ''} ${winSymbols.includes(i) ? 'bg-yellow-500/20 border-2 border-yellow-500' : ''}`}
            >
              {symbol}
            </div>
          ))}
        </div>
      </div>

      <div className="slot-controls">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          disabled={isSpinning}
          className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-lg text-white"
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} disabled={isSpinning} />
        <button
          className="btn-spin"
          onClick={handleSpin}
          disabled={isSpinning}
        >
          {isSpinning ? '轉動中…' : '開始旋轉'}
        </button>
      </div>

      <div className="slots-status">{status}</div>
    </div>
  );
};
