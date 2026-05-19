import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Roulette.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { BetQuickActions } from './BetQuickActions';

const EUROPEAN_LAYOUT = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getColor(num: number) {
  if (num === 0) return 'green';
  return REDS.includes(num) ? 'red' : 'black';
}

function getColorClass(num: number) {
  if (num === 0) return 'bg-emerald-700 hover:bg-emerald-600';
  return REDS.includes(num) ? 'bg-red-700 hover:bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700';
}

interface PlacedBet {
  type: 'number' | 'color' | 'parity' | 'range' | 'dozen';
  value: number | string;
  label: string;
  amount: number;
}

const OUTSIDE_BETS: { type: PlacedBet['type']; value: string; label: string; color: string }[] = [
  { type: 'color', value: 'red', label: '紅', color: 'bg-red-600' },
  { type: 'color', value: 'black', label: '黑', color: 'bg-zinc-900' },
  { type: 'parity', value: 'odd', label: '單', color: 'bg-slate-700' },
  { type: 'parity', value: 'even', label: '雙', color: 'bg-slate-700' },
  { type: 'range', value: 'low', label: '小 1-18', color: 'bg-slate-700' },
  { type: 'range', value: 'high', label: '大 19-36', color: 'bg-slate-700' },
  { type: 'dozen', value: '1', label: '1st 12', color: 'bg-slate-700' },
  { type: 'dozen', value: '2', label: '2nd 12', color: 'bg-slate-700' },
  { type: 'dozen', value: '3', label: '3rd 12', color: 'bg-slate-700' },
];

// Three rows of 12 numbers for the table display
const TABLE_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

