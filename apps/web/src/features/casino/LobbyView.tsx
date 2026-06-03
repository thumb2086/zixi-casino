import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Bell,
  ChevronRight,
  Crown,
  Dice5,
  History,
  LayoutGrid,
  Package,
  Settings as SettingsIcon,
  ShoppingBag,
  Trophy,
  User,
  Landmark,
  Building2,
  TrendingUp,
  CalendarClock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@repo/shared';
import { useUserStore } from '../../store/useUserStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { api } from '../../store/api';
import AppBottomNav from '../../components/AppBottomNav';
import { useWallet } from '../wallet/useWallet';
import { resolvePreferredBalance } from '../../utils/balance';
import { useLeaderboard } from '../../hooks/useLeaderboard';



function GlassCard({
  to,
  icon: Icon,
  title,
  value,
  subtitle,
  border = false,
  children,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value?: string;
  subtitle?: string;
  border?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`relative rounded-xl bg-card p-6 transition-all hover:bg-elevated active:scale-95 ${
        border ? 'border-l-4 border-l-[#fcc025]/40' : 'border border-border/10'
      }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/20 bg-elevated transition-colors">
          <Icon className="h-6 w-6 text-accent" />
        </div>
        {subtitle && <span className="text-xs font-bold uppercase tracking-widest text-secondary">{subtitle}</span>}
      </div>
      <h4 className="mb-2 text-lg font-bold uppercase tracking-tight text-white">{title}</h4>
      {value && <div className="mb-1 text-2xl font-bold uppercase italic tracking-tighter text-white">{value}</div>}
      {children}
    </Link>
  );
}

export default function LobbyView() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const { username, address, balance } = useUserStore();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const queryClient = useQueryClient();
  const { summary } = useWallet();
  const { data: leaderboardData } = useLeaderboard('all', 50);
  const selfRank = leaderboardData?.selfRank?.rank;

  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as {
        isAdmin?: boolean;
        vipLevel?: string;
        maxBet?: number;
        level?: number;
        xp?: number;
        xpTierLabel?: string;
        xpNextLevel?: number;
        xpProgress?: number;
      } | undefined;
    },
    staleTime: 60000,
  });
  const isAdmin = Boolean(profileData?.isAdmin);
  const vipLevel = profileData?.vipLevel || '';

  const { data: missionsData } = useQuery({
    queryKey: ['missions'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v1/missions');
        return res.data?.data?.missions || [];
      } catch { return []; }
    },
    staleTime: 30000,
    retry: 1,
  });
  const missions = missionsData || [];
  const claimMission = useCallback(async (missionId: string) => {
    try {
      const { sessionId } = useAuthStore.getState();
      const res = await api.post('/api/v1/missions/claim', { sessionId, missionId });
      if (res.data?.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['missions'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      }
    } catch {}
  }, [queryClient]);
  const ZXC_PER_YJC = 100_000_000;
  const liveZxc = resolvePreferredBalance({
    onchainBalance: summary.data?.onchain?.zxc?.balance,
    onchainAvailable: summary.data?.onchain?.zxc?.available,
    walletBalance: summary.data?.summary?.balances?.ZXC,
    fallbackBalance: balance,
  });
  const liveYjc = resolvePreferredBalance({
    onchainBalance: summary.data?.onchain?.yjc?.balance,
    onchainAvailable: summary.data?.onchain?.yjc?.available,
    walletBalance: summary.data?.summary?.balances?.YJC,
    fallbackBalance: '0',
  });
  const liveBalance = (Number(liveZxc || 0) + Number(liveYjc || 0) * ZXC_PER_YJC).toFixed(2);

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-preview'],
    queryFn: async () => {
      const res = await api.get('/api/v1/inventory');
      return (res.data?.data?.items || []) as Array<{ id: string; icon: string; name: string; rarity: string; rarityColor?: string }>;
    },
    refetchInterval: 30000,
  });
  const previewItems = (inventoryData || []).slice(0, 4);

  const { data: recentTxs } = useQuery({
    queryKey: ['recent-activity-preview'],
    queryFn: async () => {
      const res = await api.get('/api/v1/dashboard/transactions', { params: { limit: 2, page: 1 } });
      return (res.data?.data?.items || []) as Array<{ type: string; amount: string; tokenSymbol?: string; status: string; createdAt: string }>;
    },
    refetchInterval: 15000,
  });

  const { data: annData } = useQuery({
    queryKey: ['announcement-count'],
    queryFn: async () => {
      const res = await api.get('/api/v1/support/announcements');
      const anns = (res.data?.data?.announcements || []) as any[];
      return anns.filter((a: any) => a.isPinned).length;
    },
    staleTime: 60000,
  });
  const pinnedCount = annData ?? 0;

  const { data: marketAccount } = useQuery({
    queryKey: ['market-account-preview'],
    queryFn: async () => {
      const res = await api.get('/api/v1/market/me');
      return res.data?.data?.account as { bankBalance?: number; stockValue?: number } | undefined;
    },
    refetchInterval: 30000,
  });
  const bankBalance = marketAccount?.bankBalance?.toFixed(2) || '0';
  const stockValue = marketAccount?.stockValue?.toFixed(2) || '0';

  return (
    <div className="min-h-screen bg-surface pb-24 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex items-center gap-4">
            <motion.div whileTap={{ scale: 0.9 }}>
              <LayoutGrid className="cursor-pointer text-accent" />
            </motion.div>
            <h1 className="truncate text-xl font-extrabold uppercase italic tracking-tighter text-accent">
              {t('lobby.title')}
            </h1>
          </div>
          <Link
            to="/app/transactions"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-accent/20 shadow-[0_0_15px_rgba(252,192,37,0.1)] flex items-center justify-center bg-card"
          >
            <User size={20} className="text-secondary" />
          </Link>
        </div>
      </header>

      <main className="app-shell space-y-8 pt-24">
        <section className="relative overflow-hidden rounded-2xl border border-accent/10 p-8 shadow-2xl" style={{ background: 'linear-gradient(135deg, #14141f 0%, #1a1925 40%, rgba(252,192,37,0.06) 60%, #1a1925 100%)' }}>
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[100px]" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-secondary">
                {t('lobby.operator_identified')}
              </p>
              <h2 className="text-4xl font-extrabold uppercase italic tracking-tight">
                {username || (address ? address.slice(0, 8) : t('lobby.anonymous'))}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  {vipLevel}
                </span>
                <span className="flex items-center gap-1 text-caption font-bold uppercase tracking-wider text-secondary">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  {t('lobby.encryption_active')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-secondary">
                {t('vault.total_assets')}
              </p>
              <div className="text-5xl font-black uppercase italic tracking-tighter text-accent">
                {nf(liveBalance || 0)} <span className="text-lg not-italic text-white">ZXC</span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-secondary">
                <span className="flex items-center gap-1">
                  <Landmark size={12} className="text-accent" />
                  {t('market.bank')}: {nf(bankBalance)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp size={12} className="text-emerald-400" />
                   {t('lobby.stocks')}: {nf(stockValue)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {profileData?.level ? (
          <section className="card-accent bg-card p-6 shadow-2xl border border-border/10">
            <div className="flex items-center justify-between mb-3">
              <div>
            <div className="section-title">
              <Trophy size={14} className="text-accent shrink-0" />
              <h2 className="section-title-text">{t('lobby.featured')}</h2>
            </div>
                <p className="text-3xl font-black italic text-accent mt-1">
                  Lv.{profileData.level}{' '}
                  <span className="text-sm font-bold text-secondary">{profileData.xpTierLabel || ''}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-white">{nf(profileData.xp || 0)} XP</p>
                {profileData.xpNextLevel > 0 && (
                  <p className="text-caption text-secondary mt-0.5">下??{nf(profileData.xpNextLevel)} XP</p>
                )}
              </div>
            </div>
            {profileData.xpProgress !== undefined && (
                <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden shadow-inner">
                <div className="h-full rounded-full transition-all shadow-[0_0_10px_rgba(252,192,37,0.4)]"
                     style={{ width: `${Math.min(100, profileData.xpProgress)}%`, background: 'linear-gradient(90deg, #fcc025, #ff8c00, #ff4fff)' }} />
              </div>
            )}
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Missions at top */}
          <div className="card-success bg-card p-6 md:col-span-2 lg:col-span-3 border border-border/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">?</span>
                <h2 className="section-title-text text-success">每日任?</h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {missions.filter((m: any) => !m.claimed).map((m: any) => {
                const pct = m.target > 0 ? Math.min(100, (m.progress / m.target) * 100) : 0;
                const done = m.progress >= m.target;
                const locked = m.locked;
                return (
                  <div key={m.id} className={`rounded-xl border ${locked ? 'border-border/10 opacity-50' : done ? 'border-accent/40' : 'border-border/20'} bg-surface p-4`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-bold text-white">{locked ? '?? ' : ''}{m.name}</p>
                        <p className="text-caption text-secondary mt-0.5">{locked ? `??VIP ${m.vip} 以?` : m.desc}</p>
                      </div>
                      <span className="text-caption font-bold text-accent shrink-0 ml-2">{m.reward.toLocaleString()} ZXC</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-card mb-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#fcc025] to-[#e6ad03]" style={{ width: `${locked ? 0 : pct}%` }} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-caption text-secondary">{locked ? '-' : `${m.progress}/${m.target}`}</span>
                      {locked ? null : done ? (
                        <button onClick={() => claimMission(m.id)} className="text-caption font-bold text-black bg-accent px-2 py-1 rounded-lg hover:brightness-110">??</button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <GlassCard
            to="/app/announcement"
            icon={CalendarClock}
            title={t('lobby.events')}
            subtitle={pinnedCount > 0 ? `${pinnedCount} ?置?` : t('lobby.events_subtitle')}
          >
            <div className="mt-4 space-y-2 text-xs font-bold uppercase tracking-wider text-secondary">
              {!recentTxs || recentTxs.length === 0 ? (
                <div className="flex gap-2">
                  <History size={12} className="text-accent" />
                  {t('lobby.no_activity')}
                </div>
              ) : recentTxs.slice(0, 2).map((tx, i) => (
                <div key={i} className="flex gap-2 truncate">
                  <span className="text-accent shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="truncate">{t('txType.' + tx.type, tx.type)} · {nf(Number(tx.amount))} {tx.tokenSymbol || ''}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard
            to="/app/leaderboard"
            icon={Trophy}
            title={t('lobby.rankings')}
            value={selfRank ? `#${selfRank}` : '-'}
            subtitle={t('lobby.global_sector')}
          />


          <GlassCard
            to="/app/inventory"
            icon={Bell}
            title={t('nav.inventory')}
            subtitle={t('lobby.items_count', { count: (inventoryData || []).length || 0 })}
          >
            <div className="mt-4 grid grid-cols-4 gap-2">
              {previewItems.length > 0 ? previewItems.map((invItem) => (
                <Link key={invItem.id} to="/app/inventory" className="group aspect-square rounded border border-border/20 bg-elevated flex flex-col items-center justify-center gap-0.5 hover:border-accent/40 transition-all hover:scale-105" title={invItem.name}>
                  <span className="text-base leading-none">{invItem.icon}</span>
                  <span className="text-[7px] font-bold text-secondary truncate w-full text-center leading-tight px-0.5">{invItem.name}</span>
                </Link>
              )) : [1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square rounded border border-border/20 bg-elevated" />
              ))}
            </div>
          </GlassCard>

          <div
            className={`rounded-xl bg-card p-6 transition-all border-l-4 border-l-[#fcc025]/40`}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/20 bg-elevated">
                <Crown className="h-6 w-6 text-accent" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-secondary">
                {t('lobby.guides')}
              </span>
            </div>
            <h4 className="mb-2 text-lg font-bold uppercase tracking-tight text-white">
              {t('lobby.info_center')}
            </h4>
            <div className="mt-4 space-y-3">
              <Link to="/app/info?tab=vip" className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-accent/40" style={{ background: 'linear-gradient(135deg, rgba(255,79,255,0.08), rgba(252,192,37,0.08))' }}>
                <Crown className="h-5 w-5 text-warning" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">{t('lobby.vip_levels')}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-secondary">
                    {t('lobby.tier_active', { tier: profileData?.vipLevel?.replace(/[^\d]/g, '') || 1 })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-secondary" />
              </Link>
              
              <Link to="/app/info?tab=odds" className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-success/40">
                <Dice5 className="h-5 w-5 text-success" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">{t('lobby.game_odds')}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-secondary">
                    {t('lobby.odds_subtitle')}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-secondary" />
              </Link>
              
              <Link to="/app/info?tab=items" className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-info/40">
                <Package className="h-5 w-5 text-info" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">{t('lobby.items_catalog')}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-secondary">
                    {t('lobby.items_subtitle')}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-secondary" />
              </Link>
            </div>
          </div>

          <GlassCard
            to="/app/company"
            icon={Building2}
            title={t('lobby.my_company')}
            subtitle={t('lobby.ai_chip_simulation')}>
            <div className="absolute top-2 right-2 bg-accent text-[#0e0e0e] text-[8px] font-bold px-2 py-0.5 rounded-full">BETA</div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-tight text-secondary">
              {t('lobby.company_description')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-caption font-bold uppercase tracking-widest text-emerald-400">
                {t('lobby.simulation_label')}
              </span>
            </div>
          </GlassCard>
          {isAdmin && (
            <GlassCard
              to="/app/admin"
              icon={SettingsIcon}
              title={t('nav.admin')}
              subtitle={t('lobby.authorized_only')}
            >
              <p className="mt-2 text-xs font-bold uppercase tracking-tight text-secondary">
                {t('lobby.admin_summary')}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1 w-1 animate-pulse rounded-full bg-accent" />
                <span className="text-xs font-bold uppercase tracking-widest text-secondary">
                  {t('lobby.system_secure')}
                </span>
              </div>
            </GlassCard>
          )}


        </section>
      </main>

      <AppBottomNav current="home" />
    </div>
  );
}





