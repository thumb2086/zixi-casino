import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Bingo.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { BetQuickActions } from './BetQuickActions';

export const BingoView: React.FC = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [betAmount, setBetAmount] = useState('10');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [status, setStatus] = useState('📋 請從 1~75 中選 8 個號碼');
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [result, setResult] = useState<any>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [roundNo, setRoundNo] = useState(1);

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
      setStatus('🎱 開球中...');
      setStatusColor('#ffd36a');
      window.setTimeout(() => {
        setResult(data);
        setStatus(`🎉 第 ${roundNo} 局結算：派彩 ${data.payout}`);
        setStatusColor(data.result === 'win' ? '#00ff88' : '#ff4d4d');
        setRoundNo((prev) => prev + 1);
        setIsRevealing(false);
        queryClient.invalidateQueries({ queryKey: ['user'] });
      }, 300);
    },
    onError: (err: Error) => {
      setStatus(`❌ 下注失敗：${err.message}`);
      setStatusColor('#ff4d4d');
    },
  });

  const winningNumbersSet = new Set(result?.winningNumbers || []);
  const hitNumbers = new Set(result?.matches || []);

  return (
    <div className="bingo-container">
      <div className="drawn-balls">
        {selectedNumbers.map((n) => (
          <div key={n} className={`bingo-ball ${hitNumbers.has(n) ? 'bg-emerald-600' : ''}`}>{n}</div>
        ))}
      </div>

      {result && (
        <div className="text-xs text-slate-400 mb-2 text-center">
          開獎號碼：{(result.winningNumbers || []).slice(0, 20).join(', ')}
          {(result.winningNumbers || []).length > 20 && ' ...'}
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

      <div className="bingo-controls">
        <button className="bg-slate-700 px-4 py-2 rounded disabled:opacity-50" onClick={randomPick} disabled={isRevealing || betMutation.isPending}>隨機選號</button>
        <button className="bg-slate-700 px-4 py-2 rounded disabled:opacity-50" onClick={() => setSelectedNumbers([])} disabled={isRevealing || betMutation.isPending}>清空已選</button>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 p-2 rounded text-white font-mono"
          disabled={isRevealing || betMutation.isPending}
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} disabled={betMutation.isPending || isRevealing} />
        <button
          className="bg-yellow-500 text-black font-bold px-8 rounded hover:bg-yellow-400 disabled:opacity-50"
          onClick={() => betMutation.mutate()}
          disabled={selectedNumbers.length === 0 || betMutation.isPending || isRevealing}
        >
          {betMutation.isPending || isRevealing ? '開球中…' : '下注並開球'}
        </button>
      </div>

      <div className="bingo-status" style={{ color: statusColor }}>
        {status}
        {result && (
          <div className="mt-2 text-sm text-slate-300">
            命中 {(result.matches || []).length} 個號碼：{(result.matches || []).join(', ') || '無'}
            {result.winningNumbers && <div className="text-xs text-slate-500 mt-1">開獎 {result.winningNumbers.length} 個號碼（綠色標記）</div>}
          </div>
        )}
      </div>
    </div>
  );
};
