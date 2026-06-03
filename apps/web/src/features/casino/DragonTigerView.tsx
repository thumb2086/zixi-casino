import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useAuth } from "../auth/useAuth";
import { api } from "../../store/api";
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

function CardView({ card }: { card?: { rank: string; suit: string } }) {
  if (!card) return <div className="h-20 w-14 rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 flex items-center justify-center text-accent">?</div>;
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div className="h-20 w-14 rounded-xl border border-border/40 bg-card shadow-lg flex flex-col items-center justify-center">
      <span className={`text-base font-black ${isRed ? 'text-danger' : 'text-white'}`}>{card.rank}</span>
      <span className={`text-xl ${isRed ? 'text-danger' : 'text-white'}`}>{card.suit}</span>
    </div>
  );
}

export default function DragonTigerView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [betAmount, setBetAmount] = useState("100");
  const [result, setResult] = useState<PlayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePlay = async () => {
    if (!session || loading) return;
    const amount = Number(betAmount);
    if (amount < 1) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.post("/api/v1/games/dragon-tiger/play", {
        sessionId: session.id,
        betAmount: amount,
      });
      const payload = res.data;
      if (!payload.success) {
        throw new Error(payload.error?.message || payload.error || "Request failed");
      }
      setResult(payload.data?.data || payload.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.error || e?.message || "Request failed");
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
        {/* Cards Display */}
        <section className="bg-card rounded-2xl p-6 border border-border/10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">龍門</p>
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-secondary uppercase">左</span>
              <CardView card={result?.left} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-secondary uppercase">右</span>
              <CardView card={result?.right} />
            </div>
          </div>
          {result && (
            <>
              <div className="flex justify-center mb-4">
                <CardView card={result.mid} />
              </div>
              <div className="space-y-1">
                <p className={`text-lg font-black ${result.isWin ? 'text-emerald-400' : result.result === 'draw' ? 'text-accent' : 'text-danger'}`}>
                  {result.result === 'win' ? `贏 ${result.payout.toLocaleString()} ZXC` : result.result === 'draw' ? '退回' : '輸了'}
                </p>
                <p className="text-xs text-secondary">
                  {result.result === 'win' ? `${result.multiplier}x 賠率（${result.lo}~${result.hi}）` : result.result === 'draw' ? '' : `${result.mid.rank} 不在 ${result.lo}~${result.hi} 範圍`}
                </p>
                <p className="text-xs text-secondary">餘額 {Number(result.balance).toLocaleString()} ZXC</p>
              </div>
            </>
          )}
        </section>

        {/* Bet Input */}
        <section className="bg-card rounded-2xl p-6 border border-border/10">
          <div className="flex items-center gap-3">
            <input
              type="number" min="1" value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              disabled={loading}
              placeholder="下注金額"
              className="flex-1 rounded-xl border border-border/20 bg-surface px-4 py-3 text-sm font-bold text-white outline-none focus:border-accent/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
