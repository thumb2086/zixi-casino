import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import { useUserStore } from '../../store/useUserStore';
import { ChipAnimation } from '../../components/ChipAnimation';
import './Coinflip.css';

const COINFLIP_ROUND_MS = 6000;
const COINFLIP_LOCK_MS = 4000;

export const CoinflipView: React.FC = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { balance } = useUserStore();
  const [betAmount, setBetAmount] = useState('10');
  const [selection, setSelection] = useState<'heads' | 'tails'>('heads');
  const [isDrawing, setIsDrawing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState('🎲 選擇正面或反面，然後開始！');
  const [statusColor, setStatusColor] = useState('#ffd36a');
  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [chipAnimations, setChipAnimations] = useState<{ id: number; amount: number; startX: number; startY: number; endX: number; endY: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  // Server-synced round info
  const [serverRound, setServerRound] = useState<{
    roundId: number;
    closesAt: number;
    bettingClosesAt: number;
    isBettingOpen: boolean;
    msLeft: number;
  } | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  // Fetch round info from server on mount and periodically
  useEffect(() => {
    const fetchRound = async () => {
      try {
        const res = await api.get("/api/v1/games/coinflip/round");
        const env = res.data?.data?.data ?? res.data?.data;
        if (env?.roundId !== undefined) {
          setServerRound(env);
          setClockOffset(env.serverNow - Date.now());
        }
      } catch {}
    };
    fetchRound();
    const interval = setInterval(fetchRound, 5000);
    return () => clearInterval(interval);
  }, []);

  // Local clock synced to server time
  const [localNow, setLocalNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const serverNow = localNow + clockOffset;
  const currentRoundId = serverRound?.roundId ?? Math.floor(serverNow / COINFLIP_ROUND_MS);
  const closesAt = serverRound?.closesAt ?? ((currentRoundId + 1) * COINFLIP_ROUND_MS);
  const bettingClosesAt = serverRound?.bettingClosesAt ?? (closesAt - COINFLIP_LOCK_MS);
  const isBettingOpen = serverNow < bettingClosesAt;
  const countdownTarget = isBettingOpen ? bettingClosesAt : closesAt;
  const secLeft = Math.max(0, Math.ceil((countdownTarget - serverNow) / 1000));

  const [lastRoundId, setLastRoundId] = useState<number | null>(null);

  useEffect(() => {
    if (lastRoundId !== null && lastRoundId !== currentRoundId) {
      handleDraw(lastRoundId);
    }
    setLastRoundId(currentRoundId);
  }, [currentRoundId]);

  const handleDraw = async (roundId: number) => {
    if (isDrawing) return;
    setIsDrawing(true);
    setStatus('🎲 硬幣正在翻轉中...');
    setStatusColor('#ffd36a');

    // Deterministic result based on roundId
    const seed = `coinflip:${roundId}`;
    const hash = Array.from(seed).reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const winner = hash % 2 === 0 ? 'heads' : 'tails';

    // Animation: 4 full spins (1440 deg) + target
    const baseRotation = rotation + 1440;
    const targetRotation = baseRotation + (winner === 'heads' ? (360 - (rotation % 360)) : (180 - (rotation % 360) + 360) % 360);
    setRotation(targetRotation);

    await new Promise(r => setTimeout(r, 400));

    const roundBets = pendingBets.filter(b => b.roundId === roundId);
    if (roundBets.length > 0) {
      const winCount = roundBets.filter(b => b.selection === winner).length;
      if (winCount > 0) {
        setStatus(`🏆 恭喜！結果是 ${winner === 'heads' ? '正面' : '反面'}，獲得派彩！`);
        setStatusColor('#00ff88');
      } else {
        setStatus(`💀 結果是 ${winner === 'heads' ? '正面' : '反面'}，下次好運！`);
        setStatusColor('#ff4d4d');
      }
      setPendingBets(prev => prev.filter(b => b.roundId !== roundId));
      queryClient.invalidateQueries({ queryKey: ['user'] });
    } else {
      setStatus(`🏁 第 ${roundId} 局結果：${winner === 'heads' ? '正面' : '反面'}`);
      setStatusColor('#ffd36a');
    }

    setIsDrawing(false);
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
      if (!res.status) throw new Error(data.error || '下注失敗');
      if (!data.success) throw new Error(data.error || '下注失敗');
      return data.data;
    },
    onMutate: () => {
      // Trigger chip animation
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
    onSuccess: (responseData) => {
      // Handle both direct response and envelope response
      const data = responseData?.data || responseData;
      const roundId = data?.roundId;
      
      if (roundId !== undefined) {
        setPendingBets(prev => [...prev, { amount: parseFloat(betAmount), selection, roundId }]);
        setStatus('✅ 下注成功，等待開獎...');
        setStatusColor('#00ff88');
        queryClient.invalidateQueries({ queryKey: ['user'] });
      } else {
        console.log('Full response data:', responseData);
        setStatus('❌ 錯誤: roundId 未返回');
        setStatusColor('#ff4d4d');
      }
    },
    onError: (err: Error) => {
      setStatus(`❌ 錯誤: ${err.message}`);
      setStatusColor('#ff4d4d');
    }
  });

  const handleAllIn = () => {
    const currentBalance = parseFloat(balance) || 0;
    if (currentBalance > 0) {
      setBetAmount(Math.floor(currentBalance).toString());
    }
  };

  return (
    <div className="coinflip-container">
      <div className="text-center">
        <h3 className="text-slate-400">第 {currentRoundId} 局</h3>
        <p className={isBettingOpen ? "text-yellow-500" : "text-red-500"}>
          {isBettingOpen ? `截止下注：${secLeft} 秒` : `即將開獎：${secLeft} 秒`}
        </p>
      </div>

      <div className="coin-wrapper" ref={coinRef}>
        <div className="coin" style={{ transform: `rotateY(${rotation}deg)` }}>
          <div className="coin-face coin-front">🪙</div>
          <div className="coin-face coin-back">📀</div>
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
            disabled={isDrawing || !isBettingOpen}
            className="min-w-0 rounded-lg border border-slate-700 bg-slate-800 p-4 text-white"
          />
          <button
            className="min-h-[56px] rounded-lg bg-purple-600 px-4 font-bold text-white hover:bg-purple-700 disabled:opacity-50 sm:min-w-[96px]"
            onClick={handleAllIn}
            disabled={isDrawing || !isBettingOpen}
            title="全部下注"
          >
            全下
          </button>
          <button
            ref={buttonRef}
            className="btn-play min-h-[56px] px-8 sm:min-w-[132px]"
            onClick={() => betMutation.mutate()}
            disabled={isDrawing || !isBettingOpen || betMutation.isPending}
          >
            {betMutation.isPending ? '處理中...' : '確認下注'}
          </button>
        </div>
      </div>

      {pendingBets.length > 0 && (
        <div className="text-sm text-slate-500">
          目前下注：{pendingBets.map(b => `${b.selection === 'heads' ? '正' : '反'}(${b.roundId !== undefined ? '#' + b.roundId : '未知'})`).join(', ')}
        </div>
      )}

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
