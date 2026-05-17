import { useQuery } from '@tanstack/react-query';
import { api } from '../../store/api';
import { Activity, HeartPulse, User, Coins, Sparkles, ChevronRight, Terminal, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ITEM_DROP_TABLES } from '@repo/shared';
import { useUserStore } from '../../store/useUserStore';
import AppBottomNav from '../../components/AppBottomNav';

const allItems = Object.values(ITEM_DROP_TABLES).flat();
const avatarMap = Object.fromEntries(
  allItems.filter((i) => i.type === 'avatar').map((i) => [i.id, i])
);
const titleMap = Object.fromEntries(
  allItems.filter((i) => i.type === 'title').map((i) => [i.id, i])
);

type DashboardTransaction = {
  id: string;
  roundId: string | number;
  userAddress: string;
  type: string;
  amount: string;
  tokenSymbol?: string;
  status: string;
  txHash?: string;
  gameType?: string;
  extensionMetadata?: Record<string, any>;
  createdAt: string;
};

export default function PublicTransactionsView() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const { data, isLoading } = useQuery({
    queryKey: ['public-transactions'],
    queryFn: async () => {
      const [txRes, summaryRes] = await Promise.all([
        api.get('/api/v1/dashboard/transactions', { params: { limit: 40, page: 1 } }),
        api.get('/api/v1/dashboard/summary'),
      ]);
      return {
        items: txRes.data.data.items as DashboardTransaction[],
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

  const { data: healthData } = useQuery({
    queryKey: ['health-stats-inline'],
    queryFn: async () => {
      const res = await api.get('/api/v1/stats/health');
      return res.data.data as {
        stats?: {
          uptime?: string;
          failureRate?: string;
        };
      };
    },
    refetchInterval: 30000,
  });

  const { data: txData } = useQuery({
    queryKey: ['recent-txs'],
    queryFn: async () => {
      const res = await api.get('/api/v1/stats/recent-txs');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const zh = {
    title: '\u516c\u958b\u4ea4\u6613\u52d5\u614b',
    overallSuccessRate: '\u6574\u9ad4\u6210\u529f\u7387',
    walletExecution: '\u9322\u5305\u57f7\u884c\u7387',
    marketWinRate: '\u5e02\u5834\u52dd\u7387',
    successSummary: '\u6210\u529f {{success}} \u7b46 / \u7d0d\u5165\u7d71\u8a08 {{scored}} \u7b46',
    confirmedWalletIntents: '\u5df2\u78ba\u8a8d\u9322\u5305\u610f\u5716',
    marketOutcomes: '\u5df2\u7d50\u7b97\u5e02\u5834\u7d50\u679c',
    serviceStatus: '\u670d\u52d9\u72c0\u614b',
    serviceStatusSummary: '\u7cfb\u7d71\u72c0\u614b\u8207\u5340\u584a\u4ea4\u6613\u8ffd\u8e64',
    uptime: '\u7a69\u5b9a\u7387',
    failureRate: '\u5931\u6557\u7387',
    viewDetails: '\u67e5\u770b\u8a73\u7d30',
    latestActivity: '\u6700\u65b0\u5e02\u5834\u8207\u9322\u5305\u52d5\u614b',
    loading: '\u8f09\u5165\u4e2d...',
    empty: '\u5c1a\u7121\u516c\u958b\u4ea4\u6613\u8cc7\u6599',
    wallet: '\u9322\u5305',
    market: '\u5e02\u5834',
    public: '\u516c\u958b',
  };

  const items = data?.items || [];
  const summary = data?.summary;
  const registerBonusItems = items.filter((item) =>
    item.type?.toLowerCase() === 'register_bonus' ||
    item.extensionMetadata?.reason === 'register_bonus'
  ).slice(0, 8);
  const serviceStats = healthData?.stats;
  const events = txData?.events || [];

  const { address, username, balance, activeAvatar, activeTitle } = useUserStore();
  const avatarItem = avatarMap[activeAvatar];
  const titleItem = titleMap[activeTitle];

  const metric = (value: number | null | undefined, suffix = '%') =>
    typeof value === 'number' ? `${value}${suffix}` : '--';

  const successRatePct = Number.isFinite((summary?.successRate ?? 0) * 100)
    ? Number(((summary?.successRate ?? 0) * 100).toFixed(2))
    : 0;
  const walletExecutionPct = summary?.total ? Math.round((summary.confirmed / summary.total) * 10000) / 100 : 0;
  const marketWinRatePct = Math.max(0, 100 - (summary?.failed ?? 0) * 100 / Math.max(summary?.total || 1, 1));

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-['Manrope'] text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="app-shell flex items-center gap-3 py-4">
          <Activity className="text-[#fcc025]" />
          <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">
            {isZh ? zh.title : 'Public Transactions'}
          </h1>
        </div>
      </header>

      <main className="app-shell pt-24">
        {/* Personal Status */}
        <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 flex items-center gap-6 mb-6">
          <div className="text-5xl shrink-0">{avatarItem?.icon || '🧑'}</div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-white truncate">{username || '未設定'}</p>
            {titleItem && <p className="text-xs font-bold text-[#fcc025]">{titleItem.icon} {titleItem.name}</p>}
            <p className="text-[10px] font-bold text-[#adaaaa] truncate mt-1">{address || ''}</p>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#1a1919] rounded-2xl p-5 border border-[#494847]/20">
            <div className="flex items-center gap-2 mb-2">
              <Coins size={14} className="text-[#fcc025]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#adaaaa]">ZXC 餘額</span>
            </div>
            <p className="text-xl font-black italic text-[#fcc025]">{Number(balance).toLocaleString()}</p>
          </div>
          <div className="bg-[#1a1919] rounded-2xl p-5 border border-[#494847]/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-[#fcc025]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#adaaaa]">活躍頭像</span>
            </div>
            <p className="text-sm font-bold text-white truncate">{avatarItem?.name || activeAvatar}</p>
          </div>
        </div>
        <section className="mb-6 rounded-2xl border border-[#494847]/20 bg-[#1a1919] divide-y divide-[#494847]/10">
          <Link to="/app/inventory" className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
            <span className="text-sm font-bold">道具背包</span>
            <ChevronRight size={16} className="text-[#adaaaa]" />
          </Link>
          <Link to="/app/info?tab=items" className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
            <span className="text-sm font-bold">物品圖鑑</span>
            <ChevronRight size={16} className="text-[#adaaaa]" />
          </Link>
          <Link to="/app/settings" className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
            <span className="text-sm font-bold">設定</span>
            <ChevronRight size={16} className="text-[#adaaaa]" />
          </Link>
        </section>

        <section className="mb-10 space-y-6">
          <div className="flex items-center gap-2">
            <HeartPulse size={16} className="text-[#fcc025]" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#adaaaa]">
              {isZh ? zh.serviceStatus : 'Service Status'}
            </h2>
          </div>

          {/* Core Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/10 flex flex-col gap-2">
              <span className="text-[8px] font-black text-[#494847] uppercase tracking-[0.3em]">UPTIME</span>
              <span className="text-xl font-black italic text-emerald-500">{serviceStats?.uptime ?? (isLoading ? '...' : '--')}</span>
            </div>
            <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/10 flex flex-col gap-2">
              <span className="text-[8px] font-black text-[#494847] uppercase tracking-[0.3em]">FAILURE RATE</span>
              <span className="text-xl font-black italic text-[#fcc025]">{serviceStats?.failureRate ?? (isLoading ? '...' : '--')}</span>
            </div>
            <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/10 flex flex-col gap-2">
              <span className="text-[8px] font-black text-[#494847] uppercase tracking-[0.3em]">NODES</span>
              <span className="text-xl font-black italic text-white">{serviceStats?.nodes ?? (isLoading ? '...' : '--')}</span>
            </div>
            <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/10 flex flex-col gap-2">
              <span className="text-[8px] font-black text-[#494847] uppercase tracking-[0.3em]">SECURE LAYER</span>
              <span className="text-xl font-black italic text-[#fcc025]">{serviceStats?.secureLayer ?? '--'}</span>
            </div>
          </div>

          {/* Traffic Graph + Event Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[#fcc025]" />
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#adaaaa]">SIMULATION THROUGHPUT</h3>
                </div>
                <div className="flex items-center gap-3 text-[7px] font-black uppercase">
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20 border border-emerald-500" /> SUCCESS</div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500/60 border border-red-500" /> FAILURE</div>
                </div>
              </div>
              <div className="flex items-end gap-1 h-40">
                {serviceStats?.last24h?.success?.length > 0 ? (
                  serviceStats.last24h.success.map((val: number, i: number) => (
                    <div key={i} className="flex-1 group relative">
                      <div className="bg-emerald-500/10 w-full rounded-t-sm" style={{ height: `${(val / 50) * 100}%` }} />
                      <div className="bg-red-500/40 w-full rounded-t-sm -mt-1" style={{ height: `${(serviceStats.last24h.failure[i] / 50) * 100}%` }} />
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-30">
                    <Activity size={24} className="text-[#494847]" />
                    <span className="text-[#494847] text-[9px] font-bold uppercase ml-2">No Data</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[7px] font-black text-[#494847] uppercase tracking-[0.3em]">
                <span>24 HOURS AGO</span>
                <span>NOW</span>
              </div>
            </div>

            <div className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/10 space-y-4">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-[#fcc025]" />
                <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#adaaaa]">SYSTEM PROTOCOL LOGS</h3>
              </div>
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 hide-scrollbar">
                {events.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-20">
                    <Database size={32} />
                    <p className="text-[8px] font-black uppercase tracking-[0.5em] mt-3">No recent traces</p>
                  </div>
                )}
                {events.map((ev: any, i: number) => (
                  <div key={i} className="bg-[#0e0e0e] rounded-xl p-3 border border-[#494847]/5 space-y-1.5 hover:border-[#fcc025]/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-sm ${ev.severity === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-[#fcc025]/10 text-[#fcc025]'}`}>
                        [{ev.kind}]
                      </span>
                      <span className="text-[7px] font-bold text-[#494847]">
                        {new Date(ev.createdAt).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold text-white leading-relaxed uppercase italic tracking-tight">{ev.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-5 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#adaaaa]">
              {isZh ? zh.overallSuccessRate : 'Overall Success Rate'}
            </p>
            <p className="mt-3 text-3xl font-black italic tracking-tight text-[#fcc025]">{metric(successRatePct)}</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#adaaaa]">
              {isZh
                ? zh.successSummary
                    .replace('{{success}}', String(summary?.confirmed ?? 0))
                    .replace('{{scored}}', String(summary?.total ?? 0))
                : `${summary?.confirmed ?? 0} success / ${summary?.total ?? 0} scored`}
            </p>
          </div>
          <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-5 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#adaaaa]">
              {isZh ? zh.walletExecution : 'Wallet Execution'}
            </p>
            <p className="mt-3 text-3xl font-black italic tracking-tight text-[#fcc025]">{metric(walletExecutionPct)}</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#adaaaa]">
              {isZh ? zh.confirmedWalletIntents : 'Confirmed wallet intents'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-5 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#adaaaa]">
              {isZh ? zh.marketWinRate : 'Market Win Rate'}
            </p>
            <p className="mt-3 text-3xl font-black italic tracking-tight text-[#fcc025]">{metric(marketWinRatePct)}</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#adaaaa]">
              {isZh ? zh.marketOutcomes : 'Closed/realized market outcomes'}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#adaaaa]">
            {isZh ? zh.latestActivity : 'Latest Market & Wallet Activity'}
          </p>
          <div className="mt-4 space-y-3">
            {isLoading && <div className="text-sm text-[#adaaaa]">{isZh ? zh.loading : t('common.loading')}</div>}
            {!isLoading && !items.length && (
              <div className="rounded-xl border border-dashed border-[#494847]/20 p-4 text-sm text-[#adaaaa]">
                {isZh ? zh.empty : 'No public transactions yet'}
              </div>
            )}
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white">
                      {`${item.type?.toUpperCase?.() || 'TX'} • ${item.amount} ${item.tokenSymbol || ''}`}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#adaaaa]">
                      {item.userAddress} / round {String(item.roundId)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#fcc025]">{item.status}</p>
                    <p className="mt-1 text-[10px] font-bold text-[#adaaaa]">{new Date(item.createdAt).toLocaleString('zh-TW')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#adaaaa]">Latest REGISTER_BONUS</p>
          <div className="mt-4 space-y-2">
            {!registerBonusItems.length && (
              <div className="rounded-xl border border-dashed border-[#494847]/20 p-4 text-sm text-[#adaaaa]">No register bonus records</div>
            )}
            {registerBonusItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3 text-xs text-[#adaaaa]">
                <div className="flex items-center justify-between">
                  <span>{item.userAddress}</span>
                  <span className="uppercase text-[#fcc025]">{item.type}</span>
                </div>
                <div className="text-[#fcc025]">{item.amount} {item.tokenSymbol || ''}</div>
                <div className="mt-1">status: {item.status}</div>
                <div className="truncate">
                  tx: {item.txHash ? <a className="text-[#fcc025] underline" href={`https://sepolia.etherscan.io/tx/${item.txHash}`} target="_blank" rel="noreferrer">{item.txHash}</a> : '--'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
