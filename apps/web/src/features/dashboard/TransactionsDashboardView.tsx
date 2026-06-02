import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../store/api';
import { Link } from 'react-router-dom';
import { formatNumber } from '@repo/shared';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import AppBottomNav from '../../components/AppBottomNav';

type TxRow = {
  id: string;
  roundId: string | number;
  userAddress: string;
  type: 'bet' | 'payout' | 'deposit' | 'withdrawal' | 'transfer';
  amount: string;
  tokenSymbol?: string;
  status: 'pending' | 'broadcasted' | 'confirmed' | 'failed';
  txHash?: string;
  createdAt: string;
  gameType?: string;
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  broadcasted: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  failed: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
};

function toExplorerUrl(txHash: string) {
  const base = import.meta.env.VITE_EXPLORER_BASE_URL || 'https://sepolia.etherscan.io/tx/';
  return `${base}${txHash}`;
}

export default function TransactionsDashboardView() {
  const { t } = useTranslation();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const [status, setStatus] = useState<string>('');
  const [address, setAddress] = useState('');
  const [gameType, setGameType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => ({
    status: status || undefined,
    address: address || undefined,
    gameType: gameType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 20,
  }), [status, address, gameType, startDate, endDate, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-transactions', queryParams],
    queryFn: async () => {
      const res = await api.get('/api/v1/dashboard/transactions', { params: queryParams });
      return res.data?.data as { items: TxRow[]; total: number };
    },
    refetchInterval: 10000,
  });

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary', address],
    queryFn: async () => {
      const res = await api.get('/api/v1/dashboard/summary', {
        params: { address: address || undefined },
      });
      return res.data?.data as {
        total: number;
        confirmed: number;
        failed: number;
        pending: number;
        successRate: number;
      };
    },
    refetchInterval: 10000,
  });

  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const statusCounts = (data?.items || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-surface pb-28 text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <h1 className="text-lg font-black uppercase tracking-[0.1em] text-secondary">‰∫§Ê?Á¥Ä??/h1>
          <Link to="/app" className="text-xs font-bold text-secondary hover:text-accent">ËøîÂ?</Link>
        </div>
      </header>

      <main className="app-shell pt-24 space-y-4">
        <section className="grid gap-3 md:grid-cols-5">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg bg-card p-2 text-sm">
            <option value="">?®ÈÉ®?Ä??/option>
            <option value="pending">Á≠âÂ?‰∏?/option>
            <option value="broadcasted">Âª?í≠‰∏?/option>
            <option value="confirmed">Â∑≤Á¢∫Ë™?/option>
            <option value="failed">Â§±Ê?</option>
          </select>
          <input value={address} onChange={(e) => { setAddress(e.target.value); setPage(1); }} placeholder="?∞Â?" className="rounded-lg bg-card p-2 text-sm" />
          <input value={gameType} onChange={(e) => { setGameType(e.target.value); setPage(1); }} placeholder="?äÊà≤È°ûÂ?" className="rounded-lg bg-card p-2 text-sm" />
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="rounded-lg bg-card p-2 text-sm" />
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="rounded-lg bg-card p-2 text-sm" />
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border/20 bg-gradient-to-br from-[#1e1d1d] to-[#151414] p-3 text-sm">Á∏ΩÁ??? <b>{nf(summary?.total ?? 0)}</b></div>
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900/20 to-[#151414] p-3 text-sm">Â∑≤Á¢∫Ë™? <b>{summary?.confirmed ?? 0}</b></div>
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-900/20 to-[#151414] p-3 text-sm">Á≠âÂ?‰∏? <b>{summary?.pending ?? 0}</b></div>
          <div className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-900/20 to-[#151414] p-3 text-sm">?êÂ??? <b>{((summary?.successRate ?? 0) * 100).toFixed(2)}%</b></div>
        </section>

        <section className="grid gap-2 md:grid-cols-4">
          {['confirmed', 'pending', 'broadcasted', 'failed'].map((st) => (
            <div key={st} className="rounded-lg border border-border/20 bg-[#141313] p-2 text-xs text-secondary">
              {t('txStatus.' + st, st)}: <span className="text-white font-bold">{statusCounts[st] || 0}</span>
            </div>
          ))}
        </section>

        <section className="overflow-x-auto rounded-xl border border-border/10 bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border/20 text-left text-secondary">
                <th className="p-3 text-xs">?ÇÈ?</th>
                <th className="p-3 text-xs">?ûÂ?</th>
                <th className="p-3 text-xs">?∞Â?</th>
                <th className="p-3 text-xs">È°ûÂ?</th>
                <th className="p-3 text-xs">?ëÈ?</th>
                <th className="p-3 text-xs">?Ä??/th>
                <th className="p-3 text-xs">TxHash</th>
                <th className="p-3 text-xs">?äÊà≤</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="p-3" colSpan={8}>ËºâÂÖ•‰∏?..</td></tr>
              ) : (data?.items || []).map((row) => (
                <tr key={row.id} className="border-b border-border/10">
                  <td className="p-3 text-xs">{new Date(row.createdAt).toLocaleString('zh-TW')}</td>
                  <td className="p-3 text-xs">{String(row.roundId).length > 16 ? String(row.roundId).slice(0,16)+'?? : String(row.roundId)}</td>
                  <td className="p-3 text-xs">{row.userAddress}</td>
                  <td className="p-3 text-xs">{t('txType.' + row.type, row.type)}</td>
                  <td className="p-3">{nf(Number(row.amount))} {row.tokenSymbol || ''}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[row.status] || 'bg-white/10 text-white border-white/20'}`}>
                      {t('txStatus.' + row.status, row.status)}
                    </span>
                  </td>
                  <td className="p-3">
                    {row.txHash ? (
                      <a className="text-accent underline" href={toExplorerUrl(row.txHash)} target="_blank" rel="noreferrer">{row.txHash.slice(0, 10)}...</a>
                    ) : '--'}
                  </td>
                  <td className="p-3">{row.gameType || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="flex items-center justify-between text-sm text-secondary">
          <button className="rounded border border-border/30 px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‰∏ä‰???/button>
          <span>Á¨?{page} / {totalPages} ??/span>
          <button className="rounded border border-border/30 px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>‰∏ã‰???/button>
        </div>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}


