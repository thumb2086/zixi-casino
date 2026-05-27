import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../../store/api';
import './Slots.css';
import './CasinoCommon.css';
import { extractGameError, unwrapGameEnvelope } from './gameClient';
import { BetQuickActions } from './BetQuickActions';
import { formatNumber } from '@repo/shared';
import { useTranslation } from 'react-i18next';

const REEL_CELLS = [[0, 3, 6], [1, 4, 7], [2, 5, 8]];
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
const randomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
const REEL_DELAY_MS = 80;
const REEL_STOP_INTERVAL = 150;

export const SlotsView: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const spinningRef = useRef(false);
  const autoSpinRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [betAmount, setBetAmount] = useState('10');

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as { maxBet?: number } | undefined;
    },
    staleTime: 60000,
  });
  const maxBet = profile?.maxBet ?? 1_000_000;
  const [grid, setGrid] = useState<string[]>(['🍒', '🍋', '🍉', '⭐', '🔔', '💎', '7️⃣', '🍒', '🍋']);
  const [status, setStatus] = useState(t('casino_game.slots_ready'));
  const [winSymbols, setWinSymbols] = useState<number[]>([]);
  const [reelState, setReelState] = useState<('idle' | 'spinning' | 'stopped')[]>(['idle', 'idle', 'idle']);

  // Auto-spin
  const AUTO_OPTIONS = [5, 10, 25, 50];
  const [autoCount, setAutoCount] = useState(10);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const summaryRef = useRef({ spins: 0, wins: 0 });

  // Skip animation
  const skipSpinRef = useRef(false);
  const spinIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const spinResolveRef = useRef<((value: { won: boolean; payout: number }) => void) | null>(null);
  const [skipVisible, setSkipVisible] = useState(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  const skipAnimation = useCallback(() => {
    skipSpinRef.current = true;
    setSkipVisible(false);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    spinIntervalsRef.current.forEach(clearInterval);
    spinIntervalsRef.current = [];
    setReelState(['stopped', 'stopped', 'stopped']);
  }, []);

  const showResult = useCallback((result: any) => {
    setGrid(result.symbols || []);
    const won = result.multiplier > 0;
    if (won) {
      setStatus(t('casino_game.slots_win_result', { multiplier: result.multiplier, amount: formatNumber(result.payout || 0) }));
      setWinSymbols(result.winLines?.flat() || []);
    } else {
      setStatus(t('casino_game.slots_lose'));
    }
    summaryRef.current.spins += 1;
    if (won) summaryRef.current.wins += result.payout || 0;
    queryClient.invalidateQueries({ queryKey: ['user'] });
    queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    if (spinResolveRef.current) {
      spinResolveRef.current({ won, payout: result.payout || 0 });
      spinResolveRef.current = null;
    }
  }, [t, queryClient]);

  const startReelSpin = useCallback((reelIdx: number, intervalRefs: ReturnType<typeof setInterval>[]) => {
    setReelState((prev) => { const n = [...prev]; n[reelIdx] = 'spinning'; return n; });
    const iv = setInterval(() => {
      setGrid((g) => {
        const next = [...g];
        for (const cellIdx of REEL_CELLS[reelIdx]) next[cellIdx] = randomSymbol();
        return next;
      });
    }, 80);
    intervalRefs.push(iv);
  }, []);

  const stopReel = useCallback((reelIdx: number, finalSymbols: string[], intervalRefs: ReturnType<typeof setInterval>[]) => {
    const iv = intervalRefs[reelIdx];
    if (iv) clearInterval(iv);
    setGrid((g) => {
      const next = [...g];
      for (let i = 0; i < 3; i++) next[REEL_CELLS[reelIdx][i]] = finalSymbols[reelIdx * 3 + i];
      return next;
    });
    setReelState((prev) => { const n = [...prev]; n[reelIdx] = 'stopped'; return n; });
  }, []);

  const doSingleSpin = (): Promise<{ won: boolean; payout: number }> => {
    return new Promise((resolve, reject) => {
      skipSpinRef.current = false;
      setSkipVisible(true);
      spinResolveRef.current = resolve;
      const intervalRefs: ReturnType<typeof setInterval>[] = [];
      spinIntervalsRef.current = intervalRefs;
      setWinSymbols([]);
      setStatus(t('casino_game.slots_spinning'));

      startReelSpin(0, intervalRefs);
      const t1 = setTimeout(() => startReelSpin(1, intervalRefs), REEL_DELAY_MS);
      const t2 = setTimeout(() => startReelSpin(2, intervalRefs), REEL_DELAY_MS * 2);
      timersRef.current = [t1, t2];

      api.post('/api/v1/games/slots/play', {
        sessionId: session.id,
        betAmount: Number(betAmount),
      }).then((res) => {
        const payload = res.data;
        if (payload?.success === false) { reject(new Error(extractGameError(payload))); return; }
        const result = unwrapGameEnvelope<any>(payload);
        if (skipSpinRef.current) {
          showResult(result);
          return;
        }
        const stopDelay = REEL_STOP_INTERVAL;
        const t3 = setTimeout(() => stopReel(0, result.symbols, intervalRefs), stopDelay);
        const t4 = setTimeout(() => stopReel(1, result.symbols, intervalRefs), stopDelay + REEL_STOP_INTERVAL);
        const t5 = setTimeout(() => stopReel(2, result.symbols, intervalRefs), stopDelay + REEL_STOP_INTERVAL * 2);
        timersRef.current = [t3, t4, t5];
        setTimeout(() => {
          showResult(result);
        }, stopDelay + REEL_STOP_INTERVAL * 3);
      }).catch((err: any) => {
        intervalRefs.forEach(clearInterval);
        setSkipVisible(false);
        setReelState(['stopped', 'stopped', 'stopped']);
        reject(err);
      });
    }).finally(() => {
      setSkipVisible(false);
    });
  };

  const handleSpin = async () => {
    if (!session || spinningRef.current) return;
    spinningRef.current = true;
    try {
      await doSingleSpin();
    } catch (err: any) {
      setStatus(t('casino_game.slots_spin_error', { message: err?.message || '' }));
    }
    spinningRef.current = false;
  };

  const handleAutoSpin = async () => {
    if (!session || spinningRef.current) return;
    spinningRef.current = true;
    autoSpinRef.current = true;
    summaryRef.current = { spins: 0, wins: 0 };
    setAutoRemaining(autoCount);

    for (let i = 0; i < autoCount; i++) {
      if (!autoSpinRef.current) break;
      setAutoRemaining(autoCount - i - 1);
      try {
        await doSingleSpin();
      } catch (err: any) {
        setStatus(t('casino_game.slots_spin_error', { message: err?.message || '' }));
        break;
      }
      // Small pause between spins
      await new Promise((r) => setTimeout(r, 400));
    }

    autoSpinRef.current = false;
    spinningRef.current = false;
    setAutoRemaining(0);
    const s = summaryRef.current;
    setStatus(t('casino_game.slots_auto_end', { spins: s.spins, wins: formatNumber(s.wins || 0) }));
  };

  const cancelAutoSpin = () => {
    autoSpinRef.current = false;
  };

  return (
    <div className="slots-container">
      <div className="slots-board">
        <div className="slots-grid">
          {grid.map((symbol, i) => {
            const reelIdx = REEL_CELLS.findIndex((cells) => cells.includes(i));
            const spinning = reelState[reelIdx] === 'spinning';
            return (
              <div
                key={i}
                className={`slot-cell ${spinning ? 'spinning' : ''} ${winSymbols.includes(i) ? 'win' : ''}`}
              >
                {symbol}
              </div>
            );
          })}
        </div>
      </div>

      <div className="slot-controls">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          disabled={spinningRef.current}
          className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-lg text-white"
        />
        <BetQuickActions amount={betAmount} onChange={setBetAmount} maxBet={maxBet} />
      </div>

      <div className="flex gap-2 mt-2">
        {autoSpinRef.current ? (
          <button className="btn-spin flex-1 bg-red-600 hover:bg-red-700" onClick={cancelAutoSpin}>
            {t('casino_game.slots_stop_auto', { count: autoRemaining })}
          </button>
        ) : (
          <>
            <button className="btn-spin flex-1" onClick={handleSpin} disabled={spinningRef.current}>
              {spinningRef.current ? t('casino_game.slots_spinning_label') : t('casino_game.slots_start_spin')}
            </button>
            <div className="flex gap-1 items-center">
              {AUTO_OPTIONS.map((n) => (
                <button key={n} onClick={() => setAutoCount(n)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${autoCount === n ? 'bg-[#fcc025] text-black' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {n}
                </button>
              ))}
              <button className="btn-spin px-4 text-sm" onClick={handleAutoSpin} disabled={spinningRef.current}>
                {t('casino_game.slots_auto_x', { count: autoCount })}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="slots-status">{status}</div>

      {skipVisible && (
        <button
          className="fixed top-4 right-4 z-50 bg-[#fcc025] text-black font-black px-4 py-2 rounded-xl text-sm uppercase tracking-wider shadow-lg hover:bg-[#e6ad03] active:scale-95 transition-all"
          onClick={skipAnimation}
        >
          快速跳過 ⏭
        </button>
      )}
    </div>
  );
};
