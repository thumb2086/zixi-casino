import { useState, FormEvent, useCallback, useEffect } from 'react';
import { ArrowDownUp, Loader2, Coins } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppBottomNav from '../../components/AppBottomNav';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useWallet } from './useWallet';

const ZXC_PER_YJC = 100_000_000;

type Direction = 'zxc_to_yjc' | 'yjc_to_zxc';

function formatBalance(raw: string | undefined): string {
  if (!raw) return '0';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function SwapPanel({
  direction,
  inputAmount,
  submitting,
  result,
  zxcBalance,
  yjcBalance,
  isAuthorized,
  setDirection,
  setInputAmount,
  setResult,
  handleSwap,
  toggle,
}: {
  direction: Direction;
  inputAmount: string;
  submitting: boolean;
  result: string | null;
  zxcBalance: string;
  yjcBalance: string;
  loadingBalances: boolean;
  isAuthorized: boolean;
  setDirection: (d: Direction) => void;
  setInputAmount: (v: string) => void;
  setResult: (v: string | null) => void;
  handleSwap: (e: FormEvent) => Promise<void>;
  toggle: () => void;
}) {
  const inputNumeric = Number(inputAmount) || 0;
  const previewAmount =
    direction === 'zxc_to_yjc'
      ? Math.floor(inputNumeric / ZXC_PER_YJC)
      : inputNumeric * ZXC_PER_YJC;
  const fromSymbol = direction === 'zxc_to_yjc' ? 'ZXC' : 'YJC';
  const toSymbol = direction === 'zxc_to_yjc' ? 'YJC' : 'ZXC';
  const fromBalance = direction === 'zxc_to_yjc' ? zxcBalance : yjcBalance;
  const toBalance = direction === 'zxc_to_yjc' ? yjcBalance : zxcBalance;

  return (
    <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#fcc025]/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-white">?åÊ?</h2>
        <p className="text-xs font-black uppercase tracking-widest text-[#fcc025]">
          ?∫Â??ØÁ?Ôº? YJC = {ZXC_PER_YJC.toLocaleString()} ZXC
        </p>
      </div>

      {!isAuthorized && (
        <p className="text-sm text-[#adaaaa] mb-4">Ë´ãÂ??ªÂÖ•ÂæåÂ??åÊ???/p>
      )}

      <form onSubmit={handleSwap} className="space-y-4">
        <div className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#adaaaa]">?Ø‰?</span>
            <span className="text-xs text-[#adaaaa]">È§òÈ? {formatBalance(fromBalance)} {fromSymbol}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value.replace(/[^\d]/g, ''))}
              className="flex-1 bg-transparent text-2xl font-black italic text-white focus:outline-none"
              placeholder="0"
            />
            <span className="text-sm font-black text-[#fcc025]">{fromSymbol}</span>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={toggle}
            className="w-10 h-10 rounded-full bg-[#fcc025] text-[#0e0e0e] flex items-center justify-center"
            aria-label="?áÊ??πÂ?"
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        <div className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#adaaaa]">?∂Âà∞</span>
            <span className="text-xs text-[#adaaaa]">È§òÈ? {formatBalance(toBalance)} {toSymbol}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-2xl font-black italic text-[#fcc025]">
              {previewAmount > 0 ? previewAmount.toLocaleString() : '0'}
            </span>
            <span className="text-sm font-black text-[#fcc025]">{toSymbol}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !isAuthorized || inputNumeric <= 0 || previewAmount <= 0}
          className="w-full bg-[#fcc025] text-[#0e0e0e] font-black uppercase tracking-widest text-xs py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          Á¢∫Ë??åÊ?
        </button>

        {result && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#1a1919] border border-[#fcc025]/40 shadow-lg shadow-black/50 text-sm font-bold text-white animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">
            {result}
          </div>
        )}
      </form>

      <div className="mt-4 text-xs text-[#adaaaa] space-y-1">
        <p>???ØÁ??∫Â???1 YJC = {ZXC_PER_YJC.toLocaleString()} ZXCÔº? ?ÑÂ??ôÂπ£Ôº?/p>
        <p>???ãÁ?Ë≤ªÔ?0</p>
        <p>???ôÂ??åÊ?ÔºåÂ??õ‰ª•?¥Êï∏?∫ÂñÆ‰ΩçÔ?Â∞èÊï∏?®Â??™Â??®Âéª</p>
        <p>???åÊ??¥Êé•‰∏äÈ?ÔºåÊ?ÁµÇÈ?È°ç‰ª•?à‰?‰∫§Ê??∫Ê?</p>
      </div>
    </section>
  );
}

