import { useState, FormEvent, useEffect } from 'react';
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
  setInputAmount,
  handleSwap,
  toggle,
}: {
  direction: Direction;
  inputAmount: string;
  submitting: boolean;
  result: string | null;
  zxcBalance: string;
  yjcBalance: string;
  isAuthorized: boolean;
  setInputAmount: (v: string) => void;
  handleSwap: (e: FormEvent) => Promise<void>;
  toggle: () => void;
}) {
  const { t } = useTranslation();
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
    <section className="bg-card rounded-2xl p-6 border border-accent/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-white">{t('swap.title')}</h2>
        <p className="text-xs font-black uppercase tracking-widest text-accent">
          {t('swap.fixed_rate', { rate: ZXC_PER_YJC.toLocaleString() })}
        </p>
      </div>

      {!isAuthorized && (
        <p className="text-sm text-secondary mb-4">{t('swap.login_first')}</p>
      )}

      <form onSubmit={handleSwap} className="space-y-4">
        <div className="bg-surface rounded-xl p-4 border border-border/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-secondary">{t('swap.pay')}</span>
            <span className="text-xs text-secondary">{t('swap.balance', { amount: formatBalance(fromBalance), symbol: fromSymbol })}</span>
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
            <span className="text-sm font-black text-accent">{fromSymbol}</span>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={toggle}
            className="w-10 h-10 rounded-full bg-accent text-[#0e0e0e] flex items-center justify-center"
            aria-label={t('swap.toggle_direction')}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-secondary">{t('swap.receive')}</span>
            <span className="text-xs text-secondary">{t('swap.balance', { amount: formatBalance(toBalance), symbol: toSymbol })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-2xl font-black italic text-accent">
              {previewAmount > 0 ? previewAmount.toLocaleString() : '0'}
            </span>
            <span className="text-sm font-black text-accent">{toSymbol}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !isAuthorized || inputNumeric <= 0 || previewAmount <= 0}
          className="w-full bg-accent text-[#0e0e0e] font-black uppercase tracking-widest text-xs py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          {t('swap.confirm')}
        </button>

        {result && (
          <div className="mt-4 px-6 py-3 rounded-xl bg-card border border-accent/40 shadow-lg shadow-black/50 text-sm font-bold text-white whitespace-nowrap text-center">
            {result}
          </div>
        )}
      </form>

      <div className="mt-4 text-xs text-secondary space-y-1">
        <p>{t('swap.bullet_fixed_rate', { rate: ZXC_PER_YJC.toLocaleString() })}</p>
        <p>{t('swap.bullet_zero_fee')}</p>
        <p>{t('swap.bullet_bidirectional')}</p>
        <p>{t('swap.bullet_onchain')}</p>
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
  const yjcBalance = String(s?.onchain?.yjc?.balance ?? s?.summary?.balances?.YJC ?? '0');

  const inputNumeric = Number(inputAmount) || 0;

  function toggle() {
    setDirection((d) => (d === 'zxc_to_yjc' ? 'yjc_to_zxc' : 'zxc_to_yjc'));
    setInputAmount('');
    setResult(null);
  }

  async function handleSwap(e: FormEvent) {
    e.preventDefault();
    if (!sessionId) {
      setResult(t('swap.error_login'));
      return;
    }
    if (inputNumeric <= 0) {
      setResult(t('swap.error_amount'));
      return;
    }
    if (direction === 'zxc_to_yjc' && inputNumeric < ZXC_PER_YJC) {
      setResult(t('swap.error_min_zxc', { rate: ZXC_PER_YJC.toLocaleString() }));
      return;
    }
    if (direction === 'yjc_to_zxc' && inputNumeric < 1) {
      setResult(t('swap.error_min_yjc'));
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      if (direction === 'zxc_to_yjc') {
        const data = await convert.mutateAsync({ zxcAmount: String(Math.floor(inputNumeric)) });
        setResult(t('swap.success_zxc_to_yjc', { zxc: data.requiredZxc, yjc: data.yjcAmount }));
        setInputAmount('');
      } else {
        const res = await api.post('/api/v1/wallet/convert/yjc-to-zxc', {
          sessionId,
          yjcAmount: String(Math.floor(inputNumeric)),
        });
        const data = res.data?.data;
        if (data?.success) {
          setResult(t('swap.success_yjc_to_zxc', { yjc: data.yjcAmount, zxc: Number(data.zxcAmount).toLocaleString() }));
          setInputAmount('');
        } else {
          setResult(data?.error?.message || t('swap.failed'));
        }
      }
    } catch (err: any) {
      setResult(err?.response?.data?.data?.error?.message || err?.message || t('swap.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-border/15">
        <div className="flex items-center justify-between px-6 py-4 ">
          <div className="flex items-center gap-4">
            <ArrowDownUp className="text-accent" />
            <h1 className="font-extrabold tracking-tight text-xl text-accent uppercase italic">{t('swap.heading')}</h1>
          </div>
        </div>
      </header>

      <main className="pt-12 px-6 space-y-6">
        <section className="bg-card rounded-2xl p-6 border border-border/20 mt-16">
          <div className="flex items-center gap-2 mb-4">
            <Coins size={18} className="text-accent" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">{t('swap.balance_title')}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface rounded-xl p-4 border border-border/20">
              <p className="text-xs font-black uppercase tracking-widest text-secondary">{t('swap.zxc_label')}</p>
              <p className="text-xl font-black italic mt-2 text-accent">{formatBalance(zxcBalance)}</p>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border/20">
              <p className="text-xs font-black uppercase tracking-widest text-secondary">{t('swap.yjc_label')}</p>
              <p className="text-xl font-black italic mt-2 text-accent">{formatBalance(yjcBalance)}</p>
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
          setInputAmount={setInputAmount}
          handleSwap={handleSwap}
          toggle={toggle}
        />
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
