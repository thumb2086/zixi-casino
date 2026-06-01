import { useEffect, useMemo, useState } from 'react';
import { Crown, Gift, Package, Search, Shield, Sparkles, Zap, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatNumber } from '@repo/shared';
import { api } from '../../../store/api';
import { usePreferencesStore } from '../../../store/usePreferencesStore';

interface CatalogItem {
  id: string;
  name?: string;
  label?: string;
  type: 'avatar' | 'title' | 'item' | 'buff';
  rarity?: 'common' | 'rare' | 'legendary' | 'mythic' | 'vip' | 'epic';
  description?: string;
  icon?: string;
  source?: string;
  howToGet: string;
  effect?: { type: string; value: number; duration?: number; currency?: string };
  price?: number;
  meta?: { bundle?: Array<{ id: string; qty?: number }>; totalValue?: number };
}

const RARITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  common: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30', label: '普通' },
  rare: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', label: '稀有' },
  epic: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', label: '史詩' },
  legendary: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', label: '傳說' },
  mythic: { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/30', label: '神話' },
  vip: { bg: 'bg-accent/20', text: 'text-accent', border: 'border-accent/30', label: 'VIP' },
  chaos: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', label: '混沌' },
  abyss: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30', label: '深淵' },
  oracle: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', label: '神諭' },
  original: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30', label: '原始' },
  transcend: { bg: 'bg-white/20', text: 'text-white', border: 'border-white/30', label: '超越' },
};

const RARITY_RANK: Record<string, number> = {
  mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4, vip: 5,
};

const TYPE_ICONS = {
  avatar: Package,
  title: Crown,
  item: Gift,
  buff: Zap,
};

const getHowToGet = (source?: string) => {
  if (source === 'shop') return '商城兌換';
  if (source === 'admin') return '管理員發放';
  if (source === 'chest') return '寶箱開啟';
  return '活動或任務';
};

