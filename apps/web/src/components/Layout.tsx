import { useState, useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@repo/shared';
import { api } from '../store/api';
import ChatRoom from './ChatRoom';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    api.get('/api/v1/support/chat/messages', { params: { limit: 1 } })
      .then((res) => {
        const msgs = res.data.data?.messages || [];
        if (msgs.length > 0) setLastMessage(msgs[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <main className="app-shell flex flex-1 pt-20 pb-24 lg:pt-24 lg:pb-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-col gap-10 lg:flex-row lg:items-start"
          >
            <div className="min-w-0 flex-1 transition-all duration-300">
              <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
                <Outlet />
              </Suspense>
            </div>

            {/* Desktop chat: slide in/out from right */}
            <div className="hidden lg:flex items-stretch gap-0">
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  chatOpen ? 'max-w-96' : 'max-w-0'
                }`}
              >
                <div className="w-96 shrink-0 flex flex-col gap-3">
                    <button
                      onClick={() => setChatOpen(!chatOpen)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-left hover:bg-elevated transition-colors"
                    >
                      <MessageCircle size={16} className="text-info shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-widest text-info">{t('layout.global_chat')}</span>
                  </button>
                  <ChatRoom />
                  <footer className="py-4 text-center space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                      {t('layout.footer', { version: APP_VERSION })}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Link to="/landing" className="text-[10px] uppercase tracking-widest text-muted hover:text-accent transition-colors">
                        關於子熙佑戩
                      </Link>
                      <span className="text-muted">|</span>
                      <Link to="/privacy" className="text-[10px] uppercase tracking-widest text-muted hover:text-accent transition-colors">
                        {t('nav.privacy')}
                      </Link>
                      <span className="text-muted">|</span>
                      <Link to="/terms" className="text-[10px] uppercase tracking-widest text-muted hover:text-accent transition-colors">
                        {t('nav.terms')}
                      </Link>
                    </div>
                  </footer>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="self-start mt-2 flex items-center justify-center w-6 h-12 rounded-r-xl border border-l-0 border-border/20 bg-card text-secondary hover:text-white hover:bg-card/80 transition-colors"
              >
                {chatOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global chat bar (mobile only) */}
      <div className="fixed bottom-20 inset-x-0 z-40 lg:hidden">
        {chatOpen ? (
          <div className="mx-2 mb-2">
            <div className="flex items-center justify-between bg-card rounded-t-xl border border-border/20 px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{t('layout.global_chat')}</span>
              <button onClick={() => setChatOpen(false)} className="text-secondary hover:text-white">
                <ChevronRight size={18} />
              </button>
            </div>
            <ChatRoom />
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="mx-2 mb-2 w-[calc(100%-1rem)] flex items-center gap-3 bg-card/90 backdrop-blur-xl border border-border/20 rounded-xl px-4 py-2.5 text-left hover:bg-card transition-colors"
          >
            <MessageCircle size={16} className="text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-blue-400">{t('layout.global_chat')}</span>
              {lastMessage && (
                <p className="text-caption text-secondary truncate mt-0.5">
                  <span className="font-bold text-accent">{lastMessage.displayName || t('lobby.anonymous')}: </span>
                  {lastMessage.text}
                </p>
              )}
            </div>
            <ChevronLeft size={16} className="text-secondary shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}



