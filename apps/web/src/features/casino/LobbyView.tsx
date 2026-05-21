import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  Crown,
  Dice5,
  History,
  LayoutGrid,
  Megaphone,
  Package,
  Settings as SettingsIcon,
  ShoppingBag,
  Trophy,
  User,
  Landmark,
  Archive,
  Building2,
  TrendingUp,
  CalendarClock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@repo/shared';
import { useUserStore } from '../../store/useUserStore';
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
      className={`relative rounded-xl bg-[#1a1919] p-6 transition-all hover:bg-[#262626] active:scale-95 ${
        border ? 'border-l-4 border-l-[#fcc025]/40' : 'border border-[#494847]/10'
      }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#494847]/20 bg-[#262626] transition-colors">
          <Icon className="h-6 w-6 text-[#fcc025]" />
        </div>
        {subtitle && <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">{subtitle}</span>}
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
  const { summary } = useWallet();
  const { data: leaderboardData } = useLeaderboard('all', 50);
  const selfRank = leaderboardData?.selfRank?.rank;

  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as { isAdmin?: boolean; vipLevel?: string; maxBet?: number } | undefined;
    },
    staleTime: 60000,
  });
  const isAdmin = Boolean(profileData?.isAdmin);
  const vipLevel = profileData?.vipLevel || '普通會員';
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
  const liveBalance = (Number(liveZxc || 0) + Number(liveYjc || 0) * ZXC_PER_YJC).toFixed(4);

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
    <div className="min-h-screen bg-[#0e0e0e] pb-24 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex items-center gap-4">
            <motion.div whileTap={{ scale: 0.9 }}>
              <LayoutGrid className="cursor-pointer text-[#fcc025]" />
            </motion.div>
            <h1 className="truncate text-xl font-extrabold uppercase italic tracking-tighter text-[#fcc025]">
              {t('lobby.title')}
            </h1>
          </div>
          <Link
            to="/app/transactions"
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#fcc025]/20 shadow-[0_0_15px_rgba(252,192,37,0.1)] flex items-center justify-center bg-[#1a1919]"
          >
            <User size={20} className="text-[#fcc025]" />
          </Link>
        </div>
      </header>

      <main className="app-shell space-y-8 pt-24">
        <section className="relative overflow-hidden rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-8 shadow-2xl">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fcc025]/5 blur-[100px]" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#fcc025]">
                {t('lobby.operator_identified')}
              </p>
              <h2 className="text-4xl font-extrabold uppercase italic tracking-tight">
                {username || (address ? address.slice(0, 8) : t('lobby.anonymous'))}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-emerald-400">
                  {vipLevel}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#adaaaa]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#fcc025]" />
                  {t('lobby.encryption_active')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                {t('vault.total_assets')}
              </p>
              <div className="text-5xl font-black uppercase italic tracking-tighter text-[#fcc025]">
                {formatNumber(liveBalance || 0)} <span className="text-lg not-italic text-white">ZXC</span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                <span className="flex items-center gap-1">
                  <Landmark size={12} className="text-[#fcc025]" />
                  {t('market.bank')}: {formatNumber(bankBalance)}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp size={12} className="text-emerald-400" />
                   {t('lobby.stocks')}: {formatNumber(stockValue)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <GlassCard
              to="/app/company"
              icon={Building2}
              title={t('lobby.my_company')}
              subtitle={t('lobby.ai_chip_simulation')}>
              <div className="absolute top-2 right-2 bg-[#fcc025] text-[#0e0e0e] text-[8px] font-black px-2 py-0.5 rounded-full">BETA</div>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-tight text-[#adaaaa]">
                {t('lobby.company_description')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                  {t('lobby.simulation_label')}
                </span>
              </div>
            </GlassCard>
            <GlassCard
              to="/app/admin"
              icon={SettingsIcon}
              title={t('lobby.admin_override')}
              subtitle={t('lobby.authorized_only')}>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-tight text-[#adaaaa]">
                {t('lobby.admin_tools_description')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fcc025]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#fcc025]">
                  {t('lobby.secure_label')}
                </span>
              </div>
            </GlassCard>

          <GlassCard
            to="/app/events"
            icon={CalendarClock}
            title={t('lobby.events')}
            subtitle={t('lobby.events_subtitle')}
          >
          </GlassCard>

          <GlassCard
            to="/app/leaderboard"
            icon={Trophy}
            title={t('lobby.rankings')}
            value={selfRank ? `#${selfRank}` : '-'}
            subtitle={t('lobby.global_sector')}
          />
          <GlassCard
            to="/app/transactions"
            icon={History}
            title={t('lobby.activity')}
            subtitle={t('lobby.recent_traces')}
          >
            <div className="mt-4 space-y-2 text-xs font-bold uppercase tracking-wider text-[#adaaaa]">
              {!recentTxs || recentTxs.length === 0 ? (
                <>
                  <div className="flex gap-2">
                    <span className="text-[#fcc025]">--</span>
                    {t('lobby.no_activity')}
                  </div>
                </>
              ) : recentTxs.map((tx, i) => (
                <div key={i} className="flex gap-2 truncate">
                  <span className="text-[#fcc025] shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="truncate">{tx.type} · {formatNumber(Number(tx.amount))} {tx.tokenSymbol || ''}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard
            to="/app/inventory"
            icon={Bell}
            title={t('nav.inventory')}
            subtitle={t('lobby.items_count', { count: (inventoryData || []).length || 0 })}
          >
            <div className="mt-4 grid grid-cols-4 gap-2">
              {previewItems.length > 0 ? previewItems.map((invItem) => (
                <Link key={invItem.id} to="/app/inventory" className="group aspect-square rounded border border-[#494847]/20 bg-[#262626] flex flex-col items-center justify-center gap-0.5 hover:border-[#fcc025]/40 transition-all hover:scale-105" title={invItem.name}>
                  <span className="text-base leading-none">{invItem.icon}</span>
                  <span className="text-[7px] font-bold text-[#adaaaa] truncate w-full text-center leading-tight px-0.5">{invItem.name}</span>
                </Link>
              )) : [1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square rounded border border-[#494847]/20 bg-[#262626]" />
              ))}
            </div>
          </GlassCard>
          <GlassCard
            to="/app/shop"
            icon={ShoppingBag}
            title={t('lobby.shop')}
            subtitle={t('lobby.shop_subtitle')}
          >
            <div className="mt-4 space-y-2 text-xs font-bold uppercase tracking-wider text-[#adaaaa] opacity-80">
              <div className="flex gap-2">
                <span className="text-[#fcc025]">🛒</span>
                {t('lobby.buy_chest_keys')}
              </div>
              <div className="flex gap-2">
                <span className="text-[#fcc025]">📦</span>
                {t('lobby.limited_bundles')}
              </div>
            </div>
          </GlassCard>
          <div
            className={`rounded-xl bg-[#1a1919] p-6 transition-all border-l-4 border-l-[#fcc025]/40`}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#494847]/20 bg-[#262626]">
                <Crown className="h-6 w-6 text-[#fcc025]" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                {t('lobby.guides')}
              </span>
            </div>
            <h4 className="mb-2 text-lg font-bold uppercase tracking-tight text-white">
              {t('lobby.info_center')}
            </h4>
            <div className="mt-4 space-y-3">
              <Link to="/app/info?tab=vip" className="flex items-center gap-3 rounded-lg border border-[#494847]/20 bg-[#262626] p-3 transition-colors hover:border-[#fcc025]/40">
                <Crown className="h-5 w-5 text-[#fcc025]" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">{t('lobby.vip_levels')}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                    {t('lobby.tier_active', { tier: 4 })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#adaaaa]" />
              </Link>
              
              <Link to="/app/info?tab=odds" className="flex items-center gap-3 rounded-lg border border-[#494847]/20 bg-[#262626] p-3 transition-colors hover:border-emerald-400/40">
                <Dice5 className="h-5 w-5 text-emerald-400" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">{t('lobby.game_odds')}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                    {t('lobby.odds_subtitle')}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#adaaaa]" />
              </Link>
              
              <Link to="/app/info?tab=items" className="flex items-center gap-3 rounded-lg border border-[#494847]/20 bg-[#262626] p-3 transition-colors hover:border-purple-400/40">
                <Package className="h-5 w-5 text-purple-400" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-white">{t('lobby.items_catalog')}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                    {t('lobby.items_subtitle')}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#adaaaa]" />
              </Link>
            </div>
          </div>
          <GlassCard
            to="/app/collection"
            icon={Archive}
            title={t('lobby.collection')}
            subtitle={t('lobby.collection_subtitle')}
          >
            <p className="mt-2 text-xs font-bold uppercase tracking-tight text-[#adaaaa]">
              {t('lobby.collection_description')}
            </p>
          </GlassCard>
          {isAdmin && (
            <GlassCard
              to="/app/admin"
              icon={SettingsIcon}
              title={t('nav.admin')}
              subtitle={t('lobby.authorized_only')}
            >
              <p className="mt-2 text-xs font-bold uppercase tracking-tight text-[#adaaaa]">
                {t('lobby.admin_summary')}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1 w-1 animate-pulse rounded-full bg-[#fcc025]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#fcc025]">
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