export default function ItemsTab() {
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'avatar' | 'title' | 'item' | 'buff'>('all');
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/rewards/catalog').catch(() => null),
      api.get('/api/v1/chests/items').catch(() => null),
    ])
      .then(([catalogRes, chestItemsRes]) => {
        const payload = catalogRes?.data?.data ?? {};
        const avatars = (payload.avatars ?? []).map((item: any) => ({
          ...item,
          type: 'avatar' as const,
          howToGet: getHowToGet(item.source),
        }));
        const titles = (payload.titles ?? []).map((item: any) => ({
          ...item,
          type: 'title' as const,
          howToGet: getHowToGet(item.source),
        }));
        const chestItems = (chestItemsRes?.data?.data ?? []).map((item: any) => {
          const rawType = (item.type || item.id || '').toString();
          const itemType = rawType.startsWith('avatar_') || item.type === 'avatar' ? 'avatar'
            : rawType.startsWith('title_') || item.type === 'title' ? 'title'
            : rawType.startsWith('buff_') || item.type === 'buff' ? 'buff'
            : 'item';
          return {
            id: item.id,
            name: item.name || item.label,
            label: item.name || item.label,
            description: item.description,
            icon: item.icon || '🎁',
            rarity: item.rarity,
            source: item.source || 'chest',
            type: itemType,
            howToGet: getHowToGet(item.source || 'chest'),
            effect: item.effect,
            price: item.price,
            meta: item.meta,
          };
        });
        const shopItems = ((payload.customItems ?? []) as any[])
          .filter((i: any) => i.source === 'shop')
          .map((item: any) => ({
            id: item.itemId,
            name: item.name,
            label: item.name,
            description: item.description || '',
            icon: item.icon || '🎁',
            rarity: item.rarity || 'common',
            source: 'shop',
            type: item.type === 'buff' ? 'buff' : item.type === 'avatar' ? 'avatar' : item.type === 'title' ? 'title' : 'item',
            howToGet: '商城兌換',
            effect: item.effect,
            price: Number(item.price) || 0,
            meta: item.meta,
          }));
        setItems(
          [...avatars, ...titles, ...chestItems, ...shopItems].sort(
            (a, b) => (RARITY_RANK[a.rarity ?? 'common'] ?? 4) - (RARITY_RANK[b.rarity ?? 'common'] ?? 4)
          )
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const itemName = item.name || item.label || item.id;
        if (filter !== 'all' && item.type !== filter) return false;
        if (rarityFilter !== 'all' && (item.rarity || 'common') !== rarityFilter) return false;
        if (search && !itemName.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [filter, rarityFilter, items, search],
  );

  return (
    <div className="space-y-6">
      <Link
        to="/app/rewards/submit"
        className="flex items-center justify-between rounded-xl border border-accent/30 bg-gradient-to-r from-[#fcc025]/15 to-[#fcc025]/5 p-4 transition-all hover:from-[#fcc025]/25 hover:to-[#fcc025]/10"
      >
        <div>
          <p className="text-sm font-black text-white">投稿你的稱號 / 頭像</p>
          <p className="mt-1 text-xs text-secondary">送出表情符號與名稱，通過管理員審核後就會加入全站清單</p>
        </div>
        <PlusCircle className="h-6 w-6 text-accent" />
      </Link>
      <section className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜尋頭像、稱號或收藏品"
            className="w-full rounded-xl border border-border/20 bg-card py-3 pl-10 pr-4 text-sm font-bold text-white placeholder:text-muted focus:border-accent/50 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          {([
            ['all', '全部'],
            ['avatar', '頭像'],
            ['title', '稱號'],
            ['item', '道具'],
            ['buff', '增益'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition-all ${
                filter === value
                  ? 'bg-accent text-black'
                  : 'border border-border/20 bg-card text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[['all', '全部', ''], ...Object.entries(RARITY_STYLES).map(([k, v]) => [k, v.label, v.border, v.text])].map(([value, label, border, text]: string[]) => (
            <button
              key={value}
              onClick={() => setRarityFilter(value)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
                rarityFilter === value
                  ? `${border || 'bg-accent'} ${text || 'text-black'}`
                  : 'border border-border/20 bg-card text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/10 bg-card p-4">
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-secondary">稀有度說明</h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(RARITY_STYLES).map((style) => (
            <div key={style.label} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${style.border} ${style.bg}`}>
              <Sparkles className={`h-3 w-3 ${style.text}`} />
              <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {loading && (
          <div className="rounded-xl border border-border/10 bg-card p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-[#fcc025]" />
            <p className="text-sm font-bold text-secondary">載入圖鑑中...</p>
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="rounded-xl border border-border/10 bg-card p-8 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-muted" />
            <p className="text-sm font-bold text-secondary">目前沒有符合條件的物品</p>
          </div>
        )}

        {filteredItems.map((item) => {
          const rarity = RARITY_STYLES[item.rarity] || RARITY_STYLES.common;
          const TypeIcon = TYPE_ICONS[item.type] || Gift;
          const itemName = item.name || item.label || item.id;

          return (
            <div key={`${item.type}-${item.id}`} className={`rounded-xl border p-4 transition-all ${rarity.border} ${rarity.bg}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl">
                  {item.icon || '🎁'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`truncate font-bold ${rarity.text}`}>{itemName}</h3>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${rarity.bg} ${rarity.text}`}>
                      {rarity.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-bold text-secondary">{item.description || '暫無說明'}</p>
                  {item.effect?.type === 'currency' && (
                    <p className="mt-1 text-xs font-bold text-accent">
                      {item.effect.currency === 'yjc' ? `💎 ${item.effect.value} YJC` : `💰 ${nf(Number(item.effect.value))} ZXC`}
                    </p>
                  )}
                  {item.effect?.type === 'xp_boost' && (
                    <p className="mt-1 text-xs font-bold text-secondary">⚡ 經驗 ×{item.effect.value}{item.effect.duration ? ` · ${item.effect.duration}h` : ''}</p>
                  )}
                  {item.effect?.type === 'luck_boost' && (
                    <p className="mt-1 text-xs font-bold text-secondary">🍀 運氣 +{Math.round(item.effect.value * 100)}%{item.effect.duration ? ` · ${item.effect.duration}h` : ' · 永久'}</p>
                  )}
                  {item.effect?.type === 'prevent_loss' && (
                    <p className="mt-1 text-xs font-bold text-secondary">🛡️ 護盾 ×{item.effect.value} 次</p>
                  )}
                  {item.effect?.type === 'vip_trial' && (
                    <p className="mt-1 text-xs font-bold text-secondary">👑 VIP 試用{item.effect.duration ? ` · ${item.effect.duration}h` : ''}</p>
                  )}
                  {item.price && item.price > 0 && (
                    <p className="mt-1 text-xs font-bold text-accent">🛒 {nf(item.price)} ZXC</p>
                  )}
                  {item.meta?.bundle && (
                    <p className="mt-1 text-xs font-bold text-emerald-400">
                      📦 內容 {item.meta.bundle.length} 項{item.meta.totalValue ? ` · ~~${nf(item.meta.totalValue)} ZXC~~` : ''}
                      {item.price && item.meta.totalValue ? ` → ${nf(item.price)} ZXC (${nf(Math.round((1 - item.price / item.meta.totalValue) * 100))}% OFF)` : ''}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded bg-surface px-2 py-1 text-xs font-bold text-secondary">
                      <TypeIcon className="h-3 w-3" />
                      {item.type === 'avatar'
                        ? '頭像'
                        : item.type === 'title'
                        ? '稱號'
                        : item.type === 'buff'
                        ? '增益'
                        : item.type === 'item'
                        ? '道具'
                        : item.type}
                    </span>
                    <span className="rounded bg-surface px-2 py-1 text-xs font-bold text-accent">{item.howToGet}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border/10 bg-card p-6">
        <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-secondary">取得方式說明</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <Gift className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">商城兌換</h3>
              <p className="text-xs font-bold text-secondary">可直接使用代幣購買，適合穩定收集常駐項目。</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <Crown className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">管理員發放</h3>
              <p className="text-xs font-bold text-secondary">通常用於活動獎勵、特殊成就或人工補發。</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Zap className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">寶箱開啟</h3>
              <p className="text-xs font-bold text-secondary">透過寶箱隨機抽出，通常會搭配稀有度分布。</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">活動或任務</h3>
              <p className="text-xs font-bold text-secondary">節慶活動、排行榜或每日任務都可能發放限定項目。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