export function RouletteView() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [betAmount, setBetAmount] = useState('10');
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [lastBets, setLastBets] = useState<PlacedBet[]>([]);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<{ number: number; color: string } | null>(null);
  const [error, setError] = useState('');
  const wheelRef = useRef<HTMLDivElement>(null);

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);

  const addBet = (type: PlacedBet['type'], value: number | string, label: string) => {
    if (isSpinning) return;
    const amt = Math.max(1, Math.floor(Number(betAmount) || 10));
    setBets(prev => {
      const existing = prev.find(b => b.type === type && b.value === value);
      if (existing) {
        return prev.map(b => b === existing ? { ...b, amount: b.amount + amt } : b);
      }
      return [...prev, { type, value, label, amount: amt }];
    });
  };

  const removeBet = (idx: number) => {
    setBets(prev => prev.filter((_, i) => i !== idx));
  };

  const clearBets = () => setBets([]);

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session');
      if (bets.length === 0) throw new Error('請至少下一個注');
      const res = await api.post('/api/v1/games/roulette/play', {
        sessionId: session.id,
        betAmount: totalBet,
        bets: bets.map(b => ({ type: b.type, value: b.type === 'number' ? Number(b.value) : b.value })),
      });
      const payload = res.data;
      if (!res.status || payload?.success === false) {
        throw new Error(extractGameError(payload));
      }
      return unwrapGameEnvelope<any>(payload);
    },
    onSuccess: (data) => {
      setLastBets([...bets]);
      setBets([]);
      if (typeof data?.winningNumber === 'number') {
        animateWheel(data.winningNumber);
      }
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const animateWheel = (winningNumber: number) => {
    setIsSpinning(true);
    setError('');
    setResult(null);
    const index = EUROPEAN_LAYOUT.indexOf(winningNumber);
    const anglePerSlot = 360 / EUROPEAN_LAYOUT.length;
    const targetAngle = 360 - (index * anglePerSlot);
    const newRotation = rotation + 2520 + ((targetAngle - (rotation % 360) + 360) % 360);
    setRotation(newRotation);
    setTimeout(() => {
      setIsSpinning(false);
      setResult({ number: winningNumber, color: getColor(winningNumber) });
    }, 5200);
  };

  const renderWheelLabels = () => {
    const anglePerSlot = 360 / EUROPEAN_LAYOUT.length;
    return EUROPEAN_LAYOUT.map((num, idx) => {
      const angle = idx * anglePerSlot;
      const color = getColor(num);
      return (
        <span key={idx} className={`wheel-label wheel-label-${color}`} style={{
          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-114px) rotate(${-angle}deg)`,
        }}>{num}</span>
      );
    });
  };

  return (
    <div className="roulette-container space-y-6">
      <div className="roulette-stage">
        <div className="wheel-container">
          <div className="wheel-pointer"></div>
          <div ref={wheelRef} className={`wheel-outer ${isSpinning ? 'is-spinning' : ''}`}
            style={{ transform: `rotate(${rotation}deg)` }}>
            {renderWheelLabels()}
          </div>
          <div className={`wheel-inner win-${result?.color || ''}`}>
            {result ? result.number : '?'}
          </div>
        </div>

        {/* Betting Table */}
        <div className="mb-6">
          {/* Zero */}
          <div className="flex gap-px mb-px">
            <button onClick={() => addBet('number', 0, '0')}
              className="h-14 w-14 rounded text-white font-bold text-lg bg-emerald-700 hover:bg-emerald-600 transition-colors shrink-0">
              0
            </button>
            <div className="flex-1" />
          </div>
          {/* Number rows */}
          <div className="space-y-px mb-4">
            {TABLE_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-px">
                {row.map(num => {
                  const isSelected = bets.some(b => b.type === 'number' && b.value === num);
                  return (
                    <button key={num} onClick={() => addBet('number', num, String(num))}
                      className={`flex-1 h-10 rounded text-white font-bold text-sm transition-colors relative ${getColorClass(num)}`}>
                      {num}
                      {isSelected && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Outside bets */}
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-1">
            {OUTSIDE_BETS.map(ob => {
              const isSelected = bets.some(b => b.type === ob.type && b.value === ob.value);
              return (
                <button key={ob.value} onClick={() => addBet(ob.type, ob.value, ob.label)}
                  className={`h-10 rounded text-white font-bold text-xs transition-colors ${ob.color} ${isSelected ? 'ring-2 ring-yellow-400' : ''}`}>
                  {ob.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active bets */}
        {bets.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-slate-900/80 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-yellow-400">目前下注 (總計: {totalBet})</span>
              <button onClick={clearBets} className="text-xs text-red-400 hover:text-red-300">清除全部</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {bets.map((b, i) => (
                <span key={i} onClick={() => removeBet(i)}
                  className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-xs text-white hover:line-through">
                  {b.label}: {b.amount}
                  <span className="text-red-400 ml-1">✕</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="number" className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 p-2 text-white"
              value={betAmount} onChange={(e) => setBetAmount(e.target.value)}
              disabled={betMutation.isPending || isSpinning} />
            <BetQuickActions amount={betAmount} onChange={setBetAmount} disabled={betMutation.isPending || isSpinning} />
            <button className="bg-gold rounded px-8 py-2 font-bold text-black hover:opacity-90 disabled:opacity-50"
              onClick={() => betMutation.mutate()} disabled={betMutation.isPending || isSpinning || bets.length === 0}>
              {betMutation.isPending ? '處理中...' : '旋轉開獎'}
            </button>
          </div>
          <p className="text-xs text-slate-500">點擊數字或區域加入下注，點擊黃點可調整金額，點選注單可移除</p>
        </div>

        {error && <div className="mt-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">{error}</div>}

        {result && !isSpinning && (
          <div className="mt-4 p-4 rounded-lg bg-slate-900/80 border border-slate-700">
            <div className="text-center mb-2">
              <p className="text-lg font-bold text-white">結果: <span className={`text-${result.color === 'red' ? 'red' : result.color === 'black' ? 'white' : 'emerald'}-400`}>{result.number} ({result.color})</span></p>
            </div>
            {lastBets.length > 0 && (
              <div className="text-xs text-slate-400 text-center">
                你的下注: {lastBets.map(b => b.label).join('、')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
