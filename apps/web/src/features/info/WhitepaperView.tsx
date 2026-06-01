import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Shield, Coins, Crown, Building2, Gamepad2, ArrowRight } from 'lucide-react';

const SECTIONS = [
  { key: 'overview', icon: FileText },
  { key: 'token', icon: Coins },
  { key: 'fairness', icon: Shield },
  { key: 'games', icon: Gamepad2 },
  { key: 'vip', icon: Crown },
  { key: 'company', icon: Building2 },
  { key: 'roadmap', icon: FileText },
] as const;

export default function WhitepaperView() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <Helmet>
        <title>{t('whitepaper.meta.title')}</title>
        <meta name="description" content={t('whitepaper.meta.description')} />
      </Helmet>

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="mb-12 text-center">
          <h1 className="section-title section-title-accent text-3xl sm:text-4xl">
            {t('whitepaper.title')}
          </h1>
          <p className="mt-3 text-sm text-secondary">{t('whitepaper.meta.description')}</p>
        </div>

        <div className="space-y-10">
          {SECTIONS.map(({ key, icon: Icon }) => (
            <section key={key} className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h2 className="section-title section-title-accent text-lg">
                  {t(`whitepaper.${key}.title`)}
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-secondary">
                {t(`whitepaper.${key}.body`)}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/landing"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-black text-black transition-opacity hover:opacity-90"
          >
            {t('whitepaper.cta')}
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
