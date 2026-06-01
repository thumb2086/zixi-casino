import { useMemo, useState } from 'react';
import { Crown, Loader2, Trophy, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@repo/shared';
import { useUserStore } from '../../store/useUserStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useLeaderboard, type LeaderboardType } from '../../hooks/useLeaderboard';
import AppBottomNav from '../../components/AppBottomNav';

type LeaderboardCategory = 'xp' | 'asset';
type FilterLabel = 'WEEKLY' | 'MONTHLY' | 'SEASON' | 'ALL-TIME';

const FILTER_MAP: Record<FilterLabel, string> = {
  WEEKLY: 'week',
  MONTHLY: 'month',
  SEASON: 'season',
  'ALL-TIME': 'xp',
};

const FILTER_LABELS: FilterLabel[] = ['WEEKLY', 'MONTHLY', 'SEASON', 'ALL-TIME'];

const getAvatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const getDisplayName = (entry: { displayName: string | null; address: string }) =>
  entry.displayName || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`;

function getPeriodEnd(filter: string): Date {
  const now = new Date();
  if (filter === 'WEEKLY') {
    // Next Sunday 03:00 UTC
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + (7 - d.getUTCDay()) % 7);
    d.setUTCHours(3, 0, 0, 0);
    if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (filter === 'MONTHLY') {
    // End of current month 00:00 UTC next month 1st
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    return d;
  }
  if (filter === 'SEASON') {
    // End of current quarter (last day of quarter month)
    const endMonth = Math.floor(now.getUTCMonth() / 3) * 3 + 2; // 2=Mar, 5=Jun, 8=Sep, 11=Dec
    const d = new Date(Date.UTC(now.getUTCFullYear(), endMonth + 1, 1, 0, 0, 0)); // 1st of next month
    return d;
  }
  return now;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '—';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function KingPodium({ kings, nf, totalCount, remainingTime }: { kings: any[]; nf: (v: any) => string; totalCount?: number; remainingTime?: string }) {
  if (!kings || kings.length === 0) return null;
  const ordered = kings.length < 3 ? kings : [kings[1], kings[0], kings[2]].filter(Boolean);
  const podium = [
    { item: ordered[1], cls: 'h-32 w-28 border-t-accent/30 bg-gradient-to-t from-card to-accent/20', icon: <Crown size={32} className="text-accent" fill="currentColor" />, rankCls: 'bg-accent text-black text-sm', extraCls: '-translate-y-4' },
    { item: ordered[0], cls: 'h-24 w-20 border-t-slate-400/30 bg-gradient-to-t from-card to-slate-400/20', rankCls: 'bg-slate-400 text-black text-xs', extraCls: '' },
    { item: ordered[2], cls: 'h-20 w-20 border-t-amber-700/30 bg-gradient-to-t from-card to-amber-700/20', rankCls: 'bg-amber-700 text-white text-xs', extraCls: '' },
  ];
  return (
      <section className="card-accent bg-card p-4 border border-border/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-accent" />
          <span className="text-xs font-black uppercase tracking-widest text-accent">🏆 榜王前三</span>
        </div>
        <div className="flex items-center gap-3">
          {remainingTime ? (
            <span className="text-sm font-bold text-accent/60">{remainingTime}</span>
          ) : totalCount !== undefined ? (
            <span className="text-sm font-bold text-secondary">共 {totalCount} 人</span>
          ) : null}
          {kings.length === 0 && (
            <span className="text-[10px] text-secondary">暫無資料</span>
          )}
        </div>
      </div>
      <div className="flex items-end justify-center gap-4 pt-6">
        {podium.map((p, i) => p.item ? (
          <div key={i} className={`flex flex-col items-center space-y-3 ${p.extraCls}`}>
            <div className="relative">
              <div className={`flex ${i === 0 ? 'h-20 w-20 border-4 mt-6' : 'h-14 w-14 border-2'} items-center justify-center overflow-hidden rounded-2xl border-accent bg-elevated text-3xl`}>
                {i === 0 && <div className="absolute -top-6 left-1/2 -translate-x-1/2">{p.icon}</div>}
                {p.item.avatarIcon || <img src={getAvatarUrl(p.item.name)} alt={p.item.name} className="w-full h-full object-cover" />}
              </div>
              <div className={`absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-lg ${p.rankCls} font-black`}>
                {p.item.rank}
              </div>
            </div>
            <div className={`flex flex-col items-center justify-center rounded-t-xl border-t p-2 text-center ${p.cls}`}>
              <p className="w-full truncate text-xs font-black text-white">{p.item.name}</p>
              <p className="mt-0.5 text-xs font-black text-accent">{nf(p.item.amount)} 次</p>
            </div>
          </div>
        ) : null)}
      </div>
    </section>
  );
}

export default function LeaderboardView() {
  const { t } = useTranslation();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const { address } = useUserStore();
  const [category, setCategory] = useState<LeaderboardCategory>('xp');
  const [filter, setFilter] = useState<FilterLabel>('ALL-TIME');

  const showTimeRemaining = category === 'xp' && filter === 'WEEKLY';

  // Pre-fetch ALL leaderboard types on mount so switching tabs is instant
  const { data: xpAllData } = useLeaderboard('xp', 50);
  const { data: assetData } = useLeaderboard('asset', 50);
  const { data: kingsData } = useLeaderboard('kings', 3);
  const { data: weekData } = useLeaderboard('week' as any, 50);
  const { data: monthData } = useLeaderboard('month' as any, 50);
  const { data: seasonData } = useLeaderboard('season' as any, 50);

  const data = category === 'asset' ? assetData
    : filter === 'WEEKLY' ? weekData
    : filter === 'MONTHLY' ? monthData
    : filter === 'SEASON' ? seasonData
    : xpAllData;

  const isLoading = !data;

  const kingTop3 = useMemo(() => {
    return (kingsData?.entries || []).map((entry: any) => ({
      rank: entry.rank,
      name: getDisplayName(entry),
      amount: Number(entry.amount ?? 0),
      avatarIcon: (entry as any).activeAvatarIcon ?? null,
    }));
  }, [kingsData]);

  const categoryTabs = [
    { id: 'xp' as LeaderboardCategory, icon: Trophy, label: '經驗榜' },
    { id: 'asset' as LeaderboardCategory, icon: Wallet, label: '資產榜' },
  ];

  const metricLabels: Record<LeaderboardCategory, string> = { xp: '經驗', asset: '資產' };
  const units: Record<LeaderboardCategory, string> = { xp: 'XP', asset: 'ZXC' };
  const metricLabel = metricLabels[category];
  const unit = units[category];

  const { topThree, otherPlayers, selfEntry } = useMemo(() => {
    const entries = data?.entries ?? [];
    const normalized = entries.map((entry: any) => ({
      rank: entry.rank,
      name: getDisplayName(entry),
      amount: Number(entry.amount ?? 0),
      avatar: getAvatarUrl(entry.displayName || entry.address),
      avatarIcon: entry.activeAvatarIcon ?? null,
      titleLabel: entry.activeTitleLabel ?? null,
      vipLevel: entry.vipLevel ?? null,
      isSelf: entry.address.toLowerCase() === address?.toLowerCase(),
    }));

    const top = normalized.slice(0, 3);
    const others = normalized.slice(3);
    const rawSelf = (data?.selfRank as any) ?? entries.find((entry: any) => entry.address.toLowerCase() === address?.toLowerCase());

    return {
      topThree: top,
      otherPlayers: others,
      selfEntry: rawSelf
        ? {
            rank: rawSelf.rank,
            name: getDisplayName(rawSelf),
            amount: Number(rawSelf.amount ?? 0),
            avatarIcon: (rawSelf as any).activeAvatarIcon ?? null,
            titleLabel: (rawSelf as any).activeTitleLabel ?? null,
            vipLevel: (rawSelf as any).vipLevel ?? null,
          }
        : null,
    };
  }, [address, data]);

  const orderedTopThree = useMemo(() => {
    if (topThree.length < 3) return topThree;
    return [topThree[1], topThree[0], topThree[2]].filter(Boolean);
  }, [topThree]);



  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/15 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Trophy className="text-accent" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
              {t('leaderboard.title')}
            </h1>
          </div>
        </div>
      </header>

      <main className="app-shell pt-24">
        {isLoading && (
          <section className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="mt-4 text-sm text-secondary">{t('common.loading')}</p>
          </section>
        )}

        {error && !isLoading && (
          <section className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-red-400">{t('common.error')}</p>
            <p className="mt-2 text-xs text-secondary">{error.message}</p>
          </section>
        )}

        {!isLoading && !error && (
          <>
            <section className="mb-6">
              <KingPodium kings={kingTop3} nf={nf} totalCount={data?.entries?.length} remainingTime={showTimeRemaining ? formatTimeRemaining(getPeriodEnd(filter).getTime() - Date.now()) : undefined} />
            </section>
            <section className="flex gap-2">
              {categoryTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCategory(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 transition-all ${
                      category === tab.id
                        ? 'bg-accent text-black'
                        : 'border border-border/20 bg-card text-secondary'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-xs font-black">{tab.label}</span>
                  </button>
                );
              })}
            </section>

            {category === 'xp' && (
              <div className="flex overflow-x-auto rounded-xl border border-border/20 bg-card p-1.5">
                {FILTER_LABELS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setFilter(entry)}
                    className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                      filter === entry ? 'bg-accent text-black shadow-lg' : 'text-secondary hover:text-white'
                    }`}
                  >
                    {entry === 'ALL-TIME' ? '總累計' : entry}
                  </button>
                ))}
              </div>
            )}

            <section className="flex items-end justify-center gap-4 mt-16">
              {orderedTopThree[0] && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-400 bg-elevated text-3xl">
                      {orderedTopThree[0].avatarIcon || <img src={orderedTopThree[0].avatar} alt={orderedTopThree[0].name} />}
                    </div>
                    <div className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-400 text-xs font-black text-black">
                      {orderedTopThree[0].rank}
                    </div>
                  </div>
                  <div className="flex h-24 w-20 flex-col items-center justify-center rounded-t-xl border-t border-slate-400/30 bg-gradient-to-t from-[#1a1919] to-slate-400/20 p-2 text-center">
                    <p className="w-full truncate text-xs font-black text-white">{orderedTopThree[0].name}</p>
                    {orderedTopThree[0].vipLevel && (
                      <p className="w-full truncate text-[8px] font-bold text-emerald-400">{orderedTopThree[0].vipLevel}</p>
                    )}
                    {orderedTopThree[0].titleLabel && (
                      <p className="mt-0.5 w-full truncate text-[8px] font-bold text-accent">{orderedTopThree[0].titleLabel}</p>
                    )}
                    <p className="mt-1 text-xs font-black text-slate-400">
                      {nf(orderedTopThree[0].amount)} {unit}
                    </p>
                  </div>
                </div>
              )}

              {orderedTopThree[1] && (
                <div className="-translate-y-4 flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="absolute left-1/2 top-[-2.5rem] -translate-x-1/2 text-accent">
                      <Crown size={32} fill="currentColor" />
                    </div>
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-accent bg-elevated text-5xl shadow-[0_0_40px_rgba(252,192,37,0.3)]">
                      {orderedTopThree[1].avatarIcon || <img src={orderedTopThree[1].avatar} alt={orderedTopThree[1].name} />}
                    </div>
                    <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-sm font-black text-black">
                      1
                    </div>
                  </div>
                  <div className="flex h-32 w-28 flex-col items-center justify-center rounded-t-2xl border-t border-accent/30 bg-gradient-to-t from-[#1a1919] to-[#fcc025]/20 p-4 text-center">
                    <p className="w-full truncate text-xs font-black text-white">{orderedTopThree[1].name}</p>
                    {orderedTopThree[1].vipLevel && (
                      <p className="w-full truncate text-[8px] font-bold text-emerald-400">{orderedTopThree[1].vipLevel}</p>
                    )}
                    {orderedTopThree[1].titleLabel && (
                      <p className="mt-0.5 w-full truncate text-[8px] font-bold text-accent">{orderedTopThree[1].titleLabel}</p>
                    )}
                    <p className="mt-1 text-sm font-black text-accent">
                      {nf(orderedTopThree[1].amount)} {unit}
                    </p>
                  </div>
                </div>
              )}

              {orderedTopThree[2] && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-700 bg-elevated text-3xl">
                      {orderedTopThree[2].avatarIcon || <img src={orderedTopThree[2].avatar} alt={orderedTopThree[2].name} />}
                    </div>
                    <div className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-lg bg-amber-700 text-xs font-black text-white">
                      {orderedTopThree[2].rank}
                    </div>
                  </div>
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-t-xl border-t border-amber-700/30 bg-gradient-to-t from-[#1a1919] to-amber-700/20 p-2 text-center">
                    <p className="w-full truncate text-xs font-black text-white">{orderedTopThree[2].name}</p>
                    {orderedTopThree[2].vipLevel && (
                      <p className="w-full truncate text-[8px] font-bold text-emerald-400">{orderedTopThree[2].vipLevel}</p>
                    )}
                    {orderedTopThree[2].titleLabel && (
                      <p className="mt-0.5 w-full truncate text-[8px] font-bold text-amber-500">{orderedTopThree[2].titleLabel}</p>
                    )}
                    <p className="mt-1 text-xs font-black text-amber-500">
                      {nf(orderedTopThree[2].amount)} {unit}
                    </p>
                  </div>
                </div>
              )}
            </section>



            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {otherPlayers.map((player) => (
                <div
                  key={`${player.rank}-${player.name}`}
                  className={`group flex items-center justify-between rounded-xl border p-4 transition-all hover:bg-[#201f1f] ${
                    player.isSelf
                      ? 'border-accent bg-card shadow-[0_0_30px_rgba(252,192,37,0.1)]'
                      : 'border-border/10 bg-card'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-6 text-xs font-black ${player.isSelf ? 'text-accent' : 'text-muted'}`}>
                      {player.rank}
                    </span>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl font-bold uppercase ${
                        player.isSelf
                          ? 'border border-accent/30 bg-elevated text-accent'
                          : 'bg-elevated text-white'
                      }`}
                    >
                      {player.avatarIcon || player.name.charAt(0)}
                    </div>
                    <div>
                      <p className={`text-xs font-black ${player.isSelf ? 'text-accent' : 'text-white'}`}>
                        {player.name}
                      </p>
                      {player.vipLevel && (
                        <p className="mt-0.5 text-[10px] font-bold text-emerald-400">{player.vipLevel}</p>
                      )}
                      {player.titleLabel && (
                        <p className="mt-0.5 inline-block rounded bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          {player.titleLabel}
                        </p>
                      )}
                      {player.isSelf && (
                        <p className="text-xs font-bold tracking-tighter text-secondary">{t('leaderboard.you')}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black italic tracking-tighter ${player.isSelf ? 'text-accent' : 'text-white'}`}>
                      {nf(player.amount)} {unit}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted">{metricLabel}</p>
                  </div>
                </div>
              ))}

              {selfEntry && !otherPlayers.some((player) => player.isSelf) && (
                <div className="relative flex items-center justify-between overflow-hidden rounded-xl border-2 border-accent bg-card p-5 shadow-[0_0_30px_rgba(252,192,37,0.1)] md:col-span-2">
                  <div className="absolute right-0 top-0 p-2">
                    <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[8px] font-black uppercase text-black">
                      {t('leaderboard.you')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="w-6 text-xs font-black text-accent">{selfEntry.rank}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-elevated text-xs font-bold uppercase text-accent">
                      {selfEntry.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-white">{selfEntry.name}</p>
                      {selfEntry.vipLevel && <p className="text-[10px] font-bold text-emerald-400">{selfEntry.vipLevel}</p>}
                      {selfEntry.titleLabel && <p className="text-[10px] font-bold text-accent">{selfEntry.titleLabel}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black italic tracking-tighter text-accent">
                      {nf(selfEntry.amount)} {unit}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted">{metricLabel}</p>
                  </div>
                </div>
              )}

              {(data?.entries?.length ?? 0) === 0 && (
                <div className="py-16 text-center md:col-span-2">
                  <Trophy className="mx-auto mb-4 h-12 w-12 text-muted" />
                  <p className="text-sm font-bold text-secondary">{t('leaderboard.no_rankings')}</p>
                  <p className="mt-2 text-xs text-muted">{t('leaderboard.no_data')}</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
