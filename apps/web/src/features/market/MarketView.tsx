import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Landmark,
  LineChart,
  PanelRightClose,
  PanelRightOpen,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@repo/shared';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import AppBottomNav from '../../components/AppBottomNav';
import { useMarket } from './useMarket';

type Quote = {
  symbol: string;
  name: string;
  price: number;
  type: string;
  sector: string;
  changePct: number;
};

type MarketActionParams =
  | { type: 'stock_buy' | 'stock_sell'; symbol: string; quantity: string }
  | { type: 'bank_deposit' | 'bank_withdraw'; amount: string }
  | { type: 'futures_open'; symbol: string; side: string; amount: string; leverage: string; takeProfitPrice?: number; stopLossPrice?: number }
  | { type: 'futures_close'; positionId: string };

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
  const [tradeMode, setTradeMode] = useState<'spot' | 'futures'>('spot');
  const [futuresSide, setFuturesSide] = useState<'long' | 'short'>('long');
  const [futuresLeverage, setFuturesLeverage] = useState(5);
  const [futuresMargin, setFuturesMargin] = useState('1000');
  const [futuresTakeProfit, setFuturesTakeProfit] = useState('');
  const [futuresStopLoss, setFuturesStopLoss] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<'spot' | 'futures' | 'bank'>('spot');

  useEffect(() => {
    if (actionNotice) { const t = setTimeout(() => setActionNotice(null), 3000); return () => clearTimeout(t); }
  }, [actionNotice]);

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

  const executionPanel = (
    <div className="h-full flex flex-col gap-4">
      {/* Tabs: Spot / Futures / Bank */}
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

      {/* --- Spot tab --- */}
      {panelTab === 'spot' && (
        <div className="space-y-3">
          <input value={tradeQuantity} onChange={(e) => setTradeQuantity(e.target.value)}
            placeholder={t('market.quantity_placeholder')}
            className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
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

      {/* --- Futures tab --- */}
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
              <span className="text-[10px] font-bold text-[#adaaaa]">{t('market.leverage')}</span>
              <span className="text-xs font-black text-[#fcc025]">{futuresLeverage}x</span>
            </div>
            <input type="range" min={1} max={20} value={futuresLeverage} onChange={(e) => setFuturesLeverage(Number(e.target.value))}
              className="w-full accent-[#fcc025]" />
          </div>
          <input type="number" min={10} value={futuresMargin} onChange={(e) => setFuturesMargin(e.target.value)}
            placeholder={t('market.margin')} className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} step={0.01} value={futuresTakeProfit} onChange={(e) => setFuturesTakeProfit(e.target.value)}
              placeholder={t('market.take_profit')} className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
            <input type="number" min={0} step={0.01} value={futuresStopLoss} onChange={(e) => setFuturesStopLoss(e.target.value)}
              placeholder={t('market.stop_loss')} className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
          </div>
          <div className="text-[10px] text-[#adaaaa] space-y-1">
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

      {/* --- Bank tab --- */}
      {panelTab === 'bank' && (
        <div className="space-y-3">
          <input type="number" min="1" value={cashMoveAmount} onChange={(e) => setCashMoveAmount(e.target.value)}
            placeholder={t('market.amount')} className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={execute.isPending}
              onClick={() => runAction({ type: 'bank_deposit', amount: cashMoveAmount }, t('market.deposit_success'))}
              className="rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-emerald-500">{t('market.bank_deposit')}</button>
            <button type="button" disabled={execute.isPending}
              onClick={() => runAction({ type: 'bank_withdraw', amount: cashMoveAmount }, t('market.withdraw_success'))}
              className="rounded-xl bg-amber-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-amber-500">{t('market.bank_withdraw')}</button>
          </div>
        </div>
      )}

      {/* Stock detail chart (hidden on bank tab) */}
      {panelTab !== 'bank' && selectedQuote && chartOpen && (() => {
        const history: number[] = marketSnapshot?.history?.[selectedQuote.symbol] || [];
        const isUp = (selectedQuote.changePct || 0) >= 0;
        const color = isUp ? '#00f59b' : '#ff6d6d';
        const path = history.length > 1 ? (() => {
          const w = 600, h = 160;
          const min = Math.min(...history), max = Math.max(...history);
          const range = max - min || 1;
          return history.map((v, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - ((v - min) / range) * (h - 16) - 8;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ');
        })() : '';
        return (
          <div className="border-t border-[#494847]/10 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase text-white">{selectedQuote.symbol} — {selectedQuote.name}</span>
              <div className="text-right">
                <p className="text-sm font-black italic tracking-tight text-[#fcc025]">{nf(Number(selectedQuote.price || 0))}</p>
                <p className={`text-[10px] font-black ${isUp ? 'text-emerald-400' : 'text-[#ff7351]'}`}>
                  {isUp ? '+' : ''}{selectedQuote.changePct.toFixed(2)}%
                </p>
              </div>
            </div>
            {path && (
              <svg viewBox="0 0 600 160" className="w-full h-32">
                <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        );
      })()}
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
            {/* Mobile: trade drawer toggle */}
            <button onClick={() => setMobileDrawerOpen(o => !o)} className="lg:hidden text-xs font-black uppercase tracking-[0.18em] text-[#fcc025]">
              {mobileDrawerOpen ? t('market.close_order') : t('market.place_order')}
            </button>
            <Link to="/app/transactions" className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">
              {t('market.public_feed')}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile trade drawer */}
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
        {/* Desktop left sidebar — collapsible */}
        <aside className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
          <div className={`sticky top-24 rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-5 shadow-2xl ${sidebarOpen ? '' : 'hidden'}`}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSidebarOpen(false)} className="text-[#adaaaa] hover:text-white">
                <PanelRightClose size={16} />
              </button>
            </div>
            {executionPanel}
          </div>
        </aside>

        {/* Collapsed sidebar toggle (desktop) */}
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="hidden lg:flex sticky top-24 self-start mt-2 rounded-r-xl border border-l-0 border-[#494847]/10 bg-[#1a1919] px-2 py-6 text-[#adaaaa] hover:text-white">
            <PanelRightOpen size={18} />
          </button>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {actionNotice && (
            <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#1a1919] border shadow-lg shadow-black/50 text-sm font-bold animate-[fadeIn_0.3s_ease-out] whitespace-nowrap ${
              actionNotice.type === 'success' ? 'border-emerald-400/40 text-emerald-300' : 'border-red-400/40 text-red-400'
            }`}>
              {actionNotice.type === 'success' ? '✅ ' : '❌ '}{actionNotice.message}
            </div>
          )}

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl lg:col-span-2">
              <div className="flex items-center gap-3">
                <CircleDollarSign className="text-[#fcc025]" size={18} />
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.market_pulse')}</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.market_index')}</p>
                  <p className="mt-2 text-3xl font-black italic tracking-tight text-[#fcc025]">{nf(marketSnapshot?.marketIndex || 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.trend')}</p>
                  <p className={`mt-2 text-2xl font-black italic tracking-tight ${(marketSnapshot?.marketTrendPct || 0) >= 0 ? 'text-emerald-400' : 'text-[#ff7351]'}`}>
                    {(marketSnapshot?.marketTrendPct || 0) >= 0 ? '+' : ''}{(marketSnapshot?.marketTrendPct || 0).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.fear_greed')}</p>
                  <p className="mt-2 text-2xl font-black italic tracking-tight text-white">{marketSnapshot?.fearGreedIndex ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <Wallet className="text-[#fcc025]" size={18} />
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.account')}</h2>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.net_worth')}</p>
                  <p className="mt-1 text-2xl font-black italic tracking-tight text-[#fcc025]">{nf(summary?.netWorth || 0)}</p>
                </div>
                <div className="grid gap-3 grid-cols-2">
                  <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.cash')}</p>
                    <p className="mt-1 text-lg font-black text-white">{nf(summary?.cash || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.bank')}</p>
                    <p className="mt-1 text-lg font-black text-white">{nf(summary?.bankBalance || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Portfolio summary - above everything */}
          {(summary?.futuresPositions?.length > 0 || summary?.stockPositions?.length > 0) && (
            <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa] mb-4">{t('market.portfolio')}</h2>
              {summary?.futuresPositions?.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#adaaaa]">{t('market.futures')}</span>
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
                          className="text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg disabled:opacity-50">
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
                      <div key={pos.id} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {pos.side === 'long' ? t('market.long_badge') : t('market.short_badge')}
                            </span>
                            <p className="text-xs font-black text-white">{pos.symbol}</p>
                            <span className="text-[10px] text-[#adaaaa]">{pos.leverage}x</span>
                          </div>
                          <div className="text-right shrink-0 ml-2 flex items-center gap-2">
                            <p className={`text-xs font-black ${(pos.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}{nf(pos.unrealizedPnl || 0)}
                            </p>
                            <button onClick={() => runAction({ type: 'futures_close', positionId: pos.id }, t('market.position_closed'))}
                              disabled={execute.isPending}
                               className="text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg disabled:opacity-50">
                               {t('market.close_position')}
                             </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-[#adaaaa] mt-1">
                          {t('market.position_detail', { entry: nf(pos.entryPrice), mark: nf(pos.markPrice ?? 0), liquidation: nf(pos.liquidationPrice) })}
                        </p>
                        {(pos.takeProfitPrice || pos.stopLossPrice) && (
                          <div className="flex gap-3 mt-1 text-[10px]">
                            {pos.takeProfitPrice ? <span className="text-emerald-400">{t('market.take_profit')} {nf(pos.takeProfitPrice)}</span> : null}
                            {pos.stopLossPrice ? <span className="text-red-400">{t('market.stop_loss')} {nf(pos.stopLossPrice)}</span> : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {summary?.stockPositions?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-[#adaaaa] block mb-2">{t('market.stocks')}</span>
                  <div className="space-y-2">
                    {summary.stockPositions.map((pos: any) => (
                      <div key={pos.symbol} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-white">{pos.symbol} <span className="text-[10px] font-bold text-[#adaaaa]">×{nf(pos.quantity)}</span></p>
                          <p className={`text-xs font-black ${(pos.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}{nf(pos.unrealizedPnl || 0)}
                          </p>
                        </div>
                        <p className="text-[10px] text-[#adaaaa] mt-0.5">{t('market.market_value', { value: nf(pos.marketValue) })}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              {/* Stock grid (chart moved to execution panel sidebar) */}
              <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="text-[#fcc025]" size={18} />
                  <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.symbols')}</h2>
                  {selectedQuote && (
                    <button onClick={() => setChartOpen(!chartOpen)}
                      className="ml-auto text-[10px] font-bold text-[#fcc025] bg-[#fcc025]/10 px-2.5 py-1 rounded-lg hover:bg-[#fcc025]/20 transition-colors">
                      {t('market.chart_detail')} {chartOpen ? '▲' : '▼'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stockSymbols.map((quote) => (
                    <button key={quote.symbol} type="button" onClick={() => { setSelectedSymbol(quote.symbol); setChartOpen(true); }}
                      className={`rounded-xl border p-3 text-left transition-all ${selectedSymbol === quote.symbol ? 'border-[#fcc025]/55 bg-[#121212]' : 'border-[#494847]/10 bg-[#141414] hover:border-[#fcc025]/20'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black uppercase tracking-[0.1em] text-white truncate">{quote.symbol}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(quote.changePct || 0) >= 0 ? 'bg-emerald-400/15 text-emerald-400' : 'bg-[#ff7351]/15 text-[#ff7351]'}`}>
                              {(quote.changePct || 0) >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#aeb7c9] truncate">{quote.name}</p>
                        </div>
                        {(quote.changePct || 0) >= 0 ? <TrendingUp className="text-emerald-400 shrink-0" size={16} /> : <TrendingDown className="text-[#ff7351] shrink-0" size={16} />}
                      </div>
                      <p className="mt-2 text-base font-black italic tracking-tight text-[#fcc025]">{nf(Number(quote.price || 0))}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.recent_activity')}</h2>
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
              </section>
            </div>
          </section>
        </div>
      </main>

      <AppBottomNav current="market" />
    </div>
  );
}
