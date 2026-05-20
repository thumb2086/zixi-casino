import { useQuery } from '@tanstack/react-query';
import { api } from '../../store/api';
import { Activity, HeartPulse, Coins, Sparkles, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatNumber } from '@repo/shared';
import { useUserStore } from '../../store/useUserStore';
import { useAuthStore } from '../../store/useAuthStore';
import AppBottomNav from '../../components/AppBottomNav';

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

export default function PublicTransactionsView() {
  const { t } = useTranslation();
  const { address, username, balance, activeAvatar, activeTitle } = useUserStore();
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
        items: txRes.data.data.items as DashboardTx[],
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

  const items = txData?.items || [];
  const summary = txData?.summary;
  const ledgerEvents = recentTxData?.events || [];

  const successRatePct = Number.isFinite((summary?.successRate ?? 0) * 100)
    ? Number(((summary?.successRate ?? 0) * 100).toFixed(2))
    : 0;

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="app-shell flex items-center gap-3 py-4">
          <Activity className="text-[#fcc025]" />
          <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">
            {t('transactions.title')}
          </h1>
        </div>
      </header>

      <main className="app-shell pt-24">
        <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20 flex items-center gap-6 mb-6">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-white truncate">{username || '未設定'}</p>
            <p className="text-xs font-bold text-[#adaaaa] truncate mt-1">{displayAddress || ''}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black italic text-[#fcc025]">{Number(balance || 0).toLocaleString()} ZXC</p>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#1a1919] rounded-2xl p-5 border border-[#494847]/20">
            <div className="flex items-center gap-2 mb-2">
              <Coins size={14} className="text-[#fcc025]" />
              <span className="text-xs font-black uppercase tracking-widest text-[#adaaaa]">總交易</span>
            </div>
            <p className="text-xl font-black italic text-[#fcc025]">{formatNumber(summary?.total ?? 0)}</p>
          </div>
          <div className="bg-[#1a1919] rounded-2xl p-5 border border-[#494847]/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-widest text-[#adaaaa]">成功</span>
            </div>
            <p className="text-xl font-black italic text-emerald-400">{formatNumber(summary?.confirmed ?? 0)}</p>
          </div>
          <div className="bg-[#1a1919] rounded-2xl p-5 border border-[#494847]/20">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse size={14} className="text-[#fcc025]" />
              <span className="text-xs font-black uppercase tracking-widest text-[#adaaaa]">成功率</span>
            </div>
            <p className="text-xl font-black italic text-[#fcc025]">{successRatePct}%</p>
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

        <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">
            {t('transactions.latest_activity')}
          </p>
          <div className="mt-4 space-y-3">
            {isLoading && <div className="text-sm text-[#adaaaa]">{t('common.loading')}</div>}
            {!isLoading && items.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#494847]/20 p-4 text-sm text-[#adaaaa]">
                {t('transactions.empty')}
              </div>
            )}
            {items.map((item: DashboardTx) => (
              <div key={item.id} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white">
                      {`${item.type?.toUpperCase?.() || 'TX'} • ${formatNumber(Number(item.amount))} ${item.tokenSymbol || ''}`}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#adaaaa]">
                      {item.userAddress?.slice(0, 10)}... / round {String(item.roundId)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#fcc025]">{item.status}</p>
                    <p className="mt-1 text-xs font-bold text-[#adaaaa]">{new Date(item.createdAt).toLocaleString('zh-TW')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-[#fcc025]" />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">錢包動態</p>
          </div>
          <div className="space-y-2">
            {ledgerEvents.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#494847]/20 p-4 text-sm text-[#adaaaa]">暫無記錄</div>
            )}
            {ledgerEvents.map((entry: LedgerEntry) => (
              <div key={entry.id} className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{entry.type}</span>
                  <span className="text-xs font-bold text-[#fcc025]">{entry.token} {formatNumber(Number(entry.amount))}</span>
                </div>
                <p className="text-[10px] text-[#adaaaa] mt-1">{entry.address?.slice(0, 10)}... · {new Date(entry.createdAt).toLocaleString('zh-TW')}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
