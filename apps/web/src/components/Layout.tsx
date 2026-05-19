import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../store/api';
import ChatRoom from './ChatRoom';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();

  const { data: chatData } = useQuery({
    queryKey: ['chat-messages-preview'],
    queryFn: async () => {
      const res = await api.get('/api/v1/support/chat/messages');
      return res.data.data;
    },
    refetchInterval: 5000,
  });

  const lastMessage = useMemo(() => {
    const msgs = chatData?.messages || [];
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  }, [chatData]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0e0e0e] font-manrope-emoji text-white">
      <main className="app-shell flex flex-1 py-6 lg:py-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-col gap-10 lg:flex-row lg:items-start"
          >
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>

            <aside className="sticky top-32 hidden h-fit w-96 flex-col gap-8 lg:flex">
              <ChatRoom />

              <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-8 shadow-2xl">
                <div className="mb-6 flex items-center gap-3">
                  <Bell size={18} className="text-[#fcc025]" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.4em] text-[#adaaaa]">
                    {t('layout.system_terminal')}
                  </h4>
                </div>
                <div className="rounded-xl border border-[#494847]/20 bg-[#0e0e0e] p-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#fcc025]">
                    {t('layout.simulation_status')}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fcc025]" />
                    <span className="text-xs font-black uppercase tracking-widest text-white">
                      {t('layout.operator_connected')}
                    </span>
                  </div>
                </div>
              </section>

              <footer className="py-4 text-center">
                <p className="text-xs font-black uppercase tracking-[0.5em] text-[#494847]">
                  &copy; 2026 子熙模擬器 - Aureum Edition
                </p>
              </footer>
            </aside>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global chat bar (mobile only - desktop uses sidebar) */}
      <div className="fixed bottom-20 inset-x-0 z-40 lg:hidden">
        {chatOpen ? (
          <div className="mx-2 mb-2 lg:mb-4 lg:mr-4">
            <div className="flex items-center justify-between bg-[#1a1919] rounded-t-xl border border-[#494847]/20 px-4 py-2">
              <span className="text-xs font-black uppercase tracking-widest text-blue-400">🌍 全域聊天</span>
              <button onClick={() => setChatOpen(false)} className="text-[#adaaaa] hover:text-white">
                <ChevronDown size={18} />
              </button>
            </div>
            <ChatRoom />
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="mx-2 mb-2 w-[calc(100%-1rem)] flex items-center gap-3 bg-[#1a1919]/90 backdrop-blur-xl border border-[#494847]/20 rounded-xl px-4 py-2.5 text-left hover:bg-[#1a1919] transition-colors lg:mb-4 lg:mr-4 lg:w-auto"
          >
            <MessageCircle size={16} className="text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-blue-400">🌍 全域聊天</span>
              {lastMessage && (
                <p className="text-[10px] text-[#adaaaa] truncate mt-0.5">
                  <span className="font-bold text-[#fcc025]">{lastMessage.displayName || '匿名'}: </span>
                  {lastMessage.text}
                </p>
              )}
            </div>
            <ChevronUp size={16} className="text-[#adaaaa] shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
