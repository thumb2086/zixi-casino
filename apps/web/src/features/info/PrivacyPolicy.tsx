import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t('privacy.meta.title')}</title>
        <meta name="description" content={t('privacy.meta.description')} />
        <meta property="og:title" content={t('privacy.meta.title')} />
        <meta property="og:description" content={t('privacy.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-surface font-manrope-emoji text-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <Link to="/landing" className="mb-6 inline-flex items-center gap-2 text-sm text-secondary hover:text-accent transition-colors">
            <ArrowLeft size={16} />
            {t('common.back')}
          </Link>

          <div className="mb-2 flex items-center justify-center gap-3">
            <Shield className="h-8 w-8 text-accent" />
            <h1 className="section-title section-title-accent">{t('privacy.title')}</h1>
          </div>
          <p className="mt-2 text-center text-sm text-muted">{t('privacy.lastUpdated')}</p>

          <div className="mt-10 space-y-8">
            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('privacy.intro.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('privacy.intro.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('privacy.collection.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('privacy.collection.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('privacy.usage.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('privacy.usage.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('privacy.cookies.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('privacy.cookies.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('privacy.thirdParty.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('privacy.thirdParty.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('privacy.rights.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('privacy.rights.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('privacy.contact.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('privacy.contact.body')}</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
