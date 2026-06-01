import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BookOpen, Dice5, LayoutGrid, Star, Gem, Sword, Crosshair, Diamond, Flame } from 'lucide-react';

const guides = [
  { icon: Diamond, nameKey: 'landing.games.baccarat', tipKey: 'guides.baccarat' },
  { icon: Flame, nameKey: 'landing.games.dragontiger', tipKey: 'guides.dragontiger' },
  { icon: Dice5, nameKey: 'landing.games.sicbo', tipKey: 'guides.sicbo' },
  { icon: Dice5, nameKey: 'landing.games.bluffdice', tipKey: 'guides.bluffdice' },
  { icon: LayoutGrid, nameKey: 'landing.games.bingo', tipKey: 'guides.bingo' },
  { icon: Star, nameKey: 'landing.games.slots', tipKey: 'guides.slots' },
  { icon: Sword, nameKey: 'landing.games.duel', tipKey: 'guides.duel' },
  { icon: Gem, nameKey: 'landing.games.poker', tipKey: 'guides.poker' },
  { icon: Crosshair, nameKey: 'landing.games.blackjack', tipKey: 'guides.blackjack' },
];

export default function GuidesView() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t('guides.meta.title')}</title>
        <meta name="description" content={t('guides.meta.description')} />
        <meta property="og:title" content={t('guides.meta.title')} />
        <meta property="og:description" content={t('guides.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-surface font-manrope-emoji text-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-2 flex items-center justify-center gap-3">
            <BookOpen className="h-8 w-8 text-accent" />
            <h1 className="section-title section-title-accent">{t('guides.title')}</h1>
          </div>

          {/* Getting Started */}
          <section className="mt-12">
            <h2 className="mb-6 text-lg font-extrabold uppercase tracking-wider text-white">
              {t('guides.gettingStarted.title')}
            </h2>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="leading-relaxed text-secondary">
                {t('guides.gettingStarted.body')}
              </p>
            </div>
          </section>

          {/* Game Guides */}
          <section className="mt-14">
            <h2 className="mb-6 text-lg font-extrabold uppercase tracking-wider text-white">
              {t('guides.tips.title')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {guides.map(({ icon: Icon, nameKey, tipKey }) => (
                <div
                  key={tipKey}
                  className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-accent/30 hover:bg-elevated"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="text-base font-bold text-white">{t(nameKey)}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-secondary">
                    {t(tipKey)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Tips & Strategy */}
          <section className="mt-14">
            <h2 className="mb-6 text-lg font-extrabold uppercase tracking-wider text-white">
              {t('guides.strategy.title')}
            </h2>
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="leading-relaxed text-secondary">
                  {t('guides.vipTip')}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="leading-relaxed text-secondary">
                  {t('guides.companyTip')}
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="mt-16 text-center">
            <p className="mb-6 text-lg text-secondary">
              {t('guides.cta.text')}
            </p>
            <Link
              to="/landing"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-base font-bold text-black transition-colors hover:bg-[#d48c1c]"
            >
              {t('guides.cta.button')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
