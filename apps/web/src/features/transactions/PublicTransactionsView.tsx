import { useQuery } from '@tanstack/react-query';
import { api } from '../../store/api';
import { Activity, HeartPulse, Coins, Sparkles, ChevronRight, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatNumber } from '@repo/shared';
import { useUserStore } from '../../store/useUserStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import AppBottomNav from '../../components/AppBottomNav';

type DashboardTx = {
  id: string;
  roundId: string | number;
  userAddress: string;
  type: string;
  amount: string;
  tokenSymbol?: string;
  status: string;
  txHash?: string;
  gameType?: string;
  createdAt: string;
};

type LedgerEntry = {
  id: string;
  type: string;
  amount: string;
  token: string;
  address: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
};



export default function PublicTransactionsView() {
  const { t } = useTranslation();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const { address, username, balance } = useUserStore();
  const { address: authAddress } = useAuthStore();
  const displayAddress = address || authAddress || '';

  const { data: txData, isLoading } = useQuery({
    queryKey: ['public-transactions'],
    queryFn: async () => {
      const [txRes, summaryRes] = await Promise.all([
        api.get('/api/v1/dashboard/transactions', { params: { limit: 40, page: 1 } }),
        api.get('/api/v1/dashboard/summary'),
      ]);
      return {
        items: (txRes.data.data?.items || []) as DashboardTx[],
        summary: summaryRes.data.data as {
          total: number;
          confirmed: number;
          failed: number;
          pending: number;
          successRate: number;
        },
      };
    },
    refetchInterval: 15000,
  });

  const { data: recentTxData } = useQuery({
    queryKey: ['recent-txs-inline'],
    queryFn: async () => {
      const res = await api.get('/api/v1/stats/recent-txs');
      return res.data.data as { events: LedgerEntry[] };
    },
    refetchInterval: 10000,
  });

  const { data: healthData } = useQuery({
    queryKey: ['health-stats-inline'],
    queryFn: async () => {
      const res = await api.get('/api/v1/stats/health');
      return res.data.data as {
        stats?: {
          uptime?: string;
          failureRate?: string;
          nodes?: string;
          startedAt?: number;
          serverUptime?: number;
          serverUptimeLabel?: string;
        };
      };
    },
    refetchInterval: 30000,
  });

  const txItems = txData?.items || [];
  const ledgerEvents = recentTxData?.events || [];
  // Merge dashboard TXs with wallet ledger events, sorted newest first
  const mergedItems: DashboardTx[] = [
    ...txItems,
    ...ledgerEvents.map((e: LedgerEntry) => ({
      id: e.id,
      roundId: '',
      userAddress: e.address,
      type: e.type,
      amount: e.amount,
      tokenSymbol: e.token,
      status: 'confirmed' as const,
      createdAt: e.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
   .slice(0, 50);
  const items = mergedItems;
  const summary = txData?.summary;
  const serviceStats = healthData?.stats;

  const successRatePct = summary?.total
    ? Number(((summary.confirmed / summary.total) * 100).toFixed(2))
    : 0;

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/15 bg-surface/90 backdrop-blur-xl">
        <div className="app-shell flex items-center gap-3 py-4">
          <Activity className="text-accent" />
          <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
            {t('transactions.title')}
          </h1>
        </div>
      </header>

      <main className="app-shell pt-24">
        <section className="bg-card rounded-2xl p-6 border border-border/20 flex items-center gap-6 mb-6">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-white truncate">{username || '未設定'}</p>
            <p className="text-xs font-bold text-secondary truncate mt-1">{displayAddress || ''}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black italic text-accent">{nf(balance || 0)} ZXC</p>
          </div>
        </section>

        {/* Server Status Bar */}
        <div className="flex items-center gap-3 mb-6 bg-card rounded-2xl px-5 py-3 border border-border/10">
          <Clock size={14} className="text-accent" />
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
            伺服器運行
          </span>
          <span className="text-xs font-black text-emerald-400 ml-auto">
            {serviceStats?.serverUptimeLabel || '...'}
          </span>
          <span className="text-[10px] font-bold text-secondary">
            {serviceStats?.uptime ? `可用 ${serviceStats.uptime}` : ''}
          </span>
        </div>

        {/* Uptime Chart */}
        {serviceStats?.last24h?.success && (
          <div className="bg-card rounded-2xl p-5 border border-border/10 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">24h 服務狀態</span>
              <span className="text-[10px] font-bold text-secondary">{serviceStats.uptime || ''}</span>
            </div>
            <div className="flex items-end gap-[2px] h-16">
              {serviceStats.last24h.success.map((s: number, i: number) => {
                const f = (serviceStats.last24h?.failure || [])[i] || 0;
                const total = s + f;
                const h = total > 0 ? Math.max(4, (s / Math.max(total, 1)) * 60) : 4;
                const barH = total > 0 ? Math.max(4, (total / 30) * 60) : 4;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center gap-[1px]" title={`${s} OK / ${f} FAIL`}>
                    <div className="w-full rounded-t-sm" style={{ height: `${Math.min(h, 60)}px`, background: f > 0 ? `linear-gradient(to top, #ff7351 ${(f/total)*100}%, #10b981 ${(s/total)*100}%)` : '#10b981', opacity: total > 0 ? 0.8 : 0.2 }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[8px] text-muted">
              <span>-24h</span>
              <span>現在</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-2xl p-5 border border-border/20">
            <div className="flex items-center gap-2 mb-2">
              <Coins size={14} className="text-accent" />
              <span className="text-xs font-black uppercase tracking-widest text-secondary">總交易</span>
            </div>
            <p className="text-xl font-black italic text-accent">{nf(summary?.total ?? 0)}</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-widest text-secondary">成功</span>
            </div>
            <p className="text-xl font-black italic text-emerald-400">{nf(summary?.confirmed ?? 0)}</p>
          </div>
          <div className="bg-card rounded-2xl p-5 border border-border/20">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse size={14} className="text-accent" />
              <span className="text-xs font-black uppercase tracking-widest text-secondary">成功率</span>
            </div>
            <p className="text-xl font-black italic text-accent">{summary?.total ? `${successRatePct}%` : '0%'}</p>
          </div>
        </div>

        <section className="rounded-2xl border border-border/10 bg-card p-6 shadow-2xl mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-secondary">
            最新市場與錢包動態
          </p>
          <div className="mt-4 space-y-3">
            {isLoading && <div className="text-sm text-secondary">{t('common.loading')}</div>}
            {!isLoading && items.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/20 p-4 text-sm text-secondary">
                {t('transactions.empty')}
              </div>
            )}
            {items.map((item: DashboardTx) => (
              <div key={item.id} className="rounded-xl border border-border/10 bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black tracking-[0.14em] text-white">
                      {`${t('txType.' + item.type, item.type)} • ${nf(Number(item.amount))} ${item.tokenSymbol === 'zhixi' ? 'ZXC' : item.tokenSymbol === 'yjc' ? 'YJC' : item.tokenSymbol || 'ZXC'}`}
                    </p>
                    <p className="mt-1 text-xs font-bold tracking-[0.12em] text-secondary">
                      {item.userAddress?.slice(0, 10)}... / {item.gameType || item.type} {String(item.roundId).length > 20 ? String(item.roundId).slice(0,20)+'…' : String(item.roundId)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-accent">{t('txStatus.' + item.status, item.status)}</p>
                    <p className="mt-1 text-xs font-bold text-secondary">{new Date(item.createdAt).toLocaleString('zh-TW')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-border/20 bg-card divide-y divide-[#494847]/10">
          <Link to="/app/inventory" className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
            <span className="text-sm font-bold">道具背包</span>
            <ChevronRight size={16} className="text-secondary" />
          </Link>
          <Link to="/app/info?tab=items" className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
            <span className="text-sm font-bold">物品圖鑑</span>
            <ChevronRight size={16} className="text-secondary" />
          </Link>
          <Link to="/app/settings" className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
            <span className="text-sm font-bold">設定</span>
            <ChevronRight size={16} className="text-secondary" />
          </Link>
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
