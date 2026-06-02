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
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link to="/app" className="text-secondary transition-colors hover:text-accent">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
            {title}
          </h1>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 pt-32">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border border-accent/30 bg-card">
            <Construction size={48} className="text-accent" />
          </div>
        </div>

        <h2 className="mt-8 text-2xl font-black uppercase italic tracking-tight text-white">
          ?‹ç™¼ä¸?
        </h2>
        <p className="mt-4 text-center text-sm font-bold text-secondary">
          {description}
        </p>

        <div className="mt-8 rounded-xl border border-border/20 bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            ?è?ä¸Šç??Ÿèƒ½
          </p>
          <ul className="mt-4 space-y-2 text-sm font-bold text-secondary">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              å®Œæ•´?¸æ?ä¸²æ¥
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              ?³æ?äº’å??Ÿèƒ½
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              æ­·å²è¨˜é??¥è©¢
            </li>
          </ul>
        </div>

        <Link
          to="/app"
          className="mt-8 rounded-xl bg-accent px-8 py-4 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-white"
        >
          è¿”å?é¦–é?
        </Link>
      </main>

      <AppBottomNav current={current} />
    </div>
  );
}

