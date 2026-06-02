import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../store/api';
import { ChevronRight } from 'lucide-react';

// XP thresholds per level (mirrors backend experience-manager.ts)
const XP_FOR_LEVEL: number[] = [
  0, 0, 10_000, 30_000, 100_000, 300_000, 600_000, 1_000_000, 2_000_000, 4_000_000,
  8_000_000, 15_000_000, 30_000_000, 50_000_000, 80_000_000, 150_000_000, 250_000_000,
  400_000_000, 600_000_000, 900_000_000, 1_500_000_000, 2_500_000_000, 4_000_000_000,
  6_000_000_000, 9_000_000_000, 15_000_000_000, 25_000_000_000, 40_000_000_000,
  60_000_000_000, 90_000_000_000, 150_000_000_000, 250_000_000_000, 400_000_000_000,
  650_000_000_000, 1_000_000_000_000, 1_500_000_000_000, 2_500_000_000_000,
  4_000_000_000_000, 6_500_000_000_000, 10_000_000_000_000, 16_000_000_000_000,
  25_000_000_000_000, 40_000_000_000_000, 65_000_000_000_000, 100_000_000_000_000,
  160_000_000_000_000, 250_000_000_000_000, 400_000_000_000_000, 650_000_000_000_000,
  850_000_000_000_000, 1_000_000_000_000_000,
];

const TIER_COLORS: Record<string, string> = {
  '?®é€?: '#a0a0a0', '?’é?': '#cd7f32', '?½é?': '#c0c0c0',
  'é»ƒé?': '#ffd700', '?½é?': '#00cfff',
  '?½çŸ³': '#ff4fff', 'é»‘é‘½': '#ff4fff',
  '?è‹±': '#ff4fff', 'å®—å¸«': '#ff4fff',
  '?‹è€?: '#ff4fff', '?³å?': '#ff4fff',
  '?¼ç©¹': '#ff4fff', 'å¯°å?': '#ff4fff',
  '?Ÿç©¹': '#ff4fff', '?¬ç?': '#ff4fff',
  '?µä?': '#ff4fff', 'æ°¸æ?': '#ff4fff',
  'æ·±æ·µ': '#ff4fff', 'ç¥žè«­': '#ff4fff',
  'ç¥žè©±': '#ff4fff',
};
function tierColor(label: string): string {
  for (const [key, color] of Object.entries(TIER_COLORS)) {
    if (label.includes(key)) return color;
  }
  return '#a0a0a0';
}

export default function XpTab() {
  const { t } = useTranslation();
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile || {};
    },
    staleTime: 30000,
  });

  const userLevel = profile?.level || 1;
  const userXp = profile?.xp || 0;
  const userTier = profile?.xpTierLabel || t('xpLevel.1');
  const nextLevelXp = profile?.xpNextLevel || 0;
  const xpProgress = profile?.xpProgress !== undefined ? profile.xpProgress : (nextLevelXp > 0 ? Math.round((Number(userXp) / nextLevelXp) * 100) : 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/10 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">{t('info.my_xp_level')}</p>
            <p className="text-3xl font-black italic text-accent mt-1">Lv.{userLevel} <span className="text-sm font-bold text-secondary">{userTier}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-secondary">{t('info.exp_value')}</p>
            <p className="text-sm font-black text-white">{Number(userXp).toLocaleString()} XP</p>
            {nextLevelXp > 0 && <p className="text-caption text-secondary mt-0.5">{t('info.next_level_xp', { xp: Number(nextLevelXp).toLocaleString() })}</p>}
          </div>
        </div>
        {xpProgress > 0 && (
          <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, xpProgress)}%`, background: `linear-gradient(90deg, ${tierColor(userTier)}, #fcc025)` }} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/10 bg-card p-6 shadow-2xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-secondary mb-3">{t('info.how_to_earn_xp')}</h2>
        <ul className="space-y-2 text-sm text-white">
          <li className="flex items-center gap-2">{t('info.bet_xp_desc')}</li>
          <li className="flex items-center gap-2">{t('info.double_xp_desc')}</li>
          <li className="flex items-center gap-2">{t('info.event_bonus_desc')}</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border/10 bg-card p-6 shadow-2xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-secondary mb-4">{t('info.level_list')}</h2>
        <div className="space-y-1">
          {XP_FOR_LEVEL.slice(1).map((xp, idx) => {
            const lv = idx + 1;
            const label = t('xpLevel.' + lv);
            const isCurrent = userLevel >= lv;
            return (
              <div key={lv}
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                  userLevel === lv
                    ? 'bg-accent/10 border border-accent/30'
                    : 'bg-surface border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-8 ${isCurrent ? 'text-accent' : 'text-muted'}`}>
                    Lv.{lv}
                  </span>
                  <span className={`text-xs font-bold ${label ? 'text-white' : 'text-muted'}`}>
                    {label || '??}
                  </span>
                </div>
                <span className="text-caption font-bold text-secondary">{xp.toLocaleString()} XP</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-secondary">{t('info.vip_pass')}</h2>
        <p className="px-2 text-sm font-bold leading-relaxed text-secondary">
          {t('info.vip_pass_desc_p1')}<span className="text-accent">{t('info.shop_name')}</span>{t('info.vip_pass_desc_p2')}
        </p>
        <div className="rounded-xl border border-border/10 bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#494847]/20 text-sm font-black text-secondary">0</div>
            <div className="text-left">
              <h3 className="font-bold text-secondary">{t('info.normal_player')}</h3>
              <p className="text-xs font-bold text-muted">{t('info.no_vip_pass')}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs font-bold text-secondary">{t('info.basic_permissions')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-accent/30 bg-gradient-to-r from-[#fcc025]/5 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-sm font-black text-accent">1</div>
              <div className="text-left">
                <h3 className="font-bold text-accent">VIP 1</h3>
                <p className="text-xs font-bold text-secondary">{t('info.buy_vip_pass')}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs font-bold text-secondary">{t('info.exclusive_rooms')}</p>
              <p className="text-sm font-bold text-accent">{t('info.vip_poker_room')}</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs font-bold text-secondary">{t('info.mission_unlock')}</p>
              <p className="text-sm font-bold text-accent">{t('info.vip_limited_missions')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-accent/40 bg-gradient-to-r from-[#fcc025]/10 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-sm font-black text-black">2</div>
              <div className="text-left">
                <h3 className="font-bold text-accent">VIP 2</h3>
                <p className="text-xs font-bold text-secondary">{t('info.buy_vip2_pass')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-emerald-400/30 px-2 py-1 text-xs font-bold uppercase text-emerald-400">{t('info.zero_fee')}</span>
              <ChevronRight className="h-5 w-5 text-accent" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs font-bold text-secondary">{t('info.exclusive_rooms')}</p>
              <p className="text-sm font-bold text-accent">{t('info.all_vip_rooms')}</p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
              <p className="text-xs font-bold text-emerald-400">{t('info.exclusive_perk')}</p>
              <p className="text-sm font-black text-emerald-400">{t('info.zero_fee')}</p>
              <p className="text-xs font-bold text-secondary">{t('info.market_zero_fee')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}



