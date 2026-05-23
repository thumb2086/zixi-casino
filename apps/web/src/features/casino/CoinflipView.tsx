import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import { ChipAnimation } from '../../components/ChipAnimation';
import './Coinflip.css';

export const CoinflipView: React.FC = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as { maxBet?: number } | undefined;
    },
    staleTime: 60000,
  });
  const maxBet = profile?.maxBet ?? 1_000_000;
  const [betAmount, setBetAmount] = useState('10');
  const [selection, setSelection] = useState<'heads' | 'tails'>('heads');
  const [isDrawing, setIsDrawing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState('選擇正面或反面，然後開始！');
  const [statusColor, setStatusColor] = useState('#ffd36a');

  const [chipAnimations, setChipAnimations] = useState<{ id: number; amount: number; startX: number; startY: number; endX: number; endY: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  const showResult = (winner: string, isWin: boolean, payout: number) => {
    setIsDrawing(true);
    setStatus('硬幣翻轉中...');
    setStatusColor('#ffd36a');

    // Animate coin
    const targetDeg = winner === 'heads' ? 0 : 180;
    setRotation(r => r + 1440 + (targetDeg - (r % 360) + 360) % 360);

    setTimeout(() => {
      if (isWin) {
        setStatus(`🏆 恭喜！結果是 ${winner === 'heads' ? '正面' : '反面'}，獲得 ${payout.toLocaleString()} ZXC！`);
        setStatusColor('#00ff88');
      } else {
        setStatus(`💀 結果是 ${winner === 'heads' ? '正面' : '反面'}，下次好運！`);
        setStatusColor('#ff4d4d');
      }
      setIsDrawing(false);
    }, 800);
  };

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('未登入');
      const res = await api.post('/api/v1/games/coinflip/play', {
        sessionId: session.id,
        betAmount: parseFloat(betAmount),
        selection
      });
      const data = res.data;
      if (!data.success) throw new Error(data.error || '下注失敗');
      return data.data;
    },
    onMutate: () => {
      if (buttonRef.current && coinRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const coinRect = coinRef.current.getBoundingClientRect();
        const startX = buttonRect.left + buttonRect.width / 2;
        const startY = buttonRect.top + buttonRect.height / 2;
        const endX = coinRect.left + coinRect.width / 2;
        const endY = coinRect.top + coinRect.height / 2;
        const id = Date.now();
        setChipAnimations(prev => [...prev, { id, amount: parseFloat(betAmount), startX, startY, endX, endY }]);
        setTimeout(() => {
          setChipAnimations(prev => prev.filter(a => a.id !== id));
        }, 800);
      }
    },
    onSuccess: (data) => {
      showResult(data.winner, data.result === 'win', Number(data.payout));
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (err: Error) => {
      setStatus(`❌ 錯誤: ${err.message}`);
      setStatusColor('#ff4d4d');
    }
  });

  const handleAllIn = () => {
    setBetAmount(String(maxBet));
  };

  return (
    <div className="coinflip-container">
      <div className="coin-wrapper" ref={coinRef}>
        <div className="coin" style={{ transform: `rotateY(${rotation}deg)` }}>
          <div className="coin-face coin-front">ZC</div>
          <div className="coin-face coin-back">子</div>
        </div>
      </div>

      <div className="status-text" style={{ color: statusColor }}>
        {status}
      </div>

      <div className="coinflip-controls">
        <div className="choice-buttons">
          <button
            className={`btn-choice ${selection === 'heads' ? 'active' : ''}`}
            onClick={() => !isDrawing && setSelection('heads')}
          >
            正面
          </button>
          <button
            className={`btn-choice ${selection === 'tails' ? 'active' : ''}`}
            onClick={() => !isDrawing && setSelection('tails')}
          >
            反面
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-stretch">
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={isDrawing}
            className="min-w-0 rounded-lg border border-slate-700 bg-slate-800 p-4 text-white"
          />
          <button
            className="min-h-[56px] rounded-lg bg-purple-600 px-4 font-bold text-white hover:bg-purple-700 disabled:opacity-50 sm:min-w-[96px]"
            onClick={handleAllIn}
            disabled={isDrawing}
            title="最高下注"
          >
            {maxBet.toLocaleString()}
          </button>
          <button
            ref={buttonRef}
            className="btn-play min-h-[56px] px-8 sm:min-w-[132px]"
            onClick={() => betMutation.mutate()}
            disabled={isDrawing || betMutation.isPending}
          >
            {betMutation.isPending ? '處理中...' : '確認下注'}
          </button>
        </div>
      </div>

      {chipAnimations.map(chip => (
        <ChipAnimation
          key={chip.id}
          amount={chip.amount}
          startX={chip.startX}
          startY={chip.startY}
          endX={chip.endX}
          endY={chip.endY}
        />
      ))}
    </div>
  );
};
