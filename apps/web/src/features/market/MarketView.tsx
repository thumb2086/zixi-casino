import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, ChevronDown,
  CircleDollarSign, LineChart,
  PanelLeftClose, PanelLeftOpen,
  TrendingDown, TrendingUp, Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@repo/shared';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import AppBottomNav from '../../components/AppBottomNav';
import { useMarket } from './useMarket';

type Quote = {
  symbol: string; name: string; price: number; type: string;
  sector: string; changePct: number;
};

type MarketActionParams =
  | { type: 'stock_buy' | 'stock_sell'; symbol: string; quantity: string }
  | { type: 'bank_deposit' | 'bank_withdraw' | 'loan_borrow' | 'loan_repay'; amount: string }
  | { type: 'futures_open'; symbol: string; side: string; amount: string; leverage: string; takeProfitPrice?: number; stopLossPrice?: number }
  | { type: 'futures_close'; positionId: string }
  | { type: 'futures_modify_tp_sl'; positionId: string; takeProfitPrice?: number; stopLossPrice?: number }
  | { type: 'loan_repay_all' };

function MiniChart({ data, color, height = 60, priceLines }: { data: number[]; color: string; height?: number; priceLines?: { price: number; color: string; label: string }[] }) {
  if (data.length < 2) return null;
  const w = 280;
  const allPrices = [...data, ...(priceLines?.map(p => p.price) || [])];
  const mn = Math.min(...allPrices), mx = Math.max(...allPrices);
  const range = mx - mn || 1;
  const path = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - mn) / range) * (height - 8) - 4;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {priceLines?.map((pl, i) => {
        const y = height - ((pl.price - mn) / range) * (height - 8) - 4;
        if (y < 0 || y > height) return null;
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={w} y2={y} stroke={pl.color} strokeWidth="1" strokeDasharray="4,3" opacity={0.7} />
            <rect x={w - 58} y={y - 7} width={58} height={14} rx={3} fill={pl.color} fillOpacity={0.9} />
            <text x={w - 4} y={y + 3.5} textAnchor="end" fill="#000" fontSize="9" fontWeight="bold">{pl.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PositionCard({ pos, runAction, execute, t, nf, onSelect }: { pos: any; runAction: any; execute: any; t: any; nf: any; onSelect: (symbol: string) => void }) {
  const [editTP, setEditTP] = useState(false);
  const [editSL, setEditSL] = useState(false);
  const [tpVal, setTpVal] = useState(pos.takeProfitPrice ?? '');
  const [slVal, setSlVal] = useState(pos.stopLossPrice ?? '');
  return (
    <div onClick={() => onSelect(pos.symbol)}
      className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3 cursor-pointer hover:border-[#fcc025]/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex items-center gap-2">
          <span className={`text-xs font-black px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {pos.side === 'long' ? t('market.long_badge') : t('market.short_badge')}
          </span>
          <p className="text-xs font-black text-white">{pos.symbol}</p>
          <span className="text-xs text-[#adaaaa]">{pos.leverage}x</span>
        </div>
        <div className="text-right shrink-0 ml-2 flex items-center gap-2">
          <p className={`text-xs font-black ${(pos.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}{nf(pos.unrealizedPnl || 0)}
          </p>
          <button onClick={() => runAction({ type: 'futures_close', positionId: pos.id }, t('market.position_closed'))}
            disabled={execute.isPending}
            className="text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg disabled:opacity-50">
            {t('market.close_position')}
          </button>
        </div>
      </div>
      <p className="text-xs text-[#adaaaa] mt-1">
        {t('market.position_detail', { entry: nf(pos.entryPrice), mark: nf(pos.markPrice ?? 0), liquidation: nf(pos.liquidationPrice) })}
      </p>
      <p className="text-sm text-[#adaaaa] mt-1">
        保證金: <span className="text-white font-bold text-base">{nf(pos.margin)} ZXC</span>
      </p>
      <div className="flex items-center gap-3 mt-1.5">
        <div className="flex-1">
          {editTP ? (
            <div className="flex items-center gap-1">
              <input type="number" step={0.01} value={tpVal} onChange={(e) => setTpVal(e.target.value)}
                className="w-20 bg-[#0e0e0e] border border-emerald-500/30 rounded px-1.5 py-0.5 text-xs text-emerald-400 outline-none" />
              <button onClick={() => { const v = Number(tpVal); if (tpVal === '' || v <= 0) { pos.takeProfitPrice = undefined; runAction({ type: 'futures_modify_tp_sl', positionId: pos.id, takeProfitPrice: undefined }, ''); } else { pos.takeProfitPrice = v; runAction({ type: 'futures_modify_tp_sl', positionId: pos.id, takeProfitPrice: v }, ''); } setEditTP(false); }}
                disabled={execute.isPending} className="text-xs font-bold text-emerald-400">✓</button>
              <button onClick={() => setEditTP(false)} className="text-xs text-[#adaaaa]">✕</button>
            </div>
          ) : (
            <button onClick={() => { setTpVal(pos.takeProfitPrice ?? ''); setEditTP(true); }}
              className="text-xs font-bold text-emerald-400">
              {t('market.take_profit')}{pos.takeProfitPrice ? ` ${nf(pos.takeProfitPrice)}` : ' —'}
            </button>
          )}
        </div>
        <div className="flex-1">
          {editSL ? (
            <div className="flex items-center gap-1">
              <input type="number" step={0.01} value={slVal} onChange={(e) => setSlVal(e.target.value)}
                className="w-20 bg-[#0e0e0e] border border-red-500/30 rounded px-1.5 py-0.5 text-xs text-red-400 outline-none" />
              <button onClick={() => { const v = Number(slVal); if (slVal === '' || v <= 0) { pos.stopLossPrice = undefined; runAction({ type: 'futures_modify_tp_sl', positionId: pos.id, stopLossPrice: undefined }, ''); } else { pos.stopLossPrice = v; runAction({ type: 'futures_modify_tp_sl', positionId: pos.id, stopLossPrice: v }, ''); } setEditSL(false); }}
                disabled={execute.isPending} className="text-xs font-bold text-red-400">✓</button>
              <button onClick={() => setEditSL(false)} className="text-xs text-[#adaaaa]">✕</button>
            </div>
          ) : (
            <button onClick={() => { setSlVal(pos.stopLossPrice ?? ''); setEditSL(true); }}
              className="text-xs font-bold text-red-400">
              {t('market.stop_loss')}{pos.stopLossPrice ? ` ${nf(pos.stopLossPrice)}` : ' —'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketView() {
  const { t } = useTranslation();
  const { snapshot, account, execute } = useMarket();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const marketSnapshot = snapshot.data;
  const summary = account.data;
  const stockSymbols: Quote[] = Object.values(marketSnapshot?.symbols || {});
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const selectedQuote = stockSymbols.find((q) => q.symbol === selectedSymbol) || null;
  const [tradeQuantity, setTradeQuantity] = useState('1');
  const [cashMoveAmount, setCashMoveAmount] = useState('1000');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Futures state
  const [futuresSide, setFuturesSide] = useState<'long' | 'short'>('long');
  const [futuresLeverage, setFuturesLeverage] = useState(5);
  const [futuresMargin, setFuturesMargin] = useState('1000');
  const [futuresTakeProfit, setFuturesTakeProfit] = useState('');
  const [futuresStopLoss, setFuturesStopLoss] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'spot' | 'futures' | 'bank'>('spot');
  const [showIndexChart, setShowIndexChart] = useState(true);
  const [showActivity, setShowActivity] = useState(false);
  const [showFloatingChart, setShowFloatingChart] = useState(true);

  useEffect(() => {
    if (actionNotice) { const t = setTimeout(() => setActionNotice(null), 3000); return () => clearTimeout(t); }
  }, [actionNotice]);

  useEffect(() => {
    setShowFloatingChart(true);
  }, [selectedSymbol]);

  const runAction = async (params: MarketActionParams, successMsg: string) => {
    try {
      const data = await execute.mutateAsync(params);
      if (params.type === 'futures_close' && data?.result?.realizedPnl !== undefined) {
        const pnl = data.result.realizedPnl;
        const sign = pnl >= 0 ? '+' : '';
        const label = pnl >= 0 ? 'success' : 'error';
        setActionNotice({ type: label, message: t('market.futures_closed', { pnl: `${sign}${nf(pnl)}` }) });
      } else {
        setActionNotice({ type: 'success', message: successMsg });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err?.message || t('market.action_failed') });
    }
  };

  const tabCls = (tab: 'spot' | 'futures' | 'bank') =>
    `flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${panelTab === tab ? 'bg-[#fcc025] text-black shadow' : 'text-[#adaaaa]'}`;

  const indexHistory: number[] = marketSnapshot?.marketHistory?.index || [];
  const indexColor = (marketSnapshot?.marketTrendPct || 0) >= 0 ? '#00f59b' : '#ff6d6d';

  const stockHistory: number[] = selectedQuote ? (marketSnapshot?.history?.[selectedQuote.symbol] || []) : [];
  const isUp = (selectedQuote?.changePct || 0) >= 0;
  const stockColor = isUp ? '#00f59b' : '#ff6d6d';

  const executionPanel = (
    <div className="h-full flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-[#0e0e0e] p-1 border border-[#494847]/20">
        <button onClick={() => setPanelTab('spot')} className={tabCls('spot')}>{t('market.spot')}</button>
        <button onClick={() => setPanelTab('futures')} className={tabCls('futures')}>{t('market.futures')}</button>
        <button onClick={() => setPanelTab('bank')} className={tabCls('bank')}>{t('market.bank')}</button>
      </div>

      {panelTab !== 'bank' && (
        <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}
          className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none">
          {stockSymbols.map((q) => (
            <option key={q.symbol} value={q.symbol}>{q.symbol} — {q.name}</option>
          ))}
        </select>
      )}

      {panelTab === 'spot' && (
        <div className="space-y-3">
          <input value={tradeQuantity} onChange={(e) => setTradeQuantity(e.target.value)}
            placeholder={t('market.quantity_placeholder')}
            className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
          {selectedQuote?.price && summary?.cash > 0 && (
            <button type="button" onClick={() => { const raw = Number(summary.cash / selectedQuote.price) * 0.998; setTradeQuantity(raw > 0 ? String(Math.floor(raw)) : '0'); }}
              className="w-full text-xs font-bold text-[#fcc025] py-2 rounded-lg border border-[#fcc025]/30 hover:bg-[#fcc025]/10">
              {t('market.buy_all_in')}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={execute.isPending}
              onClick={() => runAction({ type: 'stock_buy', symbol: selectedSymbol, quantity: tradeQuantity }, t('market.buy_success'))}
              className="rounded-2xl bg-[#fcc025] px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-black disabled:opacity-50">
              {t('market.buy', { symbol: selectedQuote?.symbol || selectedSymbol })}
            </button>
            <button type="button" disabled={execute.isPending}
              onClick={() => runAction({ type: 'stock_sell', symbol: selectedSymbol, quantity: tradeQuantity }, t('market.sell_success'))}
              className="rounded-2xl bg-[#ff7351] px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-50">
              {t('market.sell', { symbol: selectedQuote?.symbol || selectedSymbol })}
            </button>
          </div>
        </div>
      )}

      {panelTab === 'futures' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setFuturesSide('long')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${futuresSide === 'long' ? 'bg-emerald-500 text-white shadow' : 'bg-[#0e0e0e] text-[#adaaaa] border border-[#494847]/20'}`}>{t('market.go_long')}</button>
            <button onClick={() => setFuturesSide('short')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${futuresSide === 'short' ? 'bg-red-500 text-white shadow' : 'bg-[#0e0e0e] text-[#adaaaa] border border-[#494847]/20'}`}>{t('market.go_short')}</button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#adaaaa]">{t('market.leverage')}</span>
              <span className="text-xs font-black text-[#fcc025]">{futuresLeverage}x</span>
            </div>
            <input type="range" min={1} max={20} value={futuresLeverage} onChange={(e) => setFuturesLeverage(Number(e.target.value))}
              className="w-full accent-[#fcc025]" />
          </div>
          <div className="flex gap-2">
            <input type="number" min={10} value={futuresMargin} onChange={(e) => setFuturesMargin(e.target.value)}
              placeholder={t('market.margin')} className="flex-1 rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
            {summary?.cash > 0 && (
              <button type="button" onClick={() => setFuturesMargin(String(Math.floor(Number(summary.cash))))}
                className="text-xs font-bold text-[#fcc025] px-3 py-1 rounded-lg border border-[#fcc025]/30 hover:bg-[#fcc025]/10 whitespace-nowrap">
                {t('market.buy_all_in')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} step={0.01} value={futuresTakeProfit} onChange={(e) => setFuturesTakeProfit(e.target.value)}
              placeholder={t('market.take_profit')} className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
            <input type="number" min={0} step={0.01} value={futuresStopLoss} onChange={(e) => setFuturesStopLoss(e.target.value)}
              placeholder={t('market.stop_loss')} className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
          </div>
          <div className="text-xs text-[#adaaaa] space-y-1">
            <p>{t('market.notional_value', { value: nf(Number(futuresMargin || 0) * futuresLeverage) })}</p>
            <p>{t('market.liquidation_price', { value: futuresSide === 'long'
              ? nf(Math.round(Number(selectedQuote?.price || 0) * (1 - 0.96 / futuresLeverage)))
              : nf(Math.round(Number(selectedQuote?.price || 0) * (1 + 0.96 / futuresLeverage)))
            })}</p>
          </div>
          <button type="button" disabled={execute.isPending || !futuresMargin || Number(futuresMargin) < 10}
            onClick={() => runAction({
              type: 'futures_open', symbol: selectedSymbol, side: futuresSide,
              amount: futuresMargin, leverage: String(futuresLeverage),
              ...(futuresTakeProfit ? { takeProfitPrice: Number(futuresTakeProfit) } : {}),
              ...(futuresStopLoss ? { stopLossPrice: Number(futuresStopLoss) } : {}),
            }, t('market.futures_open_success', { side: futuresSide }))} 
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-50 hover:brightness-110">
            {t('market.open_position', { side: futuresSide, symbol: selectedSymbol })}
          </button>
        </div>
      )}

      {panelTab === 'bank' && (
        <div className="space-y-3">
          {summary && (
            <div className="flex items-center justify-between rounded-xl bg-[#0e0e0e] border border-[#494847]/10 px-4 py-2.5 text-xs">
              <span className="text-[#adaaaa]">可用現金</span>
              <span className="font-black text-white">{nf(summary.cash)} ZXC</span>
            </div>
          )}
          {summary && (
            <div className="flex items-center justify-between rounded-xl bg-[#0e0e0e] border border-[#494847]/10 px-4 py-2.5 text-xs">
              <span className="text-[#adaaaa]">銀行餘額</span>
              <span className="font-black text-emerald-400">{nf(summary.bankBalance)} ZXC</span>
            </div>
          )}
          <div className="flex gap-2">
            <input type="number" min="1" value={cashMoveAmount} onChange={(e) => setCashMoveAmount(e.target.value)}
              placeholder={t('market.amount')} className="flex-1 rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
            <button type="button" onClick={() => setCashMoveAmount(String(Math.floor(Number(summary?.cash || 0))))}
              className="text-xs font-bold text-[#fcc025] px-3 py-1 rounded-lg border border-[#fcc025]/30 hover:bg-[#fcc025]/10">全部存入</button>
            <button type="button" onClick={() => setCashMoveAmount(String(Math.floor(Number(summary?.bankBalance || 0))))}
              className="text-xs font-bold text-emerald-400 px-3 py-1 rounded-lg border border-emerald-400/30 hover:bg-emerald-400/10">全部領出</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={execute.isPending}
              onClick={() => runAction({ type: 'bank_deposit', amount: cashMoveAmount }, t('market.deposit_success'))}
              className="rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-emerald-500">{t('market.bank_deposit')}</button>
            <button type="button" disabled={execute.isPending}
              onClick={() => runAction({ type: 'bank_withdraw', amount: cashMoveAmount }, t('market.withdraw_success'))}
              className="rounded-xl bg-amber-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-amber-500">{t('market.bank_withdraw')}</button>
          </div>
          <div className="rounded-xl bg-[#0e0e0e] border border-[#494847]/10 px-4 py-2.5 text-[10px] text-[#adaaaa] leading-relaxed">
            <p>🏦 銀行年利率 <span className="text-emerald-400 font-bold">2% APY</span>（按實際持有時間複利）</p>
            <p>💰 貸款年利率 <span className="text-amber-400 font-bold">4% APR</span>（按實際借款時間計息）</p>
          </div>
          <div className="border-t border-[#494847]/10 pt-3">
            <p className="text-xs font-bold text-[#adaaaa] mb-2">貸款</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" disabled={execute.isPending}
                onClick={() => runAction({ type: 'loan_borrow', amount: cashMoveAmount }, t('market.loan_success'))}
                className="rounded-xl bg-violet-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-violet-500">{t('market.loan_borrow_label')}</button>
              <button type="button" disabled={execute.isPending}
                onClick={() => runAction({ type: 'loan_repay', amount: cashMoveAmount }, t('market.repay_success'))}
                className="rounded-xl bg-slate-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-slate-500">{t('market.repay_label')}</button>
              <button type="button" disabled={execute.isPending}
                onClick={() => runAction({ type: 'loan_repay_all' }, t('market.repay_all_success'))}
                className="rounded-xl bg-amber-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-amber-500">{t('market.repay_all_label')}</button>
            </div>
            {summary && summary.loanPrincipal > 0 && (
              <p className="text-xs text-[#adaaaa] mt-2">當前貸款: {nf(summary.loanPrincipal)} ZXC</p>
            )}
            {summary && summary.maxBorrow > 0 && (
              <p className="text-xs text-[#adaaaa]">可借上限: {nf(summary.maxBorrow)} ZXC</p>
            )}
          </div>
        </div>
      )}

      {panelTab !== 'bank' && selectedQuote && (
        <div className="border-t border-[#494847]/10 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-white">{selectedQuote.symbol}</span>
            <div className="text-right">
              <p className="text-sm font-black italic tracking-tight text-[#fcc025]">{nf(Number(selectedQuote.price || 0))}</p>
              <p className={`text-xs font-black ${isUp ? 'text-emerald-400' : 'text-[#ff7351]'}`}>
                {isUp ? '+' : ''}{selectedQuote.changePct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-[#fcc025]" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">{t('market.title')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileDrawerOpen(o => !o)} className="lg:hidden text-xs font-black uppercase tracking-[0.18em] text-[#fcc025]">
              {mobileDrawerOpen ? t('market.close_order') : t('market.place_order')}
            </button>
            <Link to="/app/transactions" className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa] hidden sm:inline">
              {t('market.public_feed')}
            </Link>
            <div className="hidden lg:flex items-center gap-2">
              <button onClick={() => setShowActivity(!showActivity)}
                className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa] hover:text-white">
                <Clock size={14} className="inline mr-1" />活動
              </button>
            </div>
          </div>
        </div>
      </header>

      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileDrawerOpen(false)} />
          <div className="absolute left-0 top-16 bottom-24 w-80 max-w-[85vw] bg-[#1a1919] border-r border-[#494847]/10 p-5 overflow-y-auto shadow-2xl">
            <div className="flex justify-end mb-3">
              <button onClick={() => setMobileDrawerOpen(false)} className="text-xs text-[#adaaaa]">✕ {t('market.close')}</button>
            </div>
            {executionPanel}
          </div>
        </div>
      )}

      <main className="mx-auto flex max-w-7xl gap-6 px-6 pt-24">
        <aside className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
          <div className={`sticky top-24 rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-5 shadow-2xl ${sidebarOpen ? '' : 'hidden'}`}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSidebarOpen(false)} className="text-[#adaaaa] hover:text-white">
                <PanelLeftClose size={16} />
              </button>
            </div>
            {executionPanel}
          </div>
        </aside>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="hidden lg:flex sticky top-24 self-start mt-2 rounded-r-xl border border-l-0 border-[#494847]/10 bg-[#1a1919] px-2 py-6 text-[#adaaaa] hover:text-white">
            <PanelLeftOpen size={18} />
          </button>
        )}

        <div className="flex-1 min-w-0 space-y-6">
          {actionNotice && (
            <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#1a1919] border shadow-lg shadow-black/50 text-sm font-bold animate-[fadeIn_0.3s_ease-out] whitespace-nowrap ${
              actionNotice.type === 'success' ? 'border-emerald-400/40 text-emerald-300' : 'border-red-400/40 text-red-400'
            }`}>
              {actionNotice.type === 'success' ? '✅ ' : '❌ '}{actionNotice.message}
            </div>
          )}

          {/* Market Pulse + Index Chart */}
          <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <CircleDollarSign className="text-[#fcc025]" size={18} />
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.market_pulse')}</h2>
              <button onClick={() => setShowIndexChart(!showIndexChart)}
                className="ml-auto text-xs font-bold text-[#fcc025] bg-[#fcc025]/10 px-2.5 py-1 rounded-lg hover:bg-[#fcc025]/20 transition-colors">
                <LineChart size={14} className="inline mr-1" />{showIndexChart ? '隱藏' : '圖表'}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.market_index')}</p>
                <p className="mt-1 text-3xl font-black italic tracking-tight text-[#fcc025]">{nf(marketSnapshot?.marketIndex || 0)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.trend')}</p>
                <p className={`mt-1 text-2xl font-black italic tracking-tight ${(marketSnapshot?.marketTrendPct || 0) >= 0 ? 'text-emerald-400' : 'text-[#ff7351]'}`}>
                  {(marketSnapshot?.marketTrendPct || 0) >= 0 ? '+' : ''}{(marketSnapshot?.marketTrendPct || 0).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.fear_greed')}</p>
                <p className="mt-1 text-2xl font-black italic tracking-tight text-white">{marketSnapshot?.fearGreedIndex ?? 0}</p>
              </div>
            </div>

            {showIndexChart && indexHistory.length > 1 && (
              <div className="border-t border-[#494847]/10 pt-4">
                <svg viewBox="0 0 800 200" className="w-full" style={{ height: 200 }}>
                  <defs>
                    <linearGradient id="indexGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={indexColor} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={indexColor} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const w = 800, h = 200;
                    const mn = Math.min(...indexHistory), mx = Math.max(...indexHistory);
                    const range = mx - mn || 1;
                    const pts = indexHistory.map((v, i) => {
                      const x = (i / (indexHistory.length - 1)) * w;
                      const y = h - ((v - mn) / range) * (h - 20) - 10;
                      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                    }).join(' ');
                    const areaPts = pts + ` L${w},${h} L0,${h} Z`;
                    return (
                      <>
                        <path d={areaPts} fill="url(#indexGrad)" />
                        <path d={pts} fill="none" stroke={indexColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    );
                  })()}
                </svg>
                <div className="flex justify-between mt-1 text-[10px] text-[#494847]">
                  <span>{(marketSnapshot?.updatedAt ? new Date(marketSnapshot.updatedAt).getTime() - 48 * 60000 : Date.now() - 48 * 60000).toLocaleString()}</span>
                  <span>{marketSnapshot?.updatedAt ? new Date(marketSnapshot.updatedAt).toLocaleString() : ''}</span>
                </div>
              </div>
            )}
          </section>

          {/* Account + Net Worth */}
          <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4 sm:col-span-1">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.net_worth')}</p>
                <p className="mt-1 text-2xl font-black italic tracking-tight text-[#fcc025]">{nf(summary?.netWorth || 0)}</p>
              </div>
              <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.cash')}</p>
                <p className="mt-1 text-xl font-black text-white">{nf(summary?.cash || 0)}</p>
              </div>
              <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.bank')}</p>
                <p className="mt-1 text-xl font-black text-white">{nf(summary?.bankBalance || 0)}</p>
              </div>
              <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">股票</p>
                <p className="mt-1 text-xl font-black text-white">{nf(summary?.stockValue || 0)}</p>
              </div>
            </div>
            {summary && (summary.loanPrincipal > 0 || summary.maxBorrow > 0) && (
              <div className="mt-3 flex items-center gap-4 text-xs text-[#adaaaa]">
                <span>貸款: {nf(summary.loanPrincipal)}</span>
                <span>最大可借: {nf(summary.maxBorrow)}</span>
              </div>
            )}
          </section>

          {/* Portfolio */}
          {(summary?.futuresPositions?.length > 0 || summary?.stockPositions?.length > 0) && (
            <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa] mb-4">{t('market.portfolio')}</h2>
              {summary?.futuresPositions?.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#adaaaa]">{t('market.futures')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#adaaaa]">{t('market.margin_label', { value: nf(summary.usedFuturesMargin || 0) })}</span>
                      {summary.futuresPositions.length > 1 && (
                        <button onClick={async () => {
                          let lastErr: any = null;
                          let totalPnl = 0;
                          for (const pos of summary.futuresPositions) {
                            try { const d = await execute.mutateAsync({ type: 'futures_close', positionId: pos.id } as any); if (d?.result?.realizedPnl !== undefined) totalPnl += d.result.realizedPnl; }
                            catch (e: any) { lastErr = e; }
                          }
                          const sign = totalPnl >= 0 ? '+' : '';
                          const label = totalPnl >= 0 ? 'success' : 'error';
                          setActionNotice({ type: lastErr ? 'error' : label, message: lastErr?.message || t('market.bulk_close_result', { count: summary.futuresPositions.length, pnl: `${sign}${nf(totalPnl)}` }) });
                        }} disabled={execute.isPending}
                          className="text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg disabled:opacity-50">
                          {t('market.close_all')}
                         </button>
                      )}
                    </div>
                  </div>
                  {summary.futuresUnrealizedPnl !== undefined && (
                    <div className={`text-xs font-bold mb-2 ${(summary.futuresUnrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t('market.unrealized_pnl', { value: `${(summary.futuresUnrealizedPnl || 0) >= 0 ? '+' : ''}${nf(summary.futuresUnrealizedPnl || 0)}` })}
                    </div>
                  )}
                  <div className="space-y-2">
                    {summary.futuresPositions.map((pos: any) => (
                      <PositionCard key={pos.id} pos={pos} runAction={runAction} execute={execute} t={t} nf={nf} onSelect={setSelectedSymbol} />
                    ))}
                  </div>
                </div>
              )}
              {summary?.stockPositions?.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-[#adaaaa] block mb-2">{t('market.stocks')}</span>
                  <div className="space-y-2">
                    {summary.stockPositions.map((pos: any) => (
                      <div key={pos.symbol}
                        onClick={() => setSelectedSymbol(pos.symbol)}
                        className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3 cursor-pointer hover:border-[#fcc025]/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-white">{pos.symbol} <span className="text-xs font-bold text-[#adaaaa]">×{nf(pos.quantity)}</span></p>
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-black ${(pos.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}{nf(pos.unrealizedPnl || 0)}
                            </p>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedSymbol(pos.symbol); setTradeQuantity(pos.quantity.toString()); }}
                              className="text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded disabled:opacity-50 hover:bg-red-500/30">
                              {t('market.sell_all')}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-[#adaaaa] mt-0.5">{t('market.market_value', { value: nf(pos.marketValue) })}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Stock grid */}
          <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="text-[#fcc025]" size={18} />
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.symbols')}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {stockSymbols.map((quote) => (
                <button key={quote.symbol} type="button" onClick={() => { setSelectedSymbol(quote.symbol); }}
                  className={`rounded-xl border p-3 text-left transition-all ${selectedSymbol === quote.symbol ? 'border-[#fcc025]/55 bg-[#121212]' : 'border-[#494847]/10 bg-[#141414] hover:border-[#fcc025]/20'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black uppercase tracking-[0.1em] text-white truncate">{quote.symbol}</p>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${(quote.changePct || 0) >= 0 ? 'bg-emerald-400/15 text-emerald-400' : 'bg-[#ff7351]/15 text-[#ff7351]'}`}>
                          {(quote.changePct || 0) >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#aeb7c9] truncate">{quote.name}</p>
                    </div>
                    {(quote.changePct || 0) >= 0 ? <TrendingUp className="text-emerald-400 shrink-0" size={16} /> : <TrendingDown className="text-[#ff7351] shrink-0" size={16} />}
                  </div>
                  <p className="mt-2 text-base font-black italic tracking-tight text-[#fcc025]">{nf(Number(quote.price || 0))}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Recent Activity (collapsible) */}
          <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
            <button onClick={() => setShowActivity(!showActivity)}
              className="w-full flex items-center gap-3">
              <Clock className="text-[#fcc025]" size={18} />
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.recent_activity')}</h2>
              <ChevronDown size={14} className={`ml-auto text-[#494847] transition-transform ${showActivity ? 'rotate-0' : '-rotate-90'}`} />
            </button>
            {showActivity && (
              <div className="mt-4 space-y-3">
                {summary?.history?.length ? (
                  summary.history.map((entry: any, index: number) => (
                    <div key={`${entry.at}-${index}`} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-white">{entry.summary || entry.type}</p>
                      <p className="mt-1 text-xs font-bold text-[#adaaaa]">{new Date(entry.at).toLocaleString('zh-TW')}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[#494847]/20 p-4 text-sm text-[#adaaaa]">{t('market.no_activity')}</div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Draggable floating stock chart */}
      {selectedQuote && stockHistory.length > 1 && showFloatingChart && (
        <div className="fixed z-40 w-80 rounded-xl border border-[#494847]/15 bg-[#1a1919]/95 backdrop-blur-xl shadow-2xl lg:w-96"
          style={{ right: 16, bottom: 96 }}>
          <div className="flex items-center justify-between p-3 pb-0">
            <p className="text-xs font-black text-white">{selectedQuote.symbol}</p>
            <p className={`text-xs font-black ${isUp ? 'text-emerald-400' : 'text-[#ff7351]'}`}>
              {nf(Number(selectedQuote.price || 0))} ({isUp ? '+' : ''}{selectedQuote.changePct.toFixed(2)}%)
            </p>
          </div>
          <div className="px-3 pb-3">
            {(() => {
              const fp = account.data?.futuresPositions?.find((p: any) => p.symbol === selectedQuote.symbol);
              const lines: { price: number; color: string; label: string }[] = [];
              if (fp) {
                lines.push({ price: fp.entryPrice, color: '#3b82f6', label: t('market.chart_entry') });
                if (fp.takeProfitPrice) lines.push({ price: fp.takeProfitPrice, color: '#10b981', label: t('market.chart_tp') });
                if (fp.stopLossPrice) lines.push({ price: fp.stopLossPrice, color: '#ef4444', label: t('market.chart_sl') });
                lines.push({ price: fp.liquidationPrice, color: '#f59e0b', label: t('market.chart_liq') });
              }
              lines.push({ price: Number(selectedQuote.price || 0), color: '#adaaaa', label: t('market.chart_mark') });
              return <MiniChart data={stockHistory} color={stockColor} height={180} priceLines={lines} />;
            })()}
          </div>
          <button onClick={() => setShowFloatingChart(false)}
            className="absolute top-1 right-2 text-xs text-[#adaaaa] hover:text-white">✕</button>
        </div>
      )}

      <AppBottomNav current="market" />
    </div>
  );
}
