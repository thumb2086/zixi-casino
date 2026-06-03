import { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from "../auth/useAuth";
import { api } from "../../store/api";
import { formatNumber } from '@repo/shared';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import "./DragonTiger.css";
import AppBottomNav from "../../components/AppBottomNav";

type PlayResult = {
  roundId: string;
  left: { rank: string; suit: string };
  right: { rank: string; suit: string };
  mid: { rank: string; suit: string };
  lo: number; hi: number; range: number;
  multiplier: number;
  result: 'win' | 'lose' | 'draw';
  isWin: boolean;
  payout: number;
  betAmount: number;
  balance: number;
};

function CardView({ card, hidden, small }: { card?: { rank: string; suit: string }; hidden?: boolean; small?: boolean }) {
  if (!card || hidden) {
    return <div className={`rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 ${small ? 'h-14 w-10' : 'h-20 w-14'} flex items-center justify-center`}>?</div>;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div className={`rounded-xl border border-border/40 bg-card shadow-lg ${small ? 'h-14 w-10' : 'h-20 w-14'} flex flex-col items-center justify-center`}>
      <span className={`${small ? 'text-xs' : 'text-base'} font-black ${isRed ? 'text-danger' : 'text-white'}`}>{card.rank}</span>
      <span className={`${small ? 'text-sm' : 'text-xl'} ${isRed ? 'text-danger' : 'text-white'}`}>{card.suit}</span>
    </div>
  );
}

export default function DragonTigerView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState("");
  const [showAnimation, setShowAnimation] = useState(false);

  const { data: walletData } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: async () => {
      const res = await api.get('/api/v1/wallet/summary', { params: { sessionId: session?.id } });
      return res.data?.data;
    },
    enabled: Boolean(session?.id),
    refetchInterval: 30000,
  });
  const walletBalance = walletData?.summary?.balances?.ZXC || walletData?.assets?.walletBalance?.ZXC || '0';

  const handlePlay = async () => {
    if (!session || loading) return;
    const amount = Number(betAmount);
    if (amount < 1) return;
    setLoading(true);
    setError("");
    setResult(null);
    setShowAnimation(false);
    try {
      const res = await api.post("/api/v1/games/dragon-tiger/play", {
        sessionId: session.id,
        betAmount: amount,
        token: "zhixi"
      });
      const payload = res.data;
      if (payload?.success === false) {
        throw new Error(payload.error || "Request failed");
      }
      const data = payload?.data?.data || payload?.data || payload;
      setResult(data);
      setTimeout(() => setShowAnimation(true), 100);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: '#080810' }}>
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">射龍門</h1>
          <span className="text-xs font-bold text-secondary">{t('game.dragon')}</span>
        </div>
      </header>

      <main className="app-shell pt-24 space-y-6">
        {/* Wallet Balance */}
        <section className="bg-card rounded-2xl p-4 border border-border/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">可用餘額</span>
          <span className="text-sm font-black text-accent">{nf(walletBalance)} ZXC</span>
        </section>

        {/* Gate Display */}
        <section className="bg-card rounded-2xl p-6 border border-border/10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">龍門</p>
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-secondary uppercase">左</span>
              <CardView card={result?.left} hidden={!result} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-secondary uppercase">右</span>
              <CardView card={result?.right} hidden={!result} />
            </div>
          </div>
          {result && (
            <div className="mt-3 text-xs text-secondary">
              範圍 {result.lo} ~ {result.hi}（差 {result.range}）
            </div>
          )}
        </section>

        {/* Mid Card (Shot) */}
        <section className="bg-card rounded-2xl p-6 border border-border/10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">射門</p>
          <div className="flex justify-center">
            <div className={`transition-all duration-500 ${showAnimation ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
              <CardView card={result?.mid} hidden={!result || !showAnimation} />
            </div>
          </div>
          {result && showAnimation && (
            <div className="mt-4 space-y-2">
              <p className={`text-2xl font-black ${result.isWin ? 'text-emerald-400' : result.result === 'draw' ? 'text-accent' : 'text-danger'}`}>
                {result.result === 'win' ? `贏 ${result.payout.toLocaleString()} ZXC` : result.result === 'draw' ? '退回' : '輸了'}
              </p>
              <p className="text-sm text-secondary">
                {result.isWin ? `${result.multiplier}x 賠率` : result.result === 'draw' ? '' : `${result.mid.rank} 不在 ${result.lo}~${result.hi} 內`}
              </p>
            </div>
          )}
        </section>

        {/* Bet Input */}
        <section className="bg-card rounded-2xl p-6 border border-border/10">
          <div className="flex items-center gap-3">
            <input
              type="number" min="1" value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              disabled={loading}
              className="flex-1 rounded-xl border border-border/20 bg-surface px-4 py-3 text-sm font-bold text-white outline-none focus:border-accent/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="下注金額"
            />
            <button
              onClick={handlePlay}
              disabled={loading || !betAmount || Number(betAmount) < 1}
              className="rounded-xl bg-accent px-8 py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading ? '射門中...' : '射門'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
        </section>
      </main>

      <AppBottomNav current="casino" />
    </div>
  );
}
