import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Crown,
  Sparkles,
  Coins,
  Building2,
  Gamepad2,
  Star,
  Gem,
  ChevronRight,
  Dice5,
  LayoutGrid,
  Sword,
  Crosshair,
  Diamond,
  Flame,
} from 'lucide-react';

const games = [
  { icon: Diamond, nameKey: 'landing.games.baccarat' },
  { icon: Flame, nameKey: 'landing.games.dragontiger' },
  { icon: Dice5, nameKey: 'landing.games.sicbo' },
  { icon: Dice5, nameKey: 'landing.games.bluffdice' },
  { icon: LayoutGrid, nameKey: 'landing.games.bingo' },
  { icon: Star, nameKey: 'landing.games.slots' },
  { icon: Sword, nameKey: 'landing.games.duel' },
  { icon: Gem, nameKey: 'landing.games.poker' },
  { icon: Crosshair, nameKey: 'landing.games.blackjack' },
];

const features = [
  { icon: Gamepad2, titleKey: 'landing.features.games.title', descKey: 'landing.features.games.desc' },
  { icon: Coins, titleKey: 'landing.features.token.title', descKey: 'landing.features.token.desc' },
  { icon: Crown, titleKey: 'landing.features.vip.title', descKey: 'landing.features.vip.desc' },
  { icon: Building2, titleKey: 'landing.features.company.title', descKey: 'landing.features.company.desc' },
];

function FeatureCard({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:bg-elevated">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
        <Icon className="h-6 w-6 text-accent" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
      <p className="leading-relaxed text-secondary">{description}</p>
    </div>
  );
}

function GameCard({ icon: Icon, name }: { icon: React.ComponentType<{ className?: string }>; name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-accent/30">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <span className="font-medium text-white">{name}</span>
    </div>
  );
}

export default function LandingView() {
  const { t } = useTranslation();
  const { isAuthorized } = useAuthStore();

  return (
    <>
      <Helmet>
        <title>{t('landing.meta.title')}</title>
        <meta name="description" content={t('landing.meta.description')} />
        <meta property="og:title" content={t('landing.meta.title')} />
        <meta property="og:description" content={t('landing.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-surface">
        {/* Nav */}
        <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-black text-black">Z</div>
              <span className="font-bold text-white">ZIXI</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/app" className="rounded-xl bg-accent px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-[#d48c1c]">
                {isAuthorized ? t('landing.hero.enter') : t('landing.hero.cta')}
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-20 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">{t('landing.hero.badge')}</span>
            </div>
            <img
              src="/icon-512.png"
              alt="子熙 ZIXI · 佑戩 YJC 圖標"
              className="mx-auto mb-6 w-28 aspect-square rounded-full object-cover md:w-36"
            />
            <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
              {t('landing.hero.title')}
            </h1>
            <p className="mb-2 text-xl text-secondary md:text-2xl">{t('landing.hero.subtitle')}</p>
            <p className="mb-8 text-base leading-relaxed text-secondary">
              {t('landing.hero.description')}
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                to="/app"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-base font-bold text-black transition-colors hover:bg-[#d48c1c]"
              >
                {t('landing.hero.cta')}
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-24">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-black text-white">{t('landing.features.title')}</h2>
            <p className="text-secondary">{t('landing.features.subtitle')}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <FeatureCard
                key={f.titleKey}
                icon={f.icon}
                title={t(f.titleKey)}
                description={t(f.descKey)}
              />
            ))}
          </div>
        </section>

        {/* Games */}
        <section className="mx-auto max-w-6xl px-4 py-24">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-black text-white">{t('landing.games.title')}</h2>
            <p className="text-secondary">{t('landing.games.subtitle')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {games.map((g) => (
              <GameCard key={g.nameKey} icon={g.icon} name={t(g.nameKey)} />
            ))}
          </div>
        </section>

        {/* Token */}
        <section className="mx-auto max-w-6xl px-4 py-24">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-elevated p-8 md:p-12">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-4 text-3xl font-black text-white">{t('landing.token.title')}</h2>
              <p className="mb-6 leading-relaxed text-secondary">
                {t('landing.token.description')}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-surface p-4">
                  <p className="text-sm text-muted">{t('landing.token.supply')}</p>
                  <p className="text-xl font-bold text-accent">10,000,000</p>
                </div>
                <div className="rounded-xl bg-surface p-4">
                  <p className="text-sm text-muted">{t('landing.token.symbol')}</p>
                  <p className="text-xl font-bold text-accent">ZXC</p>
                </div>
                <div className="rounded-xl bg-surface p-4">
                  <p className="text-sm text-muted">{t('landing.token.chain')}</p>
                  <p className="text-xl font-bold text-accent">{t('landing.token.chainName')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center">
          <h2 className="mb-4 text-3xl font-black text-white">{t('landing.cta.title')}</h2>
          <p className="mb-8 text-secondary">{t('landing.cta.description')}</p>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-base font-bold text-black transition-colors hover:bg-[#d48c1c]"
          >
            {t('landing.hero.cta')}
            <ChevronRight className="h-5 w-5" />
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 py-8 text-center">
          <p className="text-sm text-muted">{t('landing.footer')}</p>
        </footer>
      </div>
    </>
  );
}

