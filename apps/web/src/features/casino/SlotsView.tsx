import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Slots.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { BetQuickActions } from './BetQuickActions';

const GAME_MAX_BET = 1_000_000;

const SYMBOLS = ['🍒', '🍋', '🍉', '⭐', '🔔', '💎', '7️⃣'];

function randomSymbols(): string[] {
  return Array.from({ length: 9 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

export const SlotsView: React.FC = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const spinningRef = useRef(false);
  const [betAmount, setBetAmount] = useState('10');

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as { maxBet?: number } | undefined;
    },
    staleTime: 60000,
  });
  const maxBet = Math.min(profile?.maxBet ?? GAME_MAX_BET, GAME_MAX_BET);
  const [grid, setGrid] = useState<string[]>(['🍒', '🍋', '🍉', '⭐', '🔔', '💎', '7️⃣', '🍒', '🍋']);
  const [status, setStatus] = useState('🎰 拉霸準備就緒，祝你好運！');
  const [winSymbols, setWinSymbols] = useState<number[]>([]);

  const handleSpin = () => {
    if (!session) return;

    // Show mock result IMMEDIATELY
    setGrid(randomSymbols());
    setStatus('🎲 結果計算中...');
    setWinSymbols([]);

    // Fire API concurrently — no queue, each spin is independent
    spinningRef.current = true;
    api.post('/api/v1/games/slots/play', {
      sessionId: session.id,
      betAmount: Number(betAmount),
    }).then((res) => {
      const payload = res.data;
      if (payload?.success === false) throw new Error(extractGameError(payload));
      const result = unwrapGameEnvelope<any>(payload);

      // Update grid with real result (concurrent spins are fine — each is independent)
      setGrid(result.symbols);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      if (result.multiplier > 0) {
        setStatus(`🎉 中獎！倍率 ${result.multiplier}x`);
        setWinSymbols(result.winLines?.flat() || []);
      } else {
        setStatus('😢 本局未中，下一把再衝！');
        setWinSymbols([]);
      }
    }).catch((err: any) => {
      setStatus(`❌ ${err?.message || '旋轉失敗'}`);
    }).finally(() => {
      spinningRef.current = false;
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
        <BetQuickActions amount={betAmount} onChange={setBetAmount} maxBet={maxBet} />
        <button className="btn-spin" onClick={handleSpin}>
          開始旋轉
        </button>
      </div>

      <div className="slots-status">{status}</div>
    </div>
  );
};
