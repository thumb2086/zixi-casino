import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Megaphone, AlertTriangle, ShieldAlert, Gift,
  ChevronDown, Loader2, X, Clock, HeartPulse, Coins, Sparkles,
} from 'lucide-react';
import { formatNumber } from '@repo/shared';
import { useTranslation } from 'react-i18next';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useUserStore } from '../../store/useUserStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import AppBottomNav from '../../components/AppBottomNav';

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'urgent';
  createdAt: string;
  active: boolean;
};

interface Campaign {
  campaignId: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  maxClaimsPerUser?: number;
  rewards?: any;
  claimed?: boolean;
}

const REWARD_NAMES: Record<string, string> = {
  title_newbie: '新手',
  title_gambler: '賭徒',
  title_highroller: '豪客',
  title_god: '賭神',
  title_member_1: '普通會員',
  title_member_2: '普通菁英',
  title_member_3: '青銅會員',
  title_member_4: '白銀會員',
  title_member_5: '黃金會員',
  title_member_6: '白金會員',
  title_member_7: '鑽石一階',
  title_member_8: '鑽石二階',
  title_member_9: '黑鑽一階',
  title_member_10: '黑鑽二階',
  title_member_11: '菁英一階',
  title_member_12: '菁英二階',
  title_member_13: '宗師一階',
  title_member_14: '宗師二階',
  title_member_15: '王者一階',
  title_member_16: '王者二階',
  title_member_17: '至尊一階',
  title_member_18: '至尊二階',
  title_member_19: '蒼穹一階',
  title_member_20: '蒼穹二階',
  title_member_21: '寰宇一階',
  title_member_22: '寰宇二階',
  title_member_23: '星穹一階',
  title_member_24: '星穹二階',
  title_member_25: '萬界一階',
  title_member_26: '萬界二階',
  title_member_27: '創世一階',
  title_member_28: '創世二階',
  title_member_29: '永恆一階',
  title_member_30: '永恆二階',
  title_member_31: '深淵一階',
  title_member_32: '深淵二階',
  chest_key_common: '普通寶箱鑰匙',
  chest_key_rare: '稀有寶箱鑰匙',
  chest_key_epic: '史詩寶箱鑰匙',
  chest_key_legendary: '傳說寶箱鑰匙',
  chest_key_mythic: '神話寶箱鑰匙',
};

