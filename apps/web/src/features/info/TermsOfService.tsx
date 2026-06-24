import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t('terms.meta.title')}</title>
        <meta name="description" content={t('terms.meta.description')} />
        <meta property="og:title" content={t('terms.meta.title')} />
        <meta property="og:description" content={t('terms.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-surface font-manrope-emoji text-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <Link to="/landing" className="mb-6 inline-flex items-center gap-2 text-sm text-secondary hover:text-accent transition-colors">
            <ArrowLeft size={16} />
            {t('common.back')}
          </Link>

          <div className="mb-2 flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-accent" />
            <h1 className="section-title section-title-accent">{t('terms.title')}</h1>
          </div>
          <p className="mt-2 text-center text-sm text-muted">{t('terms.lastUpdated')}</p>

          <div className="mt-10 space-y-8">
            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.acceptance.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.acceptance.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.eligibility.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.eligibility.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.account.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.account.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.games.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.games.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.tokens.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.tokens.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.prohibited.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.prohibited.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.limitation.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.limitation.body')}</p>
            </section>

            <section className="rounded-2xl border border-border/10 bg-card p-6 sm:p-8">
              <h2 className="section-title section-title-accent text-lg">{t('terms.contact.title')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">{t('terms.contact.body')}</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
