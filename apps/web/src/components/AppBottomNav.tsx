import { Link } from 'react-router-dom';
import { Home, LayoutGrid, Settings, ShoppingBag, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type NavKey = 'home' | 'casino' | 'market' | 'shop' | 'wallet' | 'settings' | 'none';

export default function AppBottomNav({ current }: { current: NavKey }) {
  const { t } = useTranslation();

  const items = [
    { key: 'home' as const, to: '/app', icon: Home, label: t('nav.dashboard') },
    { key: 'casino' as const, to: '/app/casino/lobby', icon: LayoutGrid, label: t('nav.casino') },
    { key: 'market' as const, to: '/app/market', icon: ShoppingBag, label: t('nav.market') },
    { key: 'wallet' as const, to: '/app/wallet', icon: Wallet, label: t('nav.vault') },
    { key: 'settings' as const, to: '/app/settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[90] h-[calc(5rem+env(safe-area-inset-bottom))] border-t border-border/15 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl">
      <div className="app-shell flex h-20 items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.key === current;

          return (
            <Link
              key={item.key}
              to={item.to}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1 transition-all rounded-xl ${
                active ? 'text-accent bg-accent/10 shadow-[0_0_12px_rgba(245,166,35,0.2)]' : 'text-secondary hover:text-white hover:bg-card'
              }`}
            >
              <Icon size={24} className="mb-1" />
              <span className="w-full truncate text-center text-xs font-bold uppercase tracking-[0.06em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
