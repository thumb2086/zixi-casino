import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Bingo.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { useTranslation } from 'react-i18next';
import { BetQuickActions } from './BetQuickActions';

export const BingoView: React.FC = () => {
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
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [status, setStatus] = useState(t('casino_game.bingo_instruction'));
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [result, setResult] = useState<any>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealingNumbers, setRevealingNumbers] = useState<number[]>([]);
  const [animDone, setAnimDone] = useState(false);
  const roundNoRef = useRef(1);
  const animRef = useRef<ReturnType<typeof setInterval>>();

  const toggleNumber = (n: number) => {
    setSelectedNumbers((prev) => {
      if (prev.includes(n)) return prev.filter((value) => value !== n);
      if (prev.length >= 8) return prev;
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  const randomPick = () => {
    const pool = Array.from({ length: 75 }, (_, i) => i + 1);
    const shuffled = pool.sort(() => 0.5 - Math.random());
    setSelectedNumbers(shuffled.slice(0, 8).sort((a, b) => a - b));
  };

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session');

      const res = await api.post('/api/v1/games/bingo/play', {
        sessionId: session.id,
        betAmount: Number(betAmount),
        numbers: selectedNumbers,
      });

      const payload = res.data;
      if (!res.status || payload?.success === false) {
        throw new Error(extractGameError(payload));
      }

      return unwrapGameEnvelope<any>(payload);
    },
    onSuccess: (data) => {
      setIsRevealing(true);
      setResult(data);
      setRevealingNumbers([]);
      setAnimDone(false);
      setStatus(t('casino_game.bingo_rolling'));
      setStatusColor('#ffd36a');

      const allWinning = data.winningNumbers || [];
      let idx = 0;
      const speed = allWinning.length > 15 ? 120 : 180;
      animRef.current = setInterval(() => {
        if (idx < allWinning.length) {
          setRevealingNumbers(prev => [...prev, allWinning[idx]]);
          idx++;
        } else {
          clearInterval(animRef.current);
          setAnimDone(true);
          setStatus(t('casino_game.bingo_win_result', { round: roundNoRef.current, amount: data.payout }));
          setStatusColor(data.result === 'win' ? '#00ff88' : '#ff4d4d');
          roundNoRef.current += 1;
          setIsRevealing(false);
          queryClient.invalidateQueries({ queryKey: ['user'] });
          queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        }
      }, speed);
    },
    onError: (err: Error) => {
      setStatus(t('casino_game.bingo_bet_error', { message: err.message }));
      setStatusColor('#ff4d4d');
    },
  });

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  const winningNumbersSet = new Set(result?.winningNumbers || []);
  const hitNumbers = new Set(result?.matches || []);

  return (
    <div className="bingo-container">
      <div className="drawn-balls">
        {selectedNumbers.map((n) => (
          <div key={n} className={`bingo-ball bingo-ball-anim ${hitNumbers.has(n) ? 'hit' : ''}`}>{n}</div>
        ))}
        {isRevealing && revealingNumbers.map((n) => (
          <div key={`r${n}`} className="bingo-ball drawn bingo-ball-anim">{n}</div>
        ))}
        {animDone && (result?.winningNumbers || []).map((n: number) => (
          <div key={`w${n}`} className={`bingo-ball bingo-ball-anim ${hitNumbers.has(n) ? 'hit' : 'drawn'}`}>{n}</div>
        ))}
      </div>

      {result && animDone && (
        <div className="text-xs text-slate-400 mb-2 text-center">
          {t('casino_game.bingo_drawn_numbers')}{(result.winningNumbers || []).join(', ')}
        </div>
      )}

      <div className="bingo-grid-wrapper">
        {isRevealing && !animDone && (
          <div className="bingo-reveal-overlay">
            <div className="text-sm text-[#fcc025] font-bold">{t('casino_game.bingo_rolling')}</div>
            <div className="bingo-reveal-balls">
              {revealingNumbers.map(n => (
                <div key={n} className="bingo-reveal-ball">{n}</div>
              ))}
            </div>
          </div>
        )}
        <div className="bingo-grid">
        {Array.from({ length: 75 }, (_, i) => i + 1).map((n) => {
          const isHit = hitNumbers.has(n);
          const isWinNum = winningNumbersSet.has(n) && !isHit;
          const isSelected = selectedNumbers.includes(n);
          let cls = 'bingo-cell';
          if (isHit) cls += ' hit';
          else if (isWinNum) cls += ' drawn';
          else if (isSelected) cls += ' selected';
          return (
            <div key={n} className={cls}
              onClick={() => !isRevealing && !betMutation.isPending && toggleNumber(n)}>
              {n}
            </div>
          );
        })}
      </div>
      </div>

      <div className="bingo-controls">
        <button className="bg-slate-700 px-4 py-2 rounded disabled:opacity-50" onClick={randomPick} disabled={isRevealing || betMutation.isPending}>{t('casino_game.bingo_select_random')}</button>
        <button className="bg-slate-700 px-4 py-2 rounded disabled:opacity-50" onClick={() => setSelectedNumbers([])} disabled={isRevealing || betMutation.isPending}>{t('casino_game.bingo_clear')}</button>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 p-2 rounded text-white font-mono"
          disabled={isRevealing || betMutation.isPending}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} disabled={betMutation.isPending || isRevealing} maxBet={maxBet} />
        <button
          className="bg-yellow-500 text-black font-bold px-8 rounded hover:bg-yellow-400 disabled:opacity-50"
          onClick={() => betMutation.mutate()}
          disabled={selectedNumbers.length === 0 || betMutation.isPending || isRevealing}
        >
          {betMutation.isPending || isRevealing ? t('casino_game.bingo_drawing') : t('casino_game.bingo_bet_and_draw')}
        </button>
      </div>

      <div className="bingo-status" style={{ color: statusColor }}>
        {status}
        {result && animDone && (
          <div className="mt-2 text-sm text-slate-300">
            {t('casino_game.bingo_match_result', { count: result.matches?.length || 0, numbers: (result.matches || []).join(', ') || '無' })}
            {result.winningNumbers && <div className="text-xs text-slate-500 mt-1">{t('casino_game.bingo_drawn_count', { count: result.winningNumbers.length })}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
