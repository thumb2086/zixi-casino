import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Dice5, Gift, HelpCircle, Shield } from 'lucide-react';

interface GameOdds {
  key: string;
  name: string;
  rtp: number;
  houseEdge: number;
  description: string;
  payout: string;
  probability: string;
  fairness: string;
}

export default function OddsTab() {
  const { t } = useTranslation();
  const [selectedGame, setSelectedGame] = useState<string | null>('roulette');

  const GAME_ODDS: GameOdds[] = [
    { key: 'coinflip', name: t('info.game_data.coinflip_name'), rtp: 98.0, houseEdge: 2.0, description: t('info.game_data.coinflip_desc'), payout: t('info.game_data.coinflip_payout'), probability: t('info.game_data.coinflip_probability'), fairness: t('info.game_data.coinflip_fairness') },
    { key: 'roulette', name: t('info.game_data.roulette_name'), rtp: 97.3, houseEdge: 2.7, description: t('info.game_data.roulette_desc'), payout: t('info.game_data.roulette_payout'), probability: t('info.game_data.roulette_probability'), fairness: t('info.game_data.roulette_fairness') },
    { key: 'sicbo', name: t('info.game_data.sicbo_name'), rtp: 96.0, houseEdge: 4.0, description: t('info.game_data.sicbo_desc'), payout: t('info.game_data.sicbo_payout'), probability: t('info.game_data.sicbo_probability'), fairness: t('info.game_data.sicbo_fairness') },
    { key: 'slots', name: t('info.game_data.slots_name'), rtp: 94.0, houseEdge: 6.0, description: t('info.game_data.slots_desc'), payout: t('info.game_data.slots_payout'), probability: t('info.game_data.slots_probability'), fairness: t('info.game_data.slots_fairness') },
    { key: 'horse', name: t('info.game_data.horse_name'), rtp: 96.3, houseEdge: 3.7, description: t('info.game_data.horse_desc'), payout: t('info.game_data.horse_payout'), probability: t('info.game_data.horse_probability'), fairness: t('info.game_data.horse_fairness') },
    { key: 'shoot_dragon_gate', name: t('info.game_data.shoot_dragon_gate_name'), rtp: 96.3, houseEdge: 3.7, description: t('info.game_data.shoot_dragon_gate_desc'), payout: t('info.game_data.shoot_dragon_gate_payout'), probability: t('info.game_data.shoot_dragon_gate_probability'), fairness: t('info.game_data.shoot_dragon_gate_fairness') },
    { key: 'blackjack', name: t('info.game_data.blackjack_name'), rtp: 99.0, houseEdge: 1.0, description: t('info.game_data.blackjack_desc'), payout: t('info.game_data.blackjack_payout'), probability: t('info.game_data.blackjack_probability'), fairness: t('info.game_data.blackjack_fairness') },
    { key: 'crash', name: t('info.game_data.crash_name'), rtp: 96.0, houseEdge: 4.0, description: t('info.game_data.crash_desc'), payout: t('info.game_data.crash_payout'), probability: t('info.game_data.crash_probability'), fairness: t('info.game_data.crash_fairness') },
    { key: 'duel', name: t('info.game_data.duel_name'), rtp: 97.5, houseEdge: 2.5, description: t('info.game_data.duel_desc'), payout: t('info.game_data.duel_payout'), probability: t('info.game_data.duel_probability'), fairness: t('info.game_data.duel_fairness') },
    { key: 'bingo', name: t('info.game_data.bingo_name'), rtp: 93.0, houseEdge: 7.0, description: t('info.game_data.bingo_desc'), payout: t('info.game_data.bingo_payout'), probability: t('info.game_data.bingo_probability'), fairness: t('info.game_data.bingo_fairness') },
    { key: 'poker', name: t('info.game_data.poker_name'), rtp: 97.0, houseEdge: 3.0, description: t('info.game_data.poker_desc'), payout: t('info.game_data.poker_payout'), probability: t('info.game_data.poker_probability'), fairness: t('info.game_data.poker_fairness') },
    { key: 'bluffdice', name: t('info.game_data.bluffdice_name'), rtp: 98.0, houseEdge: 2.0, description: t('info.game_data.bluffdice_desc'), payout: t('info.game_data.bluffdice_payout'), probability: t('info.game_data.bluffdice_probability'), fairness: t('info.game_data.bluffdice_fairness') },
  ];

  const CHEST_RARITY_LABELS = [
    t('info.rarity_labels.common'),
    t('info.rarity_labels.rare'),
    t('info.rarity_labels.epic'),
    t('info.rarity_labels.legendary'),
    t('info.rarity_labels.mythic'),
    t('info.rarity_labels.chaos'),
    t('info.rarity_labels.abyss'),
    t('info.rarity_labels.oracle'),
  ];

  const CHEST_DATA = [
    { type: t('info.chest_data.common_name'), price: '100 ZXC', key: 'common', w: [50,30,15,5,0,0,0,0], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.common_pity') },
    { type: t('info.chest_data.rare_name'), price: '500 ZXC', key: 'rare', w: [15,25,30,30,0,0,0,0], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.rare_pity') },
    { type: t('info.chest_data.epic_name'), price: '2,000 ZXC', key: 'epic', w: [0,0,10,89.8,0.2,0,0,0], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.epic_pity') },
    { type: t('info.chest_data.legendary_name'), price: '10,000 ZXC', key: 'legendary', w: [0,0,0,75,25,0,0,0], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.legendary_pity') },
    { type: t('info.chest_data.mythic_name'), price: '100,000 ZXC', key: 'mythic', w: [0,0,0,10,88,2,0,0], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.mythic_pity') },
    { type: t('info.chest_data.chaos_name'), price: '1,000,000 ZXC', key: 'chaos', w: [0,0,0,68.9,0,31.1,0,0], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.chaos_pity') },
    { type: t('info.chest_data.abyss_name'), price: '10,000,000 ZXC', key: 'abyss', w: [0,0,0,0,0,85,15,0], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.abyss_pity') },
    { type: t('info.chest_data.oracle_name'), price: '100,000,000 ZXC', key: 'oracle', w: [0,0,0,0,0,70,20,10], colors: ['#adaaaa','#3b82f6','#a855f7','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'], labels: CHEST_RARITY_LABELS, pity: t('info.chest_data.oracle_pity') },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-emerald-400" />
          <h2 className="text-lg font-black text-emerald-400">{t('info.fair_play_title')}</h2>
        </div>
        <p className="mt-3 text-sm font-bold leading-relaxed text-secondary">
          {t('info.fair_play_description')}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400">{t('info.fair_play_static_rules')}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-border/10 bg-card p-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">{t('info.what_is_rtp')}</h2>
        <p className="mt-3 text-sm font-bold leading-relaxed text-secondary">
          {t('info.rtp_explanation_detail')}
        </p>
        <div className="mt-4 rounded-lg bg-surface p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-secondary">{t('info.platform_advantage')}</span>
            <span className="font-black text-accent">{t('info.lower_is_better')}</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/10 bg-card p-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">{t('info.fee_title')}</h2>
        <p className="mt-3 text-sm font-bold leading-relaxed text-secondary">
          {t('info.fee_formula_label')}<span className="text-emerald-400">{t('info.fee_formula')}</span>??
        </p>
        <p className="mt-1 text-sm font-bold leading-relaxed text-secondary">
          {t('info.fee_max_discount_prefix')}<span className="text-accent">100%</span>{t('info.fee_max_discount_suffix')}
        </p>
        <ul className="mt-3 space-y-2 text-xs font-bold text-secondary">
          <li>??{t('info.fee_discount_detail_normal')}</li>
          <li>??{t('info.fee_discount_detail_silver')}</li>
          <li>??{t('info.fee_discount_detail_gold')}</li>
          <li>??{t('info.fee_discount_detail_platinum')}</li>
          <li>??{t('info.fee_discount_detail_diamond')}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-secondary">{t('info.game_probabilities')}</h2>
        {GAME_ODDS.map((game) => (
          <div key={game.key} className="rounded-xl border border-border/10 bg-card p-4">
            <button
              onClick={() => setSelectedGame(selectedGame === game.key ? null : game.key)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Dice5 className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white">{game.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400">RTP {game.rtp}%</span>
                    <span className="text-xs font-bold text-secondary">{t('info.house_edge_label')} {game.houseEdge}%</span>
                  </div>
                </div>
              </div>
              <HelpCircle className="h-5 w-5 text-muted" />
            </button>

            {selectedGame === game.key && (
              <div className="mt-4 space-y-3 border-t border-border/10 pt-4">
                <p className="text-sm font-bold text-secondary">{game.description}</p>
                <div className="rounded-lg bg-surface p-3">
                  <p className="text-xs font-bold text-secondary">{t('info.payout_rules_label')}{game.payout}</p>
                  <p className="mt-1 text-xs font-bold text-secondary">{t('info.probability_highlight_label')}{game.probability}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-3">
                  <p className="text-xs font-bold text-emerald-400">
                    <span className="mr-2">{t('info.fairness_label')}</span>
                    {game.fairness}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface p-2 text-center">
                    <p className="text-xs font-bold text-secondary">{t('info.long_term_rtp')}</p>
                    <p className="text-lg font-black text-emerald-400">{game.rtp}%</p>
                  </div>
                  <div className="rounded-lg bg-surface p-2 text-center">
                    <p className="text-xs font-bold text-secondary">{t('info.house_edge_label')}</p>
                    <p className="text-lg font-black text-danger">{game.houseEdge}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="px-2 text-xs font-bold uppercase tracking-[0.2em] text-secondary flex items-center gap-2">
          <Gift size={14} />{t('info.chest_probabilities_title')}
        </h2>

        <div className="rounded-xl border border-border/10 bg-card p-4">
          <p className="text-sm font-bold text-secondary mb-3">
            {t('info.chest_probabilities_desc')}
          </p>

          {CHEST_DATA.map((chest) => (
            <div key={chest.key} className="mb-3 last:mb-0 rounded-lg border border-border/10 bg-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white">{chest.type}</h3>
                <span className="text-xs font-bold text-secondary">{chest.price}</span>
              </div>
              <p className="text-caption font-bold text-secondary mb-2">{chest.pity}</p>
              <div className="flex items-center gap-2">
                {chest.w.map((pct, i) => pct > 0 && (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: chest.colors[i] }} />
                    <span className="text-caption font-bold text-secondary">{chest.labels[i]} {pct}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-card flex overflow-hidden">
                {chest.w.map((pct, i) => pct > 0 && (
                  <div key={i} className="h-full" style={{ width: `${pct}%`, background: chest.colors[i] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}