export default function SwapView() {
  const { t } = useTranslation();
  const { sessionId, isAuthorized } = useAuthStore();
  const { summary, convert } = useWallet();
  const [direction, setDirection] = useState<Direction>('zxc_to_yjc');
  const [inputAmount, setInputAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (result) { const t = setTimeout(() => setResult(null), 3000); return () => clearTimeout(t); }
  }, [result]);

  const s = summary.data;
  const zxcBalance = String(s?.balances?.zhixi?.balance ?? s?.summary?.balances?.ZXC ?? '0');
  const yjcBalance = String(s?.balances?.yjc?.balance ?? '0');

  const inputNumeric = Number(inputAmount) || 0;

  function toggle() {
    setDirection((d) => (d === 'zxc_to_yjc' ? 'yjc_to_zxc' : 'zxc_to_yjc'));
    setInputAmount('');
    setResult(null);
  }

  async function handleSwap(e: FormEvent) {
    e.preventDefault();
    if (!sessionId) {
      setResult('Ë´ãÂ??ªÂÖ•');
      return;
    }
    if (inputNumeric <= 0) {
      setResult('Ë´ãËº∏?•È?È°?);
      return;
    }
    if (direction === 'zxc_to_yjc' && inputNumeric < ZXC_PER_YJC) {
      setResult(`?ÄÂ∞?${ZXC_PER_YJC.toLocaleString()} ZXC ?çËÉΩ?åÊ? 1 YJC`);
      return;
    }
    if (direction === 'yjc_to_zxc' && inputNumeric < 1) {
      setResult('?ÄÂ∞?1 YJC ?çËÉΩ?åÊ?');
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      if (direction === 'zxc_to_yjc') {
        const data = await convert.mutateAsync({ zxcAmount: String(Math.floor(inputNumeric)) });
        setResult(`?åÊ??êÂ?Ôº?{data.requiredZxc} ZXC ??${data.yjcAmount} YJC`);
        setInputAmount('');
      } else {
        const res = await api.post('/api/v1/wallet/convert/yjc-to-zxc', {
          sessionId,
          yjcAmount: String(Math.floor(inputNumeric)),
        });
        const data = res.data?.data;
        if (data?.success) {
          setResult(`?åÊ??êÂ?Ôº?{data.yjcAmount} YJC ??${Number(data.zxcAmount).toLocaleString()} ZXC`);
          setInputAmount('');
        } else {
          setResult(data?.error?.message || '?åÊ?Â§±Ê?');
        }
      }
    } catch (err: any) {
      setResult(err?.response?.data?.data?.error?.message || err?.message || '?åÊ?Â§±Ê?');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-xl border-b border-[#494847]/15">
        <div className="flex items-center justify-between px-6 py-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <ArrowDownUp className="text-[#fcc025]" />
            <h1 className="font-extrabold tracking-tight text-xl text-[#fcc025] uppercase italic">?åÊ?</h1>
          </div>
        </div>
      </header>

      <main className="pt-12 px-6 max-w-2xl mx-auto space-y-6">
        <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 mt-16">
          <div className="flex items-center gap-2 mb-4">
            <Coins size={18} className="text-[#fcc025]" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">?ÆÂ?È§òÈ?</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
              <p className="text-xs font-black uppercase tracking-widest text-[#adaaaa]">ZXC Â≠êÁ?Âπ?/p>
              <p className="text-xl font-black italic mt-2 text-[#fcc025]">{formatBalance(zxcBalance)}</p>
            </div>
            <div className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
              <p className="text-xs font-black uppercase tracking-widest text-[#adaaaa]">YJC ‰ΩëÊà©Âπ?/p>
              <p className="text-xl font-black italic mt-2 text-[#fcc025]">{formatBalance(yjcBalance)}</p>
            </div>
          </div>
        </section>

        <SwapPanel
          direction={direction}
          inputAmount={inputAmount}
          submitting={submitting}
          result={result}
          zxcBalance={zxcBalance}
          yjcBalance={yjcBalance}
          isAuthorized={isAuthorized}
          setDirection={setDirection}
          setInputAmount={setInputAmount}
          setResult={setResult}
          handleSwap={handleSwap}
          toggle={toggle}
        />
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
