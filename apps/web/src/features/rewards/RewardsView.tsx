import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Gift,
  Star,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../store/api';
import AppBottomNav from '../../components/AppBottomNav';

const DAILY_REWARDS = [
  { day: 1, amount: '0.1 ZXC', status: 'CLAIMED' },
  { day: 2, amount: '0.2 ZXC', status: 'AVAILABLE' },
  { day: 3, amount: '0.5 ZXC', status: 'LOCKED' },
  { day: 4, amount: '1.0 ZXC', status: 'LOCKED' },
  { day: 5, amount: '2.0 ZXC', status: 'LOCKED' },
  { day: 6, amount: '5.0 ZXC', status: 'LOCKED' },
  { day: 7, amount: '10 ZXC', status: 'LOCKED' },
];

export default function RewardsView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const rewardsQuery = useQuery({
    queryKey: ['rewards-summary'],
    queryFn: async () => {
      const res = await api.get('/api/v1/rewards/summary');
      return res.data.data;
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await api.post('/api/v1/rewards/claim', { campaignId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards-summary'] });
    },
  });

  const campaigns = rewardsQuery.data?.catalog?.campaigns || [];

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/15 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Gift className="text-accent" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
              {t('vault.vip_bonus')}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-10 px-6 pt-24">
        <Link
          to="/app/events"
          className="flex items-center justify-between rounded-xl border border-accent/30 bg-gradient-to-r from-[#fcc025]/15 to-[#fcc025]/5 p-4 transition-all hover:from-[#fcc025]/25 hover:to-[#fcc025]/10"
        >
          <div>
            <p className="text-sm font-black text-white">{t('events.title')}</p>
            <p className="mt-1 text-xs text-secondary">{t('events.no_events')}</p>
          </div>
          <CalendarClock className="h-6 w-6 text-accent" />
        </Link>

        <section className="flex flex-col items-center justify-center pt-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-accent bg-card shadow-[0_0_50px_rgba(252,192,37,0.2)]">
            <Star size={64} fill="#fcc025" className="text-accent" />
          </div>
          <div className="mt-4 rounded-full bg-accent px-4 py-1 text-xs font-black uppercase tracking-widest text-black shadow-xl">
            {t('rewards.tier_platinum4')}
          </div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-secondary">
            {t('rewards.vip_progress')}
          </p>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full border border-border/20 bg-card">
            <div className="h-full w-[65%] bg-accent shadow-[0_0_10px_#fcc025]" />
          </div>
          <div className="mt-2 flex w-full justify-between text-xs font-black uppercase text-muted">
            <span>{t('rewards.progress_gold')}</span>
            <span>{t('rewards.progress_platinum')}</span>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Calendar size={16} className="text-secondary" />
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
              {t('rewards.daily_rewards')}
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-3 md:grid-cols-7">
            {DAILY_REWARDS.map((reward) => (
              <div
                key={reward.day}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                  reward.status === 'CLAIMED'
                    ? 'border-emerald-500/20 bg-emerald-500/5 opacity-40'
                    : reward.status === 'AVAILABLE'
                      ? 'border-accent bg-accent/10 shadow-[0_0_20px_rgba(252,192,37,0.1)]'
                      : 'border-border/10 bg-card'
                }`}
              >
                <span className="text-[8px] font-black uppercase text-secondary">{t('rewards.day', { number: reward.day })}</span>
                <div className="text-xs font-black italic">{reward.amount}</div>
                {reward.status === 'CLAIMED' && <CheckCircle2 size={12} className="text-emerald-500" />}
                {reward.status === 'AVAILABLE' && (
                  <button type="button" className="rounded-sm bg-accent px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter text-black">
                    {t('rewards.claim')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Zap size={16} className="text-secondary" />
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
              {t('rewards.active_quests')}
            </h3>
          </div>
          <div className="space-y-4">
            {campaigns.map((campaign: any) => (
              <div
                key={campaign.id}
                className="group flex items-center justify-between rounded-2xl border border-border/10 bg-card p-6 transition-all hover:bg-[#201f1f]"
              >
                <div className="flex-1 space-y-2">
                  <h4 className="text-sm font-bold uppercase tracking-tight text-white transition-colors group-hover:text-accent">
                    {campaign.title}
                  </h4>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">
                    {t('rewards.reward_amount', { amount: campaign.rewards.tokens })}
                  </p>
                  <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-surface">
                    <div className="h-full w-1/2 bg-accent/50" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => claimMutation.mutate(campaign.id)}
                  className="rounded-lg bg-accent px-6 py-2 text-xs font-black uppercase tracking-widest text-black transition-colors hover:bg-white"
                >
                  {t('rewards.claim_reward')}
                </button>
              </div>
            ))}

            {!campaigns.length && (
              <div className="rounded-2xl border border-dashed border-border/20 p-6 text-center text-xs font-bold uppercase tracking-widest text-secondary">
                {t('rewards.no_active_quests')}
              </div>
            )}
          </div>
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
