import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Crown, ChevronLeft, ChevronRight, Gift, Percent, MessageCircle, TrendingUp } from 'lucide-react';
import { formatNumber, LEVEL_TIERS } from '@repo/shared';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import AppBottomNav from '../../components/AppBottomNav';

export default function VIPLevelsView() {
  const { t } = useTranslation();
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');

  const feeDiscountPct = (tier: typeof LEVEL_TIERS[number]) => Math.round((tier.marketFeeDiscount || 0) * 100);

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/15 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-secondary transition-colors hover:text-accent">
              <ChevronLeft size={24} />
            </Link>
            <Crown className="text-accent" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
              {t('info.vip_levels_title')}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-24">
        {/* 等級總覽 */}
        <section className="mb-8 rounded-2xl border border-border/10 bg-gradient-to-br from-[#1a1919] to-[#141414] p-6 shadow-2xl">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-secondary">
            {t('info.vip_system_overview')}
          </h2>
          <p className="mt-3 text-sm font-bold text-secondary leading-relaxed">
            {t('info.vip_system_description', { count: LEVEL_TIERS.length })}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/10 bg-surface p-3">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-emerald-400" />
                   <span className="text-xs font-bold text-secondary">{t('info.highest_discount')}</span>
                </div>
                <p className="mt-1 text-lg font-black text-emerald-400">{Math.round(Math.max(...LEVEL_TIERS.map(t => t.marketFeeDiscount || 0)) * 100)}%</p>
              </div>
              <div className="rounded-xl border border-border/10 bg-surface p-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-accent" />
                   <span className="text-xs font-bold text-secondary">{t('info.highest_multiplier')}</span>
                </div>
                <p className="mt-1 text-lg font-black text-accent">{Math.max(...LEVEL_TIERS.map(t => t.dailyBonusMultiplier || 1)).toFixed(1)}x</p>
              </div>
          </div>
        </section>

        {/* 特權說明 */}
        <section className="mb-6 rounded-2xl border border-border/10 bg-card p-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-secondary">
            {t('info.vip_perks_title')}
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Percent className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t('info.fee_explanation')}</h3>
                <p className="text-xs font-bold text-secondary">
                  {t('info.vip_fee_detail')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <Gift className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t('info.daily_bonus_multiplier')}</h3>
                <p className="text-xs font-bold text-secondary">
                  {t('info.vip_bonus_detail')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <MessageCircle className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t('info.danmaku_perks')}</h3>
                <p className="text-xs font-bold text-secondary">
                  {t('info.vip_danmaku_detail')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t('info.max_bet_limit')}</h3>
                <p className="text-xs font-bold text-secondary">
                  {t('info.vip_max_bet_detail')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 等級列表 */}
        <section className="space-y-3">
          <h2 className="px-2 text-xs font-black uppercase tracking-[0.2em] text-secondary">
            {t('info.full_level_list')}
          </h2>
          {LEVEL_TIERS.map((tier, index) => (
            <div
              key={tier.label}
              className={`rounded-xl border p-4 transition-all ${
                index <= 5 
                  ? 'border-accent/30 bg-gradient-to-r from-[#fcc025]/5 to-transparent' 
                  : 'border-border/10 bg-card'
              }`}
            >
              <button
                onClick={() => setExpandedTier(expandedTier === tier.label ? null : tier.label)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black"
                    style={{ 
                      backgroundColor: `${tier.danmakuColor}20`,
                      color: tier.danmakuColor 
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-white">{tier.label}</h3>
                    <p className="text-xs font-bold text-secondary">
                      {t('info.threshold')}: {nf(tier.threshold)}
                    </p>
                  </div>
                </div>
                <ChevronRight 
                  className={`h-5 w-5 text-muted transition-transform ${
                    expandedTier === tier.label ? 'rotate-90' : ''
                  }`} 
                />
              </button>
              
              {expandedTier === tier.label && (
                <div className="mt-4 space-y-2 border-t border-border/10 pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-surface p-2">
                       <p className="text-xs font-bold text-secondary">{t('info.max_bet_limit')}</p>
                      <p className="text-sm font-black text-white">{nf(tier.maxBet)}</p>
                    </div>
                    <div className="rounded-lg bg-surface p-2">
                       <p className="text-xs font-bold text-secondary">{t('info.fee_discount')}</p>
                      <p className="text-sm font-black text-emerald-400">{feeDiscountPct(tier)}%</p>
                    </div>
                    <div className="rounded-lg bg-surface p-2">
                       <p className="text-xs font-bold text-secondary">{t('info.bonus_multiplier')}</p>
                      <p className="text-sm font-black text-accent">
                        {(tier.dailyBonusMultiplier || 1).toFixed(1)}x
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface p-2">
                       <p className="text-xs font-bold text-secondary">{t('info.danmaku_color')}</p>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: tier.danmakuColor }}
                        />
                        <span className="text-xs font-bold text-white">{tier.danmakuColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