function formatRelativeTime(value: string, t: (key: string, opts?: any) => string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return t('common.just_now');
  if (minutes < 60) return t('common.minutes_ago', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.hours_ago', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('common.yesterday');
  return t('common.days_ago', { count: days });
}

function resolveRewardName(id: string): string {
  return REWARD_NAMES[id] || id;
}

function formatRewardSummary(r: any, t: (k: string, d?: string) => string): string {
  if (!r || typeof r !== 'object') return t('rewardName.reward', '獎勵');
  const parts: string[] = [];
  if (typeof r.zxc === 'number' && r.zxc > 0) parts.push(`${formatNumber(r.zxc)} ZXC`);
  if (typeof r.yjc === 'number' && r.yjc > 0) parts.push(`${formatNumber(r.yjc)} YJC`);
  if (Array.isArray(r.items) && r.items.length > 0) {
    const labels = r.items.map((it: any) => {
      const name = it.name || resolveRewardName(it.id || '') || it.id || t('rewardName.item', '道具');
      const qty = it.qty || 1;
      return qty > 1 ? `${name} x${qty}` : name;
    });
    parts.push(labels.join(', '));
  }
  if (Array.isArray(r.avatars) && r.avatars.length) parts.push(`${t('rewardName.avatar', '頭像')}: ${r.avatars.map((a: string) => resolveRewardName(a)).join(', ')}`);
  if (Array.isArray(r.titles) && r.titles.length) parts.push(`${t('rewardName.title', '稱號')}: ${r.titles.map((tl: string) => resolveRewardName(tl)).join(', ')}`);
  return parts.length ? parts.join(' + ') : t('rewardName.reward', '獎勵');
}



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



function TransactionsFeed({ nf }: { nf: (v: number | string) => string }) {
  const { t } = useTranslation();
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
    <>
      <section className="bg-card rounded-2xl p-6 border border-border/20 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black text-white truncate">{username || '未設定'}</p>
          <p className="text-xs font-bold text-secondary truncate mt-1">{displayAddress || ''}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black italic text-accent">{nf(balance || 0)} ZXC</p>
        </div>
      </section>

      <div className="flex items-center gap-3 bg-card rounded-2xl px-5 py-3 border border-border/10">
        <Clock size={14} className="text-accent" />
        <span className="text-caption font-bold text-secondary uppercase tracking-wider">
          伺????
        </span>
        <span className="text-xs font-bold text-emerald-400 ml-auto">
          {serviceStats?.serverUptimeLabel || '...'}
        </span>
        <span className="text-caption font-bold text-secondary">
          {serviceStats?.uptime ? `?用 ${serviceStats.uptime}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl p-5 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={14} className="text-accent" />
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">總交</span>
          </div>
          <p className="text-xl font-black italic text-accent">{nf(summary?.total ?? 0)}</p>
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">??</span>
          </div>
          <p className="text-xl font-black italic text-emerald-400">{nf(summary?.confirmed ?? 0)}</p>
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse size={14} className="text-accent" />
            <span className="text-xs font-bold uppercase tracking-widest text-secondary"></span>
          </div>
          <p className="text-xl font-black italic text-accent">{summary?.total ? `${successRatePct}%` : '0%'}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/10 bg-card p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
          ?????????
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
                  <p className="text-xs font-bold tracking-[0.14em] text-white">
                    {`${t('txType.' + item.type, item.type)} ${nf(Number(item.amount))} ${item.tokenSymbol || 'ZXC'}`}
                  </p>
                  <p className="mt-1 text-xs font-bold tracking-[0.12em] text-secondary">
                    {item.userAddress?.slice(0, 10)}... / {item.gameType || item.type} {String(item.roundId).length > 20 ? String(item.roundId).slice(0,20)+'...' : String(item.roundId)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-secondary">{t('txStatus.' + item.status, item.status)}</p>
                  <p className="mt-1 text-xs font-bold text-secondary">{new Date(item.createdAt).toLocaleString('zh-TW')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default function AnnouncementCenter() {
  const { t } = useTranslation();
  const { sessionId } = useAuthStore();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');

  const [filter, setFilter] = useState<'ANNOUNCEMENT' | 'EVENTS' | 'TRANSACTIONS'>('ANNOUNCEMENT');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [successBundle, setSuccessBundle] = useState<any>(null);

  useEffect(() => {
    api.get('/api/v1/announcements')
      .then((res) => { setItems(Array.isArray(res.data.data) ? res.data.data : []); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get('/api/v1/rewards/campaigns')
      .then((res) => { setCampaigns(res?.data?.data?.campaigns || []); })
      .catch(() => setCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (claimMsg) { const t2 = setTimeout(() => setClaimMsg(null), 3000); return () => clearTimeout(t2); }
  }, [claimMsg]);

  const featured = useMemo(() => {
    return items.find((item) => item.type === 'urgent' || item.active === false) || null;
  }, [items]);

  const getBadgeStyle = (type: AnnouncementItem['type']) => {
    switch (type) {
      case 'urgent': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'warning': return 'bg-accent/10 text-accent border-accent/20';
      default: return 'bg-white/10 text-white border-white/20';
    }
  };

  const typeLabel = (type: AnnouncementItem['type']) => {
    if (type === 'urgent') return t('announcement.type_urgent');
    if (type === 'warning') return t('announcement.type_warning');
    return t('announcement.type_info');
  };

  async function claim(campaignId: string) {
    if (!sessionId) { setClaimMsg('請先登入'); return; }
    setClaimMsg(null);
    try {
      const res = await api.post(`/api/v1/rewards/campaigns/${encodeURIComponent(campaignId)}/claim`, { sessionId });
      const payload = res?.data?.data;
      if (payload?.error) { setClaimMsg(payload.error.message || payload.error.code || '請求失敗'); return; }
      setSuccessBundle(payload?.bundle || null);
      setClaimMsg('領取成功');
      const refreshed = await api.get('/api/v1/rewards/campaigns');
      setCampaigns(refreshed?.data?.data?.campaigns || []);
    } catch (err: any) {
      setClaimMsg(err?.response?.data?.data?.error?.message || err?.response?.data?.error?.message || err?.message || '請求失敗');
    }
  }

  return (
    <div className="min-h-screen bg-surface text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-border/20">
        <div className="flex items-center justify-between px-6 py-4 ">
          <div className="flex items-center gap-4">
            <Megaphone className="text-accent" />
            <h1 className="font-extrabold tracking-tight text-xl text-accent uppercase italic">???活</h1>
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 space-y-8">
        {/* Tabs */}
        <div className="flex bg-card p-1.5 rounded-xl border border-border/20">
          {(['ANNOUNCEMENT', 'EVENTS', 'TRANSACTIONS'] as const).map((entry) => (
            <button key={entry} type="button" onClick={() => setFilter(entry)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${filter === entry ? 'bg-accent text-black shadow-lg' : 'text-secondary hover:text-white'}`}
            >
              {entry === 'ANNOUNCEMENT' ? '公告' : entry === 'EVENTS' ? '活動' : '交易'}
            </button>
          ))}
        </div>

        {/* Announcements Tab */}
        {filter === 'ANNOUNCEMENT' && (
          <>
            <section className="bg-gradient-to-br from-red-600/20 to-transparent rounded-2xl p-6 border border-red-500/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <ShieldAlert size={80} />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-red-500 animate-pulse" size={20} />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">{t('announcement.critical_alert')}</span>
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase mb-2">
                {featured?.title || t('announcement.no_active')}
              </h2>
              <p className="text-xs text-secondary font-bold uppercase leading-relaxed mb-6">
                {featured?.content || t('announcement.feed_online')}
              </p>
              <div className="text-xs font-bold uppercase tracking-widest text-white/70">
                {featured ? formatRelativeTime(featured.createdAt, t) : 'SYNCED'}
              </div>
            </section>

            <div className="flex items-center gap-2 px-2">
              <div className="w-1 h-3 bg-accent rounded-full" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">{t('announcement.system_alerts')}</h3>
            </div>

            <section className="space-y-4">
              {loading && (
                <div className="bg-card rounded-xl p-5 border border-border/10 text-xs font-bold uppercase tracking-widest text-secondary">
                  {t('announcement.loading')}
                </div>
              )}
              {!loading && items.length === 0 && (
                <div className="bg-card rounded-xl p-5 border border-border/10 text-xs font-bold uppercase tracking-widest text-secondary">
                  {t('announcement.no_category')}
                </div>
              )}
              {items.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="bg-card rounded-xl p-5 border border-border/10 group hover:bg-[#201f1f] transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${getBadgeStyle(item.type)}`}>
                            {typeLabel(item.type)}
                          </span>
                          <span className="text-xs font-bold text-muted uppercase tracking-widest">{formatRelativeTime(item.createdAt, t)}</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-tight text-white group-hover:text-accent transition-colors">{item.title}</h4>
                          <p className={`text-xs text-secondary font-bold mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>{item.content}</p>
                        </div>
                      </div>
                      <ChevronDown size={16} className={`shrink-0 text-muted group-hover:text-accent transition-all duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {/* Transactions Tab */}
        {filter === 'TRANSACTIONS' && <TransactionsFeed nf={nf} />}

        {/* Events Tab */}
        {filter === 'EVENTS' && (
          <section className="space-y-4">
            {claimMsg && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-card border border-accent/40 shadow-lg shadow-black/50 text-sm font-bold text-white whitespace-nowrap">
                {claimMsg}
              </div>
            )}
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-accent" size={24} /></div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-2xl border border-border/20 bg-card px-4 py-8 text-center text-sm text-secondary">
                ??沒???中?活?
              </div>
            ) : (
              campaigns.map((c) => (
                <section key={c.campaignId} className="rounded-2xl border border-border/20 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-white">{c.title}</h2>
                      {c.description && <p className="mt-1 text-sm text-secondary break-words">{c.description}</p>}
                    </div>
                    <Gift size={18} className="shrink-0 text-accent" />
                  </div>
                  <div className="mt-3 rounded-lg bg-elevated px-3 py-2 text-sm text-accent">
                    {formatRewardSummary(c.rewards, t)}
                  </div>
                  {(c.startAt || c.endAt) && (
                    <p className="mt-2 text-sm text-secondary">
                      {c.startAt ? new Date(c.startAt).toLocaleString() : '即刻'} ~ {c.endAt ? new Date(c.endAt).toLocaleString() : '永久有效'}
                    </p>
                  )}
                  <button type="button" disabled={Boolean(c.claimed) || !sessionId}
                    onClick={() => claim(c.campaignId)}
                    className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-110"
                  >
                    {c.claimed ? '已領取' : !sessionId ? '請先登入' : '領取獎勵'}
                  </button>
                </section>
              ))
            )}
          </section>
        )}
      </main>

      {successBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setSuccessBundle(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border/20 bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-accent">?? ????</h3>
              <button type="button" onClick={() => setSuccessBundle(null)} className="rounded-lg p-1 hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-white">
              {successBundle.zxc > 0 && <p>+ {nf(Number(successBundle.zxc))} ZXC</p>}
              {successBundle.yjc > 0 && <p>+ {nf(Number(successBundle.yjc))} YJC</p>}
              {Array.isArray(successBundle.items) && successBundle.items.map((it: any, i: number) => (
                <p key={i}>?具：{it.name || resolveRewardName(it.id) || it.id} {it.qty > 1 ? `?${it.qty}` : ''}</p>
              ))}
              {Array.isArray(successBundle.avatars) && successBundle.avatars.map((a: any, i: number) => (
                <p key={i}>??：{a.name || resolveRewardName(a.id || a) || a.id || a}</p>
              ))}
              {Array.isArray(successBundle.titles) && successBundle.titles.map((t: any, i: number) => (
                <p key={i}>稱?：{t.name || resolveRewardName(t.id || t) || t.id || t}</p>
              ))}
            </div>
            <button type="button" onClick={() => setSuccessBundle(null)} className="mt-4 w-full rounded-lg bg-accent px-3 py-2 text-sm font-black text-black">確?</button>
          </div>
        </div>
      )}

      <AppBottomNav current="none" />
    </div>
  );
}




