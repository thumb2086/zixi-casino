import { Construction, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppBottomNav from './AppBottomNav';

type NavKey = 'home' | 'casino' | 'market' | 'wallet' | 'settings' | 'none';

interface UnderConstructionProps {
  title?: string;
  description?: string;
  current?: NavKey;
}

export default function UnderConstruction({ 
  title = '?‹ç™¼ä¸?,
  description = 'æ­¤å??½æ­£?¨é??¼ä¸­ï¼Œæ•¬è«‹æ?å¾…ï?',
  current = 'none'
}: UnderConstructionProps) {
  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link to="/app" className="text-[#adaaaa] transition-colors hover:text-[#fcc025]">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">
            {title}
          </h1>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 pt-32">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-[#fcc025]/20 blur-3xl" />
          <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border border-[#fcc025]/30 bg-[#1a1919]">
            <Construction size={48} className="text-[#fcc025]" />
          </div>
        </div>

        <h2 className="mt-8 text-2xl font-black uppercase italic tracking-tight text-white">
          ?‹ç™¼ä¸?
        </h2>
        <p className="mt-4 text-center text-sm font-bold text-[#adaaaa]">
          {description}
        </p>

        <div className="mt-8 rounded-xl border border-[#494847]/20 bg-[#1a1919] p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#494847]">
            ?è?ä¸Šç??Ÿèƒ½
          </p>
          <ul className="mt-4 space-y-2 text-sm font-bold text-[#adaaaa]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#fcc025]" />
              å®Œæ•´?¸æ?ä¸²æ¥
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#fcc025]" />
              ?³æ?äº’å??Ÿèƒ½
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#fcc025]" />
              æ­·å²è¨˜é??¥è©¢
            </li>
          </ul>
        </div>

        <Link
          to="/app"
          className="mt-8 rounded-xl bg-[#fcc025] px-8 py-4 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-white"
        >
          è¿”å?é¦–é?
        </Link>
      </main>

      <AppBottomNav current={current} />
    </div>
  );
}
