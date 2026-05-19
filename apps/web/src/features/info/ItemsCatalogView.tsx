import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Package, Sparkles, Crown, Sword, Heart, Zap, Gift, Search } from 'lucide-react';
import { api } from '../../store/api';
import AppBottomNav from '../../components/AppBottomNav';

interface CatalogItem {
  id: string;
  name: string;
  type: 'avatar' | 'title' | 'item' | 'buff';
  rarity: 'common' | 'rare' | 'legendary' | 'mythic' | 'vip';
  description: string;
  icon: string;
  source: string;
  howToGet: string;
}

const RARITY_COLORS = {
  common: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: '?ÆÈÄ? },
  rare: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Á®Ä?? },
  legendary: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: '?≥Ë™™' },
  mythic: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Á•ûË©±' },
  vip: { bg: 'bg-[#fcc025]/20', text: 'text-[#fcc025]', border: 'border-[#fcc025]/30', label: 'VIP' },
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
    // Âæ?API ?≤Â??ÆÈ??∏Ê?
    Promise.all([
      api.get('/api/v1/rewards/avatars/catalog').catch(() => ({ data: { data: [] } })),
      api.get('/api/v1/rewards/titles/catalog').catch(() => ({ data: { data: [] } })),
    ])
      .then(([avatarsRes, titlesRes]) => {
        const avatars = (avatarsRes.data.data || []).map((item: any) => ({
          ...item,
          type: 'avatar' as const,
          howToGet: item.source === 'shop' ? '?ÜÂ?Ë≥ºË≤∑' : 
                   item.source === 'admin' ? 'ÁÆ°Á??°Ê?‰∫? : 
                   item.source === 'chest' ? 'ÂØ∂ÁÆ±?ãÂ?' : 'Ê¥ªÂ??≤Â?',
        }));
        const titles = (titlesRes.data.data || []).map((item: any) => ({
          ...item,
          type: 'title' as const,
          howToGet: item.source === 'shop' ? '?ÜÂ?Ë≥ºË≤∑' : 
                   item.source === 'admin' ? 'ÁÆ°Á??°Ê?‰∫? : 
                   item.source === 'chest' ? 'ÂØ∂ÁÆ±?ãÂ?' : 'Ê¥ªÂ??≤Â?',
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
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-[#adaaaa] transition-colors hover:text-[#fcc025]">
              <ChevronLeft size={24} />
            </Link>
            <Package className="text-[#fcc025]" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">
              ?©Â??ñÈ?
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-24">
        {/* ?úÂ??åÁØ©??*/}
        <section className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#494847]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="?úÂ??©Â??çÁ®±..."
              className="w-full rounded-xl border border-[#494847]/20 bg-[#1a1919] py-3 pl-10 pr-4 text-sm font-bold text-white placeholder:text-[#494847] focus:outline-none focus:border-[#fcc025]/50"
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'avatar', 'title', 'item'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  filter === type
                    ? 'bg-[#fcc025] text-black'
                    : 'bg-[#1a1919] text-[#adaaaa] border border-[#494847]/20'
                }`}
              >
                {type === 'all' ? '?®ÈÉ®' : 
                 type === 'avatar' ? '?≠Â?' : 
                 type === 'title' ? 'Á®±Ë?' : '?ìÂÖ∑'}
              </button>
            ))}
          </div>
        </section>

        {/* Á®Ä?âÂ∫¶Ë™™Ê? */}
        <section className="mb-6 rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-4">
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">
            Á®Ä?âÂ∫¶Ë™™Ê?
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

        {/* ?©Â??óË°® */}
        <section className="space-y-3">
          {loading && (
            <div className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-8 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#494847] border-t-[#fcc025]" />
              <p className="text-sm font-bold text-[#adaaaa]">ËºâÂÖ•?©Â??ÆÈ?...</p>
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-8 text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-[#494847]" />
              <p className="text-sm font-bold text-[#adaaaa]">?´ÁÑ°Á¨¶Â?Ê¢ù‰ª∂?ÑÁâ©??/p>
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
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0e0e0e]">
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold truncate ${rarity.text}`}>{item.name}</h3>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${rarity.bg} ${rarity.text}`}>
                        {rarity.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-[#adaaaa] line-clamp-2">
                      {item.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 rounded bg-[#0e0e0e] px-2 py-1 text-xs font-bold text-[#adaaaa]">
                        <TypeIcon className="h-3 w-3" />
                        {item.type === 'avatar' ? '?≠Â?' : 
                         item.type === 'title' ? 'Á®±Ë?' : 
                         item.type === 'buff' ? 'Â¢ûÁ?' : '?ìÂÖ∑'}
                      </span>
                      <span className="rounded bg-[#0e0e0e] px-2 py-1 text-xs font-bold text-[#fcc025]">
                        {item.howToGet}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ?≤Â??πÂ?Á∏ΩË¶Ω */}
        <section className="mt-8 rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6">
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">
            ?©Â??≤Â??πÂ?
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fcc025]/10">
                <Gift className="h-4 w-4 text-[#fcc025]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">?ÜÂ?Ë≥ºË≤∑</h3>
                <p className="text-xs font-bold text-[#adaaaa]">‰ΩøÁî®Â≠êÁ?Âπ?ú®?éÂãµ?ÜÂ?Ë≥ºË≤∑?êÂ??≠Â??áÁ®±??/p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Crown className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ÁÆ°Á??°Ê?‰∫?/h3>
                <p className="text-xs font-bold text-[#adaaaa]">?πÊ?Ê¥ªÂ??ñË≤¢?ªÁç≤ÂæóÁ??êÂ??©Â?</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Sword className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ÂØ∂ÁÆ±?ãÂ?</h3>
                <p className="text-xs font-bold text-[#adaaaa]">?äÊà≤?ßÁç≤ÂæóÁ?ÂØ∂ÁÆ±?âÊ??áÈ??∫Á??âÁâ©??/p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Heart className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Ê¥ªÂ??≤Â?</h3>
                <p className="text-xs font-bold text-[#adaaaa]">?ÉË??êÊ?Ê¥ªÂ?ÂÆåÊ?‰ªªÂ??≤Â?Â∞àÂ±¨?éÂãµ</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
