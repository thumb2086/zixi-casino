import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Slots.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { BetQuickActions } from './BetQuickActions';
import { useBetQueue } from './useBetQueue';

const SYMBOLS = ['🍒', '🍋', '🍉', '⭐', '🔔', '💎', '7️⃣'];

function randomSymbols(): string[] {
  return Array.from({ length: 9 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

export const SlotsView: React.FC = () => {
  const { session } = useAuth();
  const { enqueue, pending } = useBetQueue();
  const [betAmount, setBetAmount] = useState('10');
  const [grid, setGrid] = useState<string[]>(['🍒', '🍋', '🍉', '⭐', '🔔', '💎', '7️⃣', '🍒', '🍋']);
  const [status, setStatus] = useState('🎰 拉霸準備就緒，祝你好運！');
  const [winSymbols, setWinSymbols] = useState<number[]>([]);

  const handleSpin = () => {
    if (!session) return;

    // Show mock result IMMEDIATELY (<1ms feedback)
    const mockSymbols = randomSymbols();
    setGrid(mockSymbols);
    setStatus(`🎲 結果計算中...${pending > 0 ? ` (佇列 ${pending + 1})` : ''}`);
    setWinSymbols([]);

    // Fire API in background
    enqueue(async () => {
      const res = await api.post('/api/v1/games/slots/play', {
        sessionId: session.id,
        betAmount: Number(betAmount),
      });
      const payload = res.data;
      if (!res.status || payload?.success === false) {
        throw new Error(extractGameError(payload));
      }
      const result = unwrapGameEnvelope<any>(payload);

      // Replace mock with real result
      const newGrid = [...grid];
      for (let i = 0; i < 9; i++) newGrid[i] = result.symbols[i];
      setGrid(newGrid);

      if (result.multiplier > 0) {
        setStatus(`🎉 中獎！倍率 ${result.multiplier}x`);
        setWinSymbols(result.winLine || [3, 4, 5]);
      } else {
        setStatus('😢 本局未中，下一把再衝！');
        setWinSymbols([]);
      }
      return result;
    });
  };

  return (
    <div className="slots-container">
      <div className="slots-board">
        <div className="slots-grid">
          {grid.map((symbol, i) => (
            <div key={i} className={`slot-cell ${winSymbols.includes(i) ? 'bg-yellow-500/20 border-2 border-yellow-500' : ''}`}>
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
          className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-lg text-white"
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} />
        <button className="btn-spin" onClick={handleSpin}>
          {pending > 0 ? `旋轉中 (${pending})` : '開始旋轉'}
        </button>
      </div>

      <div className="slots-status">{status}</div>
    </div>
  );
};
