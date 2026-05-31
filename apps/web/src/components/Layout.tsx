import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
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
              <Outlet />
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
                    className="flex items-center gap-2 rounded-xl border border-[#494847]/20 bg-[#1a1919] px-4 py-2.5 text-left hover:bg-[#1a1919]/80 transition-colors"
                  >
                    <MessageCircle size={16} className="text-blue-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">{t('layout.global_chat')}</span>
                  </button>
                  <ChatRoom />
                  <footer className="py-4 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.5em] text-[#494847]">
                      {t('layout.footer', { version: APP_VERSION })}
                    </p>
                  </footer>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="self-start mt-2 flex items-center justify-center w-6 h-12 rounded-r-xl border border-l-0 border-[#494847]/20 bg-[#1a1919] text-[#adaaaa] hover:text-white hover:bg-[#1a1919]/80 transition-colors"
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
            <div className="flex items-center justify-between bg-[#1a1919] rounded-t-xl border border-[#494847]/20 px-4 py-2">
              <span className="text-xs font-black uppercase tracking-widest text-blue-400">{t('layout.global_chat')}</span>
              <button onClick={() => setChatOpen(false)} className="text-[#adaaaa] hover:text-white">
                <ChevronRight size={18} />
              </button>
            </div>
            <ChatRoom />
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="mx-2 mb-2 w-[calc(100%-1rem)] flex items-center gap-3 bg-[#1a1919]/90 backdrop-blur-xl border border-[#494847]/20 rounded-xl px-4 py-2.5 text-left hover:bg-[#1a1919] transition-colors"
          >
            <MessageCircle size={16} className="text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-blue-400">{t('layout.global_chat')}</span>
              {lastMessage && (
                <p className="text-[10px] text-[#adaaaa] truncate mt-0.5">
                  <span className="font-bold text-[#fcc025]">{lastMessage.displayName || t('lobby.anonymous')}: </span>
                  {lastMessage.text}
                </p>
              )}
            </div>
            <ChevronLeft size={16} className="text-[#adaaaa] shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
