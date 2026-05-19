import { Calculator, ChevronLeft, Crown, Package, Sparkles } from 'lucide-react';
import AppBottomNav from '../components/AppBottomNav';
import ItemsTab from '../features/info/tabs/ItemsTab';
import OddsTab from '../features/info/tabs/OddsTab';
import VIPTab from '../features/info/tabs/VIPTab';

export default function UnifiedInfoView() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <a href="/app" className="text-[#adaaaa] transition-colors hover:text-[#fcc025]">
              <ChevronLeft size={24} />
            </a>
            <Sparkles className="text-[#fcc025]" />
            <div>
              <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">èªªæ?ä¸­å?</h1>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#adaaaa]">ç¶œå??‡å?</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-20 space-y-8">
        {/* VIP ç­‰ç?ç³»çµ±?€å¡?*/}
        <section className="relative overflow-hidden rounded-2xl border border-[#fcc025]/20 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-6 shadow-2xl">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fcc025]/5 blur-[50px]" />
          
          <div className="relative z-10 mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#fcc025]/30 bg-[#262626]">
              <Crown className="h-6 w-6 text-[#fcc025]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#fcc025]">VIP ç­‰ç?ç³»çµ±</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">32 ?‹ç?ç´?Â· å°ˆå±¬?¹æ? Â· ç´¯ç?è§??</p>
            </div>
            <div className="ml-auto">
              <span className="inline-block rounded border border-[#fcc025]/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#fcc025]">
                32 ?Žç?ç´?
              </span>
            </div>
          </div>
          
          <div className="relative z-10">
            <VIPTab />
          </div>
        </section>

        {/* ?Šæˆ²æ©Ÿç??€å¡?*/}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-6 shadow-2xl">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/5 blur-[50px]" />
          
          <div className="relative z-10 mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-400/30 bg-[#262626]">
              <Calculator className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-emerald-400">?Šæˆ²æ©Ÿç?</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">9 æ¬¾é???Â· RTP èªªæ? Â· ?¬å¹³é©—è?</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                9 æ¬¾é???
              </span>
            </div>
          </div>
          
          <div className="relative z-10">
            <OddsTab />
          </div>
        </section>

        {/* ?©å??–é??€å¡?*/}
        <section className="relative overflow-hidden rounded-2xl border border-purple-400/20 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-6 shadow-2xl">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400/5 blur-[50px]" />
          
          <div className="relative z-10 mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-purple-400/30 bg-[#262626]">
              <Package className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-purple-400">?©å??–é?</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">?­å? Â· ç¨±è? Â· 5 ç¨®ç??‰åº¦</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-purple-400">
                å®Œæ•´?–é?
              </span>
            </div>
          </div>
          
          <div className="relative z-10">
            <ItemsTab />
          </div>
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
