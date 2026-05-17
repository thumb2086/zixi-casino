import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell, MessageCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ChatRoom from './ChatRoom';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#0e0e0e] font-['Manrope'] text-white">
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
                  &copy; 2026 ZiXi Simulator - Aureum Edition
                </p>
              </footer>
            </aside>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile chat FAB */}
      <button
        onClick={() => setChatOpen(o => !o)}
        className="fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-500 lg:hidden"
      >
        {chatOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {/* Mobile chat drawer */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
          >
            <div className="mx-2 mb-2">
              <ChatRoom />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
