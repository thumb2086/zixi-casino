import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
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
  | { type: 'futures_open'; symbol: string; side: string; amount: string; leverage: string }
  | { type: 'futures_close'; positionId: string };

export default function MarketView() {
  const { t } = useTranslation();
  const { snapshot, account, execute } = useMarket();
  const { amountDisplay } = usePreferencesStore();
  const numberMode = amountDisplay === 'full' ? 'full' : 'short' as const;
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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (actionNotice) { const t = setTimeout(() => setActionNotice(null), 3000); return () => clearTimeout(t); }
  }, [actionNotice]);

  const runAction = async (params: MarketActionParams, successMsg: string) => {
    try {
      await execute.mutateAsync(params);
      setActionNotice({ type: 'success', message: successMsg });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err?.message || t('market.action_failed') });
    }
  };

  const executionPanel = (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <LineChart className="text-[#fcc025]" size={18} />
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.execution_panel')}</h2>
      </div>
      <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}
        className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none">
        {stockSymbols.map((q) => (
          <option key={q.symbol} value={q.symbol}>{q.symbol} — {q.name}</option>
        ))}
      </select>
      <input value={tradeQuantity} onChange={(e) => setTradeQuantity(e.target.value)}
        placeholder={t('market.quantity_placeholder')}
        className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={execute.isPending}
          onClick={() => runAction({ type: 'stock_buy', symbol: selectedSymbol, quantity: tradeQuantity }, t('market.buy_success'))}
          className="rounded-2xl bg-[#fcc025] px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-black disabled:opacity-50">
          {t('market.buy')} {selectedQuote?.symbol || selectedSymbol}
        </button>
        <button type="button" disabled={execute.isPending}
          onClick={() => runAction({ type: 'stock_sell', symbol: selectedSymbol, quantity: tradeQuantity }, t('market.sell_success'))}
          className="rounded-2xl bg-[#ff7351] px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-50">
          {t('market.sell')} {selectedQuote?.symbol || selectedSymbol}
        </button>
      </div>
      {/* Mode toggle: Spot / Futures */}
      <div className="flex gap-1 rounded-xl bg-[#0e0e0e] p-1 border border-[#494847]/20">
        <button onClick={() => setTradeMode('spot')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tradeMode === 'spot' ? 'bg-[#fcc025] text-black shadow' : 'text-[#adaaaa]'}`}>現貨</button>
        <button onClick={() => setTradeMode('futures')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tradeMode === 'futures' ? 'bg-[#fcc025] text-black shadow' : 'text-[#adaaaa]'}`}>合約</button>
      </div>

      {tradeMode === 'futures' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setFuturesSide('long')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${futuresSide === 'long' ? 'bg-emerald-500 text-white shadow' : 'bg-[#0e0e0e] text-[#adaaaa] border border-[#494847]/20'}`}>做多</button>
            <button onClick={() => setFuturesSide('short')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${futuresSide === 'short' ? 'bg-red-500 text-white shadow' : 'bg-[#0e0e0e] text-[#adaaaa] border border-[#494847]/20'}`}>做空</button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-[#adaaaa]">槓桿</span>
              <span className="text-xs font-black text-[#fcc025]">{futuresLeverage}x</span>
            </div>
            <input type="range" min={1} max={20} value={futuresLeverage} onChange={(e) => setFuturesLeverage(Number(e.target.value))}
              className="w-full accent-[#fcc025]" />
          </div>
          <input type="number" min={10} value={futuresMargin} onChange={(e) => setFuturesMargin(e.target.value)}
            placeholder="保證金" className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
          <div className="text-[10px] text-[#adaaaa] space-y-1">
            <p>名義價值：{formatNumber(Number(futuresMargin || 0) * futuresLeverage)} ZXC</p>
            <p>強平價格：{futuresSide === 'long'
              ? formatNumber(Math.round(Number(selectedQuote?.price || 0) * (1 - 0.96 / futuresLeverage)))
              : formatNumber(Math.round(Number(selectedQuote?.price || 0) * (1 + 0.96 / futuresLeverage)))
            } ZXC</p>
          </div>
          <button type="button" disabled={execute.isPending || !futuresMargin || Number(futuresMargin) < 10}
            onClick={() => runAction({
              type: 'futures_open', symbol: selectedSymbol, side: futuresSide,
              amount: futuresMargin, leverage: String(futuresLeverage)
            }, `${futuresSide === 'long' ? '多' : '空'}倉開倉成功`)}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-white disabled:opacity-50 hover:brightness-110">
            開倉 {futuresSide === 'long' ? '做多' : '做空'} {selectedSymbol}
          </button>
        </div>
      )}

      <div className="border-t border-[#494847]/10 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Landmark size={16} className="text-[#fcc025]" />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">銀行</span>
        </div>
        <input type="number" min="1" value={cashMoveAmount} onChange={(e) => setCashMoveAmount(e.target.value)}
          placeholder="金額"
          className="w-full mb-2 rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={execute.isPending}
            onClick={() => runAction({ type: 'bank_deposit', amount: cashMoveAmount }, t('market.deposit_success'))}
            className="rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-emerald-500">存入</button>
          <button type="button" disabled={execute.isPending}
            onClick={() => runAction({ type: 'bank_withdraw', amount: cashMoveAmount }, t('market.withdraw_success'))}
            className="rounded-xl bg-amber-600 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50 hover:bg-amber-500">提款</button>
        </div>
      </div>
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
              {mobileDrawerOpen ? '關閉下單' : '下單'}
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
              <button onClick={() => setMobileDrawerOpen(false)} className="text-xs text-[#adaaaa]">✕ 關閉</button>
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
                  <p className="mt-2 text-3xl font-black italic tracking-tight text-[#fcc025]">{formatNumber(marketSnapshot?.marketIndex || 0, numberMode)}</p>
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
                  <p className="mt-1 text-2xl font-black italic tracking-tight text-[#fcc025]">{formatNumber(summary?.netWorth || 0, numberMode)}</p>
                </div>
                <div className="grid gap-3 grid-cols-2">
                  <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.cash')}</p>
                    <p className="mt-1 text-lg font-black text-white">{formatNumber(summary?.cash || 0, numberMode)}</p>
                  </div>
                  <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#adaaaa]">{t('market.bank')}</p>
                    <p className="mt-1 text-lg font-black text-white">{formatNumber(summary?.bankBalance || 0, numberMode)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Portfolio summary - above everything */}
          {(summary?.futuresPositions?.length > 0 || summary?.stockPositions?.length > 0) && (
            <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa] mb-4">我的持倉</h2>
              {summary?.futuresPositions?.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#adaaaa]">合約</span>
                    <span className="text-xs font-black text-[#adaaaa]">保證金：{formatNumber(summary.usedFuturesMargin || 0)}</span>
                  </div>
                  {summary.futuresUnrealizedPnl !== undefined && (
                    <div className={`text-xs font-bold mb-2 ${(summary.futuresUnrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      未實現損益：{(summary.futuresUnrealizedPnl || 0) >= 0 ? '+' : ''}{formatNumber(summary.futuresUnrealizedPnl || 0, numberMode)} ZXC
                    </div>
                  )}
                  <div className="space-y-2">
                    {summary.futuresPositions.map((pos: any) => (
                      <div key={pos.id} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {pos.side === 'long' ? '多' : '空'}
                            </span>
                            <p className="text-xs font-black text-white">{pos.symbol}</p>
                            <span className="text-[10px] text-[#adaaaa]">{pos.leverage}x</span>
                          </div>
                          <div className="text-right shrink-0 ml-2 flex items-center gap-2">
                            <p className={`text-xs font-black ${(pos.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}{formatNumber(pos.unrealizedPnl || 0, numberMode)}
                            </p>
                            <button onClick={() => runAction({ type: 'futures_close', positionId: pos.id }, '倉位已平倉')}
                              disabled={execute.isPending}
                              className="text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg disabled:opacity-50">
                              平倉
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-[#adaaaa] mt-1">
                          入場 {formatNumber(pos.entryPrice)} · 標記 {formatNumber(pos.price || 0)} · 強平 {formatNumber(pos.liquidationPrice)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {summary?.stockPositions?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-[#adaaaa] block mb-2">股票</span>
                  <div className="space-y-2">
                    {summary.stockPositions.map((pos: any) => (
                      <div key={pos.symbol} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-white">{pos.symbol} <span className="text-[10px] font-bold text-[#adaaaa]">×{formatNumber(pos.quantity)}</span></p>
                          <p className={`text-xs font-black ${(pos.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}{formatNumber(pos.unrealizedPnl || 0, numberMode)}
                          </p>
                        </div>
                        <p className="text-[10px] text-[#adaaaa] mt-0.5">市值 {formatNumber(pos.marketValue, numberMode)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="text-[#fcc025]" size={18} />
                  <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">{t('market.symbols')}</h2>
                </div>

                {/* Selected stock detail with chart ABOVE the grid */}
                {selectedQuote && (() => {
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
                    <div className="mb-4 rounded-2xl border border-[#494847]/10 bg-[#101010] p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.14em] text-white">{selectedQuote.symbol} — {selectedQuote.name}</p>
                          <p className="text-xs text-[#adaaaa]">{selectedQuote.type} · {selectedQuote.sector}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black italic tracking-tight text-[#fcc025]">{formatNumber(Number(selectedQuote.price || 0))}</p>
                          <p className={`text-sm font-black ${isUp ? 'text-emerald-400' : 'text-[#ff7351]'}`}>
                            {isUp ? '+' : ''}{selectedQuote.changePct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      {path && (
                        <svg viewBox="0 0 600 160" className="w-full h-40">
                          <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stockSymbols.map((quote) => (
                    <button key={quote.symbol} type="button" onClick={() => setSelectedSymbol(quote.symbol)}
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
                      <p className="mt-2 text-base font-black italic tracking-tight text-[#fcc025]">{formatNumber(Number(quote.price || 0), numberMode)}</p>
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
