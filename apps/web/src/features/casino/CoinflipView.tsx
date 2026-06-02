import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import { ChipAnimation } from '../../components/ChipAnimation';
import { useTranslation } from 'react-i18next';
import './Coinflip.css';

export const CoinflipView: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
  const [status, setStatus] = useState(t('casino_game.coinflip_instruction_long'));
  const [statusColor, setStatusColor] = useState('#ffd36a');

  const [chipAnimations, setChipAnimations] = useState<{ id: number; amount: number; startX: number; startY: number; endX: number; endY: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  const showResult = (winner: string, isWin: boolean, payout: number) => {
    setIsDrawing(true);
    setStatus(t('casino_game.coinflip_spinning'));
    setStatusColor('#ffd36a');

    // Animate coin
    const targetDeg = winner === 'heads' ? 0 : 180;
    setRotation(r => r + 1440 + (targetDeg - (r % 360) + 360) % 360);

    setTimeout(() => {
      if (isWin) {
        setStatus(t('casino_game.coinflip_win_result', { result: t(winner === 'heads' ? 'casino_game.coinflip_heads' : 'casino_game.coinflip_tails'), amount: payout.toLocaleString() }));
        setStatusColor('#00ff88');
      } else {
        setStatus(t('casino_game.coinflip_lose_result', { result: t(winner === 'heads' ? 'casino_game.coinflip_heads' : 'casino_game.coinflip_tails') }));
        setStatusColor('#ff4d4d');
      }
      setIsDrawing(false);
    }, 800);
  };

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t('common.login_required', 'Please login'));
      const res = await api.post('/api/v1/games/coinflip/play', {
        sessionId: session.id,
        betAmount: parseFloat(betAmount),
        selection
      });
      const data = res.data;
      if (!data.success) throw new Error(data.error || t('casino_game.bet_failed', 'Bet failed'));
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
      const won = data.winner === data.selection;
      const payout = Number(data.payout) || 0;

      showResult(data.winner, won, payout);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: (err: Error) => {
      setStatus(t('casino_game.coinflip_error', { message: err.message }));
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
            {t('casino_game.coinflip_heads')}
          </button>
          <button
            className={`btn-choice ${selection === 'tails' ? 'active' : ''}`}
            onClick={() => !isDrawing && setSelection('tails')}
          >
            {t('casino_game.coinflip_tails')}
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
            title={t('casino_game.coinflip_max_bet')}
          >
            {maxBet.toLocaleString()}
          </button>
          <button
            ref={buttonRef}
            className="btn-play min-h-[56px] px-8 sm:min-w-[132px]"
            onClick={() => betMutation.mutate()}
            disabled={isDrawing || betMutation.isPending}
          >
            {betMutation.isPending ? t('casino_game.processing') : t('casino_game.confirm_bet')}
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
