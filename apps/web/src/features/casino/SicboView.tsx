import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Sicbo.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { useTranslation } from 'react-i18next';
import { BetQuickActions } from './BetQuickActions';

export const SicboView: React.FC = () => {
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
  const [selectedBet, setSelectedBet] = useState<'big' | 'small'>('big');
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState(t('casino_game.sicbo_instruction'));
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [dicePreview, setDicePreview] = useState([1, 1, 1]);
  const [isRevealing, setIsRevealing] = useState(false);

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('未登入');

      const res = await api.post('/api/v1/games/sicbo/play', {
        sessionId: session.id,
        betAmount: Number(betAmount),
        bets: [{ type: selectedBet }],
      });

      const payload = res.data;
      if (!res.status || payload?.success === false) {
        throw new Error(extractGameError(payload));
      }

      return unwrapGameEnvelope<any>(payload);
    },
    onSuccess: (data) => {
      setIsRevealing(true);
      setStatus(t('casino_game.sicbo_rolling'));
      setStatusColor('#ffd36a');
      window.setTimeout(() => {
        setResult(data);
        setDicePreview(data.dice || [1, 1, 1]);
        setStatus(t('casino_game.sicbo_bet_result', { total: data.total, result: data.isBig ? t('casino_game.sicbo_big_label') : t('casino_game.sicbo_small_label') }));
        setStatusColor(data.result === 'win' ? '#00ff88' : '#ff4d4d');
        setIsRevealing(false);
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      }, 300);
    },
    onError: (err: Error) => {
      setStatus(t('casino_game.sicbo_bet_error', { message: err.message }));
      setStatusColor('#ff4d4d');
    },
  });

  useEffect(() => {
    if (!betMutation.isPending && !isRevealing) return;
    const rolling = window.setInterval(() => {
      setDicePreview([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 120);
    return () => window.clearInterval(rolling);
  }, [betMutation.isPending, isRevealing]);

  return (
    <div className="sicbo-container">
      <div className="dice-area">
        {((betMutation.isPending || isRevealing) ? dicePreview : result?.dice || dicePreview).map((d: number, i: number) => (
          <div key={i} className="die">{d}</div>
        ))}
      </div>

      <div className="sicbo-betting-grid">
        <div className={`bet-option ${selectedBet === 'small' ? 'active' : ''}`} onClick={() => setSelectedBet('small')}>
          <span className="bet-label">{t('casino_game.sicbo_small')}</span>
          <span className="bet-odds">x2.0</span>
        </div>
        <div className={`bet-option ${selectedBet === 'big' ? 'active' : ''}`} onClick={() => setSelectedBet('big')}>
          <span className="bet-label">{t('casino_game.sicbo_big')}</span>
          <span className="bet-odds">x2.0</span>
        </div>
      </div>

      <div className="sicbo-controls">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-lg text-white font-mono"
          disabled={betMutation.isPending || isRevealing}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} disabled={betMutation.isPending || isRevealing} maxBet={maxBet} />
        <button
          className="bg-yellow-500 text-black font-bold px-12 rounded-lg hover:bg-yellow-400 disabled:opacity-50"
          onClick={() => betMutation.mutate()}
          disabled={betMutation.isPending || isRevealing}
        >
          {betMutation.isPending || isRevealing ? t('casino_game.sicbo_opening') : t('casino_game.sicbo_bet_and_open')}
        </button>
      </div>

      <div className="sicbo-status" style={{ color: statusColor }}>{status}</div>
    </div>
  );
};
