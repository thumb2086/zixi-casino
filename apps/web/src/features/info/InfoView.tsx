import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calculator, ChevronLeft, Package, Sparkles, TrendingUp } from 'lucide-react';
import AppBottomNav from '../../components/AppBottomNav';
import ItemsTab from './tabs/ItemsTab';
import OddsTab from './tabs/OddsTab';
import XpTab from './tabs/XpTab';

type TabId = 'items' | 'odds' | 'xp';

const TABS = [
  { id: 'items' as TabId, label: '物品圖鑑', icon: Package },
  { id: 'xp' as TabId, label: '經驗等級', icon: TrendingUp },
  { id: 'odds' as TabId, label: '遊戲機率', icon: Calculator },
];

export default function InfoView() {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromUrl = () => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'items' || tabParam === 'odds' || tabParam === 'xp') return tabParam;
    return 'items' as TabId;
  };

  const [activeTab, setActiveTab] = useState<TabId>(getTabFromUrl());

  // Sync tab when URL changes (e.g. user navigates from lobby)
  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location.search]);

  const activeLabel = useMemo(
    () => TABS.find((tab) => tab.id === activeTab)?.label ?? '說明中心',
    [activeTab],
  );

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    navigate(`/app/info?tab=${tabId}`, { replace: location.search.length > 0 });
  };

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/15 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-secondary transition-colors hover:text-accent">
              <ChevronLeft size={24} />
            </Link>
            <Sparkles className="text-accent" />
            <div>
              <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">說明中心</h1>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">{activeLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 pt-20">
        <div className="mb-6 flex gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent text-black'
                    : 'border border-border/20 bg-card text-secondary'
                }`}
              >
                <Icon size={18} />
                <span className="text-xs font-black tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-[500px]">
          {activeTab === 'items' && <ItemsTab />}
          {activeTab === 'odds' && <OddsTab />}
          {activeTab === 'xp' && <XpTab />}
        </div>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
