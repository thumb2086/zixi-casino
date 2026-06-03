import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Package, Sparkles, Crown, Sword, Heart, Zap, Gift, Search } from 'lucide-react';
import { api } from '../../store/api';
import AppBottomNav from '../../components/AppBottomNav';

interface CatalogItem {
  id: string;
  name: string;
  type: 'avatar' | 'title' | 'item' | 'buff';
  rarity: string;
  description: string;
  icon: string;
  source: string;
  howToGet: string;
}

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  common: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: '普通' },
  rare: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: '稀有' },
  epic: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: '史詩' },
  legendary: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: '傳說' },
  mythic: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: '神話' },
  chaos: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', label: '混沌' },
  abyss: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', label: '深淵' },
  oracle: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: '神諭' },
  vip: { bg: 'bg-accent/20', text: 'text-accent', border: 'border-accent/30', label: 'VIP' },
};

const TYPE_ICONS = {
  avatar: Package,
  title: Crown,
  item: Gift,
  buff: Zap,
};

export default function ItemsCatalogView() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'avatar' | 'title' | 'item'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    // ?API ??????
    Promise.all([
      api.get('/api/v1/rewards/avatars/catalog').catch(() => ({ data: { data: [] } })),
      api.get('/api/v1/rewards/titles/catalog').catch(() => ({ data: { data: [] } })),
    ])
      .then(([avatarsRes, titlesRes]) => {
        const avatars = (avatarsRes.data.data || []).map((item: any) => ({
          ...item,
          type: 'avatar' as const,
          howToGet: item.source === 'shop' ? '商店購買' : 
                   item.source === 'admin' ? '管理員發放' : 
                   item.source === 'chest' ? '寶箱獲得' : '活動獲得',
        }));
        const titles = (titlesRes.data.data || []).map((item: any) => ({
          ...item,
          type: 'title' as const,
          howToGet: item.source === 'shop' ? '商店購買' : 
                   item.source === 'admin' ? '管理員發放' : 
                   item.source === 'chest' ? '寶箱獲得' : '活動獲得',
        }));
        setItems([...avatars, ...titles]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = items.filter((item) => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-secondary transition-colors hover:text-accent">
              <ChevronLeft size={24} />
            </Link>
            <Package className="text-accent" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
              ????
            </h1>
          </div>
        </div>
      </header>

      <main className="px-6 pt-24">
        {/* ???篩??*/}
        <section className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="?????稱..."
              className="w-full rounded-xl border border-border/20 bg-card py-3 pl-10 pr-4 text-sm font-bold text-white placeholder:text-muted focus:outline-none focus:border-accent/40"
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'avatar', 'title', 'item'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === type
                    ? 'bg-accent text-black'
                    : 'bg-card text-secondary border border-border/20'
                }`}
              >
                {type === 'all' ? '?部' : 
                 type === 'avatar' ? '??' : 
                 type === 'title' ? '稱?' : '?具'}
              </button>
            ))}
          </div>
        </section>

        {/* 稀?度說? */}
        <section className="mb-6 rounded-2xl border border-border/10 bg-card p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-secondary">
            稀?度說?
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(RARITY_COLORS).map(([key, colors]) => (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${colors.border} ${colors.bg}`}
              >
                <Sparkles className={`h-3 w-3 ${colors.text}`} />
                <span className={`text-xs font-bold ${colors.text}`}>{colors.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ???表 */}
        <section className="space-y-3">
          {loading && (
            <div className="rounded-xl border border-border/10 bg-card p-8 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-[#fcc025]" />
              <p className="text-sm font-bold text-secondary">載入????...</p>
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="rounded-xl border border-border/10 bg-card p-8 text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-muted" />
              <p className="text-sm font-bold text-secondary">?無符?條件?物</p>
            </div>
          )}

          {filteredItems.map((item) => {
            const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const TypeIcon = TYPE_ICONS[item.type] || Gift;
            
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition-all ${rarity.border} ${rarity.bg}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface">
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold truncate ${rarity.text}`}>{item.name}</h3>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${rarity.bg} ${rarity.text}`}>
                        {rarity.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-secondary line-clamp-2">
                      {item.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 rounded bg-surface px-2 py-1 text-xs font-bold text-secondary">
                        <TypeIcon className="h-3 w-3" />
                        {item.type === 'avatar' ? '??' : 
                         item.type === 'title' ? '稱?' : 
                         item.type === 'buff' ? '增?' : '?具'}
                      </span>
                      <span className="rounded bg-surface px-2 py-1 text-xs font-bold text-secondary">
                        {item.howToGet}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ????總覽 */}
        <section className="mt-8 rounded-2xl border border-border/10 bg-card p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-secondary">
            ??????
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <Gift className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">??購買</h3>
                <p className="text-xs font-bold text-secondary">使用子??ZXC)???幣(YJC)????店購買?定頭??稱?</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Crown className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">管</h3>
                <p className="text-xs font-bold text-secondary">??活??貢?獲得?????</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Sword className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">寶箱??</h3>
                <p className="text-xs font-bold text-secondary">?戲?獲得?寶箱???????物</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Heart className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">活???</h3>
                <p className="text-xs font-bold text-secondary">????活?完?任???專屬?勵</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}



