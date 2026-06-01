import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const FAQ_ITEMS = [
  { q: 'faq.q1', a: 'faq.a1' },
  { q: 'faq.q2', a: 'faq.a2' },
  { q: 'faq.q3', a: 'faq.a3' },
  { q: 'faq.q4', a: 'faq.a4' },
  { q: 'faq.q5', a: 'faq.a5' },
  { q: 'faq.q6', a: 'faq.a6' },
  { q: 'faq.q7', a: 'faq.a7' },
  { q: 'faq.q8', a: 'faq.a8' },
];

export default function FAQView() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <>
      <Helmet>
        <title>{t('faq.meta.title')}</title>
        <meta name="description" content={t('faq.meta.description')} />
        <meta property="og:title" content={t('faq.meta.title')} />
        <meta property="og:description" content={t('faq.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-surface font-manrope-emoji text-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-2 flex items-center justify-center gap-3">
            <HelpCircle className="h-8 w-8 text-accent" />
            <h1 className="section-title section-title-accent">{t('faq.title')}</h1>
          </div>

          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <button
                    onClick={() => toggle(index)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-elevated"
                  >
                    <span className="pr-4 text-base font-bold text-white">
                      {t(item.q)}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-accent" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-secondary" />
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-6 py-5">
                          <p className="leading-relaxed text-secondary">
                            {t(item.a)}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <p className="mb-6 text-lg text-secondary">
              {t('faq.cta.text')}
            </p>
            <Link
              to="/landing"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-base font-bold text-black transition-colors hover:bg-[#d48c1c]"
            >
              {t('faq.cta.button')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
