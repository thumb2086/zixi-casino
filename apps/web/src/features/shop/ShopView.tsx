import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw, Coins, ShoppingBag, ChevronLeft, Gift, Zap, Shield, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppBottomNav from '../../components/AppBottomNav';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';
import { formatNumber, ITEM_DROP_TABLES, SPECIAL_ITEMS, RARITY_NAMES, ITEM_BASE_VALUES, getItemPawnValue } from '@repo/shared';
import { usePreferencesStore } from '../../store/usePreferencesStore';

const ITEM_MAP: Record<string, { name: string; icon: string; rarity: string; color: string }> = {};
for (const rarity of Object.keys(ITEM_DROP_TABLES) as (keyof typeof ITEM_DROP_TABLES)[]) {
  for (const item of ITEM_DROP_TABLES[rarity]) {
    ITEM_MAP[item.id] = {
      name: item.name,
      icon: item.icon,
      rarity,
      color: RARITY_NAMES[rarity]?.color || '#b0b0b0',
    };
  }
}
for (const item of SPECIAL_ITEMS) {
  ITEM_MAP[item.id] = {
    name: item.name,
    icon: item.icon,
    rarity: item.rarity,
    color: RARITY_NAMES[item.rarity as keyof typeof RARITY_NAMES]?.color || '#b0b0b0',
  };
}

const RARITY_COLORS: Record<string, string> = {
  common: '#b0b0b0',
  rare: '#4fc3f7',
  epic: '#ba68c8',
  legendary: '#ffd54f',
  mythic: '#ff6f00',
  chaos: '#aa00ff',
  abyss: '#00bcd4',
  oracle: '#ff0044',
  primordial: '#ff8800',
  transcendent: '#ff00ff',
};

const ALL_ITEMS_LOOKUP: Record<string, any> = {};
for (const rarity of Object.keys(ITEM_DROP_TABLES) as (keyof typeof ITEM_DROP_TABLES)[]) {
  for (const item of ITEM_DROP_TABLES[rarity]) {
    ALL_ITEMS_LOOKUP[item.id] = item;
  }
}
for (const item of SPECIAL_ITEMS) {
  ALL_ITEMS_LOOKUP[item.id] = item;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const path = (() => {
    if (!values.length) return '';
    const width = 180;
    const height = 56;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / range) * (height - 8) - 4;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  })();
  if (!path) return null;
  return (
    <svg viewBox="0 0 180 56" className="h-10 w-full overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function formatBalance(raw: string | undefined, mode: 'short' | 'full' = 'short'): string {
  if (!raw) return '0';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return formatNumber(n, mode);
}

export default function ShopView() {
  const { sessionId, isAuthorized } = useAuthStore();
  const { amountDisplay } = usePreferencesStore();
  const numberMode = amountDisplay === 'full' ? 'full' : 'short' as const;
  const [tab, setTab] = useState<'shop' | 'pawn' | 'market'>('shop');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [ownedAvatars, setOwnedAvatars] = useState<string[]>([]);
  const [ownedTitles, setOwnedTitles] = useState<string[]>([]);
  const [purchasedBundles, setPurchasedBundles] = useState<string[]>([]);

  // ── Pawn state ───────────────────────────────────────────────────────────
  const [invItems, setInvItems] = useState<any[]>([]);
  const [pawnLoading, setPawnLoading] = useState(false);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [pawnTab, setPawnTab] = useState<'items' | 'stocks'>('items');
  const [stockHoldings, setStockHoldings] = useState<any[]>([]);
  const [stockHistory, setStockHistory] = useState<Record<string, number[]>>({});
  const [sellingStock, setSellingStock] = useState<string | null>(null);

  // ── Market state ───────────────────────────────────────────────────────────
  const [listings, setListings] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [buyingListing, setBuyingListing] = useState<string | null>(null);
  const [marketMsg, setMarketMsg] = useState<string | null>(null);
  const [marketTab, setMarketTab] = useState<'browse' | 'mine'>('browse');
  const [sellItemId, setSellItemId] = useState('');
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState('');
  const [showSellForm, setShowSellForm] = useState(false);

  // ── YJC exchange state ────────────────────────────────────────────────────
  const [yjcBalance, setYjcBalance] = useState('0');
  const [convertZxc, setConvertZxc] = useState('');
  const [convertYjc, setConvertYjc] = useState('');

  const [converting, setConverting] = useState(false);
  const CONVERSION_RATE = 100_000_000; // 1 YJC = 100M ZXC

  const fetchItems = useCallback(async () => {
    try {
      const [catalogRes, summaryRes, invRes] = await Promise.all([
        api.get('/api/v1/rewards/catalog'),
        api.get('/api/v1/wallet/summary', { params: { sessionId } }).catch(() => null),
        api.get('/api/v1/inventory', { params: { sessionId } }).catch(() => null),
      ]);
      const catalog = catalogRes.data?.data?.customItems || [];
      setItems(catalog.filter((i: any) => i.source === 'shop' && Number(i.price) > 0));
      if (invRes?.data?.data) {
        setOwnedAvatars(invRes.data.data.ownedAvatars || []);
        setOwnedTitles(invRes.data.data.ownedTitles || []);
        setPurchasedBundles(invRes.data.data.purchasedBundles || []);
        if (invRes.data.data.items) setInvItems(invRes.data.data.items.filter((i: any) => i.type !== 'avatar' && i.type !== 'title'));
      }
      if (summaryRes?.data?.data) {
        const s = summaryRes.data.data;
        const bal = s?.summary?.balances?.ZXC || s?.balances?.zhixi?.balance || '0';
        setBalance(String(bal));
        setYjcBalance(s?.summary?.balances?.YJC || s?.balances?.yjc?.balance || '0');
      }
    } catch { setItems([]); } finally { setLoading(false); }
  }, [sessionId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const [chests, setChests] = useState<any[]>([]);
  const [buyingChest, setBuyingChest] = useState<string | null>(null);
  const [chestQty, setChestQty] = useState<Record<string, string>>({});

  const fetchChests = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/chests');
      if (res.data?.success) setChests(res.data.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchChests();
  }, [fetchChests]);

  async function handleBuyChest(chestType: string, quantity: number = 1) {
    if (!sessionId) return;
    const label = ({ common:'普通', rare:'稀有', epic:'史詩', legendary:'傳奇', mythic:'神話', chaos:'混沌', abyss:'深淵', oracle:'神諭' } as Record<string,string>)[chestType] || chestType;
    setBuyingChest(chestType);
    setMsg(null);
    try {
      const res = await api.post('/api/v1/chests/buy', { sessionId, chestType, quantity });
      if (res.data?.success) {
        const d = res.data.data;
        const discountText = d.discount > 0 ? ` (省 ${(d.discount * 100).toFixed(0)}%)` : '';
        setMsg(`✅ ${quantity} x ${label}寶箱 已放入背包！${discountText}`);
        if (d.balanceAfter) setBalance(d.balanceAfter);
        fetchItems();
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg(`❌ ${res.data?.error || '購買失敗'}`);
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.data?.error || err?.message || '購買失敗'}`);
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setBuyingChest(null);
    }
  }

  async function handleConvertYjc() {
    if (!sessionId || converting) return;
    const yjcInput = parseFloat(convertZxc);
    if (!yjcInput || yjcInput <= 0) {
      setMsg('❌ 請輸入大於 0 的 YJC 數量');
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    const zxcNeeded = yjcInput * CONVERSION_RATE;
    setConverting(true);
    setMsg(null);
    try {
      const res = await api.post('/api/v1/wallet/convert', { sessionId, zxcAmount: String(zxcNeeded) });
      if (res.data?.success) {
        setMsg(`✅ 成功兌換 ${res.data.data?.yjcAmount || yjcInput} YJC`);
        setConvertZxc('');
        fetchItems();
      } else {
        setMsg(`❌ ${res.data?.error?.message || res.data?.error || '兌換失敗'}`);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.error?.message || err?.message || '兌換失敗'}`);
    } finally {
      setConverting(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }


  async function handleConvertZxcFromYjc() {
    if (!sessionId || converting) return;
    const yjcNum = parseFloat(convertYjc);
    if (!yjcNum || yjcNum <= 0) {
      setMsg('❌ 請輸入大於 0 的 YJC 數量');
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setConverting(true);
    setMsg(null);
    try {
      const res = await api.post('/api/v1/wallet/convert/yjc-to-zxc', { sessionId, yjcAmount: String(yjcNum) });
      if (res.data?.success) {
        setMsg(`✅ 成功兌換 ${res.data.data?.zxcAmount || formatNumber(yjcNum * CONVERSION_RATE, numberMode)} ZXC`);
        setConvertYjc('');
        fetchItems();
      } else {
        setMsg(`❌ ${res.data?.error?.message || res.data?.error || '兌換失敗'}`);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.error?.message || err?.message || '兌換失敗'}`);
    } finally {
      setConverting(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  async function handleBuy(itemId: string) {
    if (!sessionId) return;
    setBuyingId(itemId);
    setMsg(null);
    try {
      const res = await api.post('/api/v1/inventory/buy', { sessionId, itemId });
      if (res.data?.success) {
        setMsg(`${res.data.data?.name || itemId} 購買成功！`);
        const newBal = res.data.data?.balanceAfter;
        if (newBal) setBalance(newBal);
        fetchItems();
      } else {
        setMsg(res.data?.error || '購買失敗');
      }
    } catch (err: any) {
      setMsg(err?.response?.data?.data?.error || err?.message || '購買失敗');
    } finally {
      setBuyingId(null);
    }
  }

  async function handlePawnSell(itemId: string, quantity: number = 1) {
    if (!sessionId || sellingId) return;
    setSellingId(itemId);
    setMsg(null);
    try {
      const res = await api.post('/api/v1/pawn/sell', { sessionId, itemId, quantity });
      if (res.data?.success) {
        setMsg(`典當成功！獲得 +${formatNumber(Number(res.data.data.payout))} ZXC`);
        setBalance(res.data.data.balanceAfter);
        await fetchItems();
      } else {
        setMsg(res.data?.error || '典當失敗');
      }
    } catch (err: any) {
      setMsg(err?.response?.data?.data?.error || err?.message || '典當失敗');
    } finally {
      setSellingId(null);
    }
  }

  // ── Market handlers ──────────────────────────────────────────────────────
  const fetchListings = async () => {
    setMarketLoading(true);
    try {
      const res = await api.get('/api/v1/market-listings');
      if (res.data?.success) setListings(res.data.data || []);
    } catch { setListings([]); }
    finally { setMarketLoading(false); }
  };

  const fetchMyListings = async () => {
    setMarketLoading(true);
    try {
      const res = await api.get('/api/v1/market-listings/mine', { params: { sessionId } });
      if (res.data?.success) setMyListings(res.data.data || []);
    } catch { setMyListings([]); }
    finally { setMarketLoading(false); }
  };

  const handleCreateListing = async () => {
    if (!sessionId || !sellItemId || !sellPrice) return;
    setMarketLoading(true);
    setMarketMsg(null);
    try {
      const res = await api.post('/api/v1/market-listings', { sessionId, itemId: sellItemId, quantity: sellQty, price: Number(sellPrice) });
      if (res.data?.success) {
        setMarketMsg('✅ 掛賣成功！');
        setSellItemId('');
        setSellPrice('');
        setSellQty(1);
        setShowSellForm(false);
        fetchListings();
      } else {
        setMarketMsg(`❌ ${res.data?.error || '掛賣失敗'}`);
      }
    } catch (err: any) {
      setMarketMsg(`❌ ${err?.response?.data?.data?.error || err?.message || '掛賣失敗'}`);
    } finally {
      setMarketLoading(false);
      setTimeout(() => setMarketMsg(null), 4000);
    }
  };

  const handleBuyListing = async (listingId: string) => {
    if (!sessionId || buyingListing) return;
    setBuyingListing(listingId);
    try {
      const res = await api.post(`/api/v1/market-listings/${listingId}/buy`, { sessionId });
      if (res.data?.success) {
        setMsg(`✅ 購買成功！`);
        fetchListings();
        fetchItems();
      } else {
        setMsg(`❌ ${res.data?.error || '購買失敗'}`);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.data?.error || err?.message || '購買失敗'}`);
    } finally {
      setBuyingListing(null);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!sessionId) return;
    try {
      const res = await api.delete(`/api/v1/market-listings/${listingId}`, { data: { sessionId } });
      if (res.data?.success) {
        setMsg('✅ 已取消掛賣');
        fetchMyListings();
      } else {
        setMsg(`❌ ${res.data?.error || '取消失敗'}`);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.data?.error || err?.message || '取消失敗'}`);
    }
  };

  async function handleStockSell(symbol: string, qty: number) {
    if (!sessionId || sellingStock) return;
    setSellingStock(symbol);
    setMsg(null);
    try {
      const res = await api.post('/api/v1/pawn/stock-sell', { sessionId, symbol, quantity: qty });
      if (res.data?.success) {
        setMsg(`✅ 成功出售 ${qty} 股 ${symbol}，獲得 +${formatNumber(Number(res.data.data.payout))} ZXC`);
        setBalance(res.data.data.balanceAfter);
        await fetchItems();
      } else {
        setMsg(`❌ ${res.data?.error || '出售失敗'}`);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.data?.error || err?.message || '出售失敗'}`);
    } finally {
      setSellingStock(null);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  const visibleItems = useMemo(() => items.filter((item: any) => {
    // Hide if already purchased (combo packs, VIP passes, etc.)
    if (purchasedBundles.includes(item.itemId)) return false;
    const meta = item.meta as Record<string, any> | undefined;
    const bundle = meta?.bundle as Array<{ id: string; qty?: number }> | undefined;
    if (bundle) {
      const ownedAvatarOrTitles = bundle.filter(
        (s) => ownedAvatars.includes(s.id) || ownedTitles.includes(s.id),
      );
      const allAvatarOrTitles = bundle.filter((s) => ITEM_MAP[s.id]?.rarity);
      return allAvatarOrTitles.length === 0 || ownedAvatarOrTitles.length < allAvatarOrTitles.length;
    }
    if (item.type === 'avatar' && ownedAvatars.includes(item.itemId)) return false;
    if (item.type === 'title' && ownedTitles.includes(item.itemId)) return false;
    return true;
  }), [items, ownedAvatars, ownedTitles, invItems, purchasedBundles]);

  return (
    <div className="min-h-screen text-white font-manrope-emoji pb-32 bg-surface">
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-xl border-b border-[#494847]/15">
        <div className="flex items-center justify-between px-6 py-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-[#adaaaa] transition-colors hover:text-[#fcc025]">
              <ChevronLeft size={24} />
            </Link>
            <ShoppingBag className="text-[#fcc025]" />
            <h1 className="font-extrabold tracking-tight text-xl text-[#fcc025] uppercase italic">商店</h1>
          </div>
        </div>
        <div className="flex app-shell gap-4">
          <button
            onClick={() => setTab('shop')}
            className={`pb-2 text-sm font-black uppercase tracking-widest transition-colors ${tab === 'shop' ? 'text-[#fcc025] border-b-2 border-[#fcc025]' : 'text-[#adaaaa]'}`}
          >
            商城
          </button>
          <button
            onClick={() => setTab('pawn')}
            className={`pb-2 text-sm font-black uppercase tracking-widest transition-colors ${tab === 'pawn' ? 'text-[#fcc025] border-b-2 border-[#fcc025]' : 'text-[#adaaaa]'}`}
          >
            當舖
          </button>
          <button
            onClick={() => setTab('market')}
            className={`pb-2 text-sm font-black uppercase tracking-widest transition-colors ${tab === 'market' ? 'text-[#fcc025] border-b-2 border-[#fcc025]' : 'text-[#adaaaa]'}`}
          >
            交易市場
          </button>
        </div>
      </header>

      <main className="pt-28 app-shell">
        {/* Balance — full width at top */}
        <section className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-[#fcc025]" />
            <span className="text-sm font-black uppercase tracking-widest text-[#adaaaa]">ZXC 餘額</span>
          </div>
            <span className="text-lg font-black italic text-[#fcc025]">{formatBalance(balance, numberMode)}</span>
        </section>

        <div className="content-grid">
        {/* YJC Exchange */}
        <section className="bg-[#1a1919] rounded-2xl p-5 border border-[#494847]/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💎</span>
            <span className="text-sm font-black uppercase tracking-widest text-[#adaaaa]">佑戩幣 YJC</span>
          </div>
          <div className="bg-[#0e0e0e] rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#adaaaa]">可用 YJC</span>
              <span className="text-sm font-black text-[#4fc3f7]">{formatBalance(yjcBalance, numberMode)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#adaaaa]">可用 ZXC</span>
              <span className="text-sm font-black text-[#fcc025]">{formatBalance(balance, numberMode)}</span>
            </div>
          </div>
          <div className="text-center text-[10px] font-bold text-[#adaaaa] mb-4 tracking-wider">
            1 YJC = {formatNumber(CONVERSION_RATE, numberMode)} ZXC（固定匯率）
          </div>

          {/* ZXC → YJC */}
          <div className="rounded-xl bg-[#0e0e0e] p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-widest text-white">用 ZXC 購買 YJC</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0.0001" step="0.0001"
                placeholder="輸入 YJC 數量"
                value={convertZxc}
                onChange={e => setConvertZxc(e.target.value)}
                className="flex-1 bg-[#1a1919] text-white text-xs font-bold rounded-lg px-3 py-2.5 border border-[#494847]/30 outline-none focus:border-[#4fc3f7] placeholder:text-[#494847] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="shrink-0 text-xs font-bold text-[#4fc3f7] whitespace-nowrap">
                ≈ {formatNumber(parseFloat(convertZxc || '0') * CONVERSION_RATE, numberMode)} ZXC
              </span>
            </div>
            <button
              onClick={handleConvertYjc}
              disabled={converting || !convertZxc || !sessionId}
              className="mt-2 w-full rounded-xl bg-[#4fc3f7] py-2.5 text-xs font-black uppercase tracking-widest text-[#0e0e0e] transition-all disabled:opacity-40 hover:brightness-110 active:scale-[0.98]"
            >
              {converting ? <Loader2 size={14} className="mx-auto animate-spin" /> : '購買 YJC'}
            </button>
          </div>

          {/* YJC → ZXC */}
          <div className="rounded-xl bg-[#0e0e0e] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-widest text-white">用 YJC 換回 ZXC</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0.0001" step="0.0001"
                placeholder="YJC 數量"
                value={convertYjc}
                onChange={e => setConvertYjc(e.target.value)}
                className="flex-1 bg-[#1a1919] text-white text-xs font-bold rounded-lg px-3 py-2.5 border border-[#494847]/30 outline-none focus:border-[#fcc025] placeholder:text-[#494847] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="shrink-0 text-xs font-bold text-[#fcc025] whitespace-nowrap">
                ≈ {formatNumber(parseFloat(convertYjc || '0') * CONVERSION_RATE, numberMode)} ZXC
              </span>
            </div>
            <button
              onClick={handleConvertZxcFromYjc}
              disabled={converting || !convertYjc || !sessionId}
              className="mt-2 w-full rounded-xl bg-[#fcc025] py-2.5 text-xs font-black uppercase tracking-widest text-black transition-all disabled:opacity-40 hover:brightness-110 active:scale-[0.98]"
            >
              {converting ? <Loader2 size={14} className="mx-auto animate-spin" /> : '確認換回 ZXC'}
            </button>
          </div>
        </section>

        {tab === 'shop' && (
          <>
          <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#fcc025]/20">
          <div className="flex items-center gap-2 mb-4">
            <Gift size={16} className="text-[#fcc025]" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">寶箱</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {chests.map((chest: any) => {
              const boughtHere = buyingChest === chest.id;
              const qty = parseInt(chestQty[chest.id] || '1', 10) || 1;
              const discount = qty >= 10 ? 0.10 : qty >= 5 ? 0.05 : 0;
              const unitPrice = Math.round(chest.price * (1 - discount));
              return (
                <div key={chest.id} className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20 flex flex-col">
                  <Gift className="w-8 h-8 mx-auto mb-2 text-[#fcc025]" />
                  <p className="text-sm font-bold text-white text-center truncate">{chest.name}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <button onClick={() => setChestQty(p => ({ ...p, [chest.id]: String(Math.max(1, (parseInt(p[chest.id] || '1', 10) || 1) - 1)) }))} className="text-[#fcc025] font-bold text-sm w-6 h-6 flex items-center justify-center rounded bg-[#1a1919]">−</button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={chestQty[chest.id] ?? '1'}
                      onChange={(e) => setChestQty(p => ({ ...p, [chest.id]: e.target.value }))}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!v || v < 1) setChestQty(p => ({ ...p, [chest.id]: '1' }));
                      }}
                      className="w-12 bg-[#0e0e0e] border border-[#494847]/40 rounded text-center text-white text-xs font-bold focus:outline-none focus:border-[#fcc025]"
                    />
                    <button onClick={() => setChestQty(p => ({ ...p, [chest.id]: String((parseInt(p[chest.id] || '1', 10) || 1) + 1) }))} className="text-[#fcc025] font-bold text-sm w-6 h-6 flex items-center justify-center rounded bg-[#1a1919]">+</button>
                  </div>
                  <p className="text-center text-xs text-[#adaaaa] mt-2">
                    {formatNumber(qty * unitPrice, numberMode)} ZXC
                    {discount > 0 && <span className="text-emerald-400 ml-1">-{discount * 100}%</span>}
                  </p>
                  <button
                    onClick={() => handleBuyChest(chest.id, qty)}
                    disabled={boughtHere}
                    className="mt-2 w-full bg-[#fcc025] text-black text-sm font-bold py-2 rounded-lg hover:brightness-110 disabled:opacity-50"
                  >
                    {boughtHere ? '購買中...' : '購買'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">商城商品</h2>
            <button onClick={fetchItems} className="text-[#adaaaa] hover:text-white transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#fcc025]" />
            </div>
          )}

          {!loading && visibleItems.length === 0 && (
            <p className="text-sm text-[#adaaaa] text-center py-8">目前暫無商品</p>
          )}

          <div className="space-y-3">
            {visibleItems.map((item: any) => {
              const meta = item.meta as Record<string, any> | undefined;
              const bundle = meta?.bundle as Array<{ id: string; qty?: number }> | undefined;
              const totalValue = Number(meta?.totalValue) || 0;
              const price = Number(item.price) || 0;
              const hasDiscount = bundle && totalValue > 0 && price < totalValue;

              return (
                <div key={item.itemId} className="flex items-center gap-4 bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
                  <div className="text-2xl shrink-0">{item.icon || '📦'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.name}</p>
                    <p className="text-sm text-[#adaaaa] truncate">{item.description || ''}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold uppercase" style={{ color: RARITY_COLORS[item.rarity] || '#b0b0b0' }}>
                        {item.rarity}
                      </span>
                      {bundle && (
                        <span className="text-sm font-bold text-emerald-400">📦 組合包</span>
                      )}
                    </div>
                    {bundle && (
                      <div className="mt-1.5 space-y-1">
                        {bundle.map((sub: any, i: number) => {
                            const info = ITEM_MAP[sub.id];
                            const subValue = sub.value || meta?.subItemValues?.[sub.id];
                            let computedValue: number | null = null;
                            if (subValue != null) {
                              computedValue = subValue;
                            } else {
                              const def = ALL_ITEMS_LOOKUP[sub.id];
                              if (def?.effect?.type === 'currency') {
                                computedValue = def.effect.value;
                              } else if (info?.rarity && ITEM_BASE_VALUES[info.rarity as keyof typeof ITEM_BASE_VALUES] != null) {
                                computedValue = ITEM_BASE_VALUES[info.rarity as keyof typeof ITEM_BASE_VALUES];
                              }
                            }
                            return (
                              <div key={i} className="flex items-center gap-1.5 text-sm">
                                <span className="shrink-0">{info?.icon || '•'}</span>
                                <span className="text-white font-medium">{info?.name || sub.id}</span>
                                {(sub.qty || 1) > 1 && <span className="text-[#adaaaa]">×{sub.qty}</span>}
                                {computedValue != null ? <span className="text-sm font-bold text-emerald-400 ml-auto">+{formatNumber(computedValue, numberMode)} ZXC</span>
                                  : hasDiscount && totalValue > 0 && bundle.length > 1 && (
                                    <span className="text-sm text-[#adaaaa] ml-auto">~{formatNumber(Math.round(totalValue / bundle.length), numberMode)} ZXC</span>
                                  )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                    {hasDiscount && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-[#adaaaa] line-through">{formatNumber(totalValue, numberMode)} ZXC</span>
                        <span className="text-sm font-black text-emerald-400">{formatNumber(price, numberMode)} ZXC</span>
                        <span className="text-sm font-black bg-emerald-400/20 text-emerald-400 px-1.5 py-0.5 rounded">
                          -{Math.round((1 - price / totalValue) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-black text-[#fcc025]">
                      {formatNumber(price, numberMode)} {item.meta?.token === 'yjc' ? 'YJC' : 'ZXC'}
                    </span>
                    <button
                      onClick={() => handleBuy(item.itemId)}
                      disabled={buyingId === item.itemId || !sessionId}
                      className="text-sm font-black uppercase tracking-widest bg-[#fcc025] text-[#0e0e0e] px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {buyingId === item.itemId ? <Loader2 size={10} className="animate-spin" /> : '購買'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </section>
          </>
        )}

        {tab === 'pawn' && (
        <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 size={16} className="text-[#fcc025]" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">當舖</h2>
          </div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPawnTab('items')}
              className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-colors ${pawnTab === 'items' ? 'bg-[#fcc025] text-black' : 'bg-[#494847]/30 text-[#adaaaa]'}`}
            >
              道具
            </button>
            <button
              onClick={() => setPawnTab('stocks')}
              className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-colors ${pawnTab === 'stocks' ? 'bg-[#fcc025] text-black' : 'bg-[#494847]/30 text-[#adaaaa]'}`}
            >
              股票
            </button>
          </div>

          {pawnTab === 'items' && (
          <>
          <p className="text-sm text-[#adaaaa] mb-4">將不需要的道具典當換取 ZXC</p>
          {invItems.length === 0 ? (
            <p className="text-sm text-[#adaaaa] text-center py-8">暫無可典當的道具</p>
          ) : (
            <div className="space-y-3">
              {invItems.map((item: any) => {
                const def = ALL_ITEMS_LOOKUP[item.id];
                const price = def ? getItemPawnValue(def) : 0;
                return (
                  <div key={item.id} className="flex items-center gap-4 bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
                    <div className="text-2xl shrink-0">{item.icon || '📦'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      <p className="text-sm text-[#adaaaa] truncate">{item.description || ''}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold uppercase" style={{ color: RARITY_COLORS[item.rarity] || '#b0b0b0' }}>
                          {item.rarity}
                        </span>
                        <span className="text-sm text-[#adaaaa]">×{item.quantity}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-black text-emerald-400">+{price} ZXC</span>
                      <button
                        onClick={() => handlePawnSell(item.id, 1)}
                        disabled={sellingId === item.id || !sessionId}
                        className="text-sm font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-red-500/30 transition-colors"
                      >
                        {sellingId === item.id ? <Loader2 size={10} className="animate-spin" /> : '典當'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}

          {pawnTab === 'stocks' && (
          <>
          <p className="text-sm text-[#adaaaa] mb-4">以市價 70% 出售股票，立即變現 ZXC</p>
          {stockHoldings.length === 0 ? (
            <p className="text-sm text-[#adaaaa] text-center py-8">暫無持股</p>
          ) : (
            <>
            {/* ── Portfolio Summary ── */}
            <div className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20 mb-4">
              <div className="text-xs font-black uppercase tracking-widest text-[#adaaaa] mb-2">持倉總覽</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {(() => {
                  const totalValue = stockHoldings.reduce((s, st) => s + (st.price || 0) * st.qty, 0);
                  const totalCost = stockHoldings.reduce((s, st) => s + (st.avgPrice || 0) * st.qty, 0);
                  const totalPnl = stockHoldings.reduce((s, st) => s + (st.unrealizedPnl || 0), 0);
                  const totalPayout = stockHoldings.reduce((s, st) => s + Math.round((st.price || 0) * 0.7) * st.qty, 0);
                  return (
                    <>
                      <div>
                        <span className="text-[#adaaaa]">市值</span>
                        <p className="font-black text-white">{formatNumber(totalValue, numberMode)} ZXC</p>
                      </div>
                      <div>
                        <span className="text-[#adaaaa]">即時變現</span>
                        <p className="font-black text-emerald-400">{formatNumber(totalPayout, numberMode)} ZXC</p>
                      </div>
                      <div>
                        <span className="text-[#adaaaa]">損益</span>
                        <p className={`font-black ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {totalPnl >= 0 ? '+' : ''}{formatNumber(totalPnl, numberMode)} ZXC
                        </p>
                      </div>
                      <div>
                        <span className="text-[#adaaaa]">成本</span>
                        <p className="font-black text-[#adaaaa]">{formatNumber(totalCost, numberMode)} ZXC</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="space-y-3">
              {stockHoldings.map((stock: any) => {
                const marketPrice = stock.price || stock.marketPrice || 0;
                const payoutPerUnit = Math.round(marketPrice * 0.7);
                const totalPayout = payoutPerUnit * stock.qty;
                const dayChange = stock.dayChangePct || 0;
                const pnl = stock.unrealizedPnl || 0;
                const pnlPct = stock.roiPct || 0;
                const isUp = dayChange >= 0;
                const history = stockHistory[stock.symbol] || [];
                return (
                  <div key={stock.symbol} className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl shrink-0">📈</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">{stock.symbol}</p>
                          {stock.name && <span className="text-[10px] text-[#adaaaa] truncate">{stock.name}</span>}
                          {stock.sector && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#adaaaa] bg-[#494847]/20 px-1.5 py-0.5 rounded">{stock.sector}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm font-black text-white">{formatNumber(marketPrice, numberMode)} ZXC</span>
                          <span className={`text-xs font-black ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(dayChange).toFixed(2)}%
                          </span>
                          <span className="text-xs text-[#adaaaa]">{stock.qty} 股</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-xs font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}{formatNumber(pnl, numberMode)} ZXC ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                          </span>
                          <span className="text-xs text-[#adaaaa]">均價 {formatNumber(Number(stock.avgPrice || 0), numberMode)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-black text-emerald-400">+{formatNumber(totalPayout, numberMode)} ZXC</span>
                        <span className="text-[10px] text-[#adaaaa]">(70% 變現)</span>
                        <button
                          onClick={() => handleStockSell(stock.symbol, stock.qty)}
                          disabled={sellingStock === stock.symbol || !sessionId}
                          className="text-sm font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-red-500/30 transition-colors"
                        >
                          {sellingStock === stock.symbol ? <Loader2 size={10} className="animate-spin" /> : '出售'}
                        </button>
                      </div>
                    </div>
                    {history.length > 1 && (
                      <div className="mt-2 -mb-2">
                        <Sparkline values={history} color={isUp ? '#00f59b' : '#ff6d6d'} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
          </>
          )}
        </section>
        )}

        {/* ── Trading Market Tab ──────────────────────────────────────────────── */}
        {tab === 'market' && (
        <section className="bg-[#1a1919] rounded-2xl p-6 border border-[#494847]/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🏪</span>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">交易市場</h2>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => { setMarketTab('browse'); fetchListings(); }}
              className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-lg ${marketTab === 'browse' ? 'bg-[#fcc025] text-black' : 'bg-[#494847]/30 text-[#adaaaa]'}`}>瀏覽</button>
            <button onClick={() => { setMarketTab('mine'); fetchMyListings(); }}
              className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-lg ${marketTab === 'mine' ? 'bg-[#fcc025] text-black' : 'bg-[#494847]/30 text-[#adaaaa]'}`}>我的掛賣</button>
          </div>

          {marketTab === 'browse' && (
          <>
          <button onClick={() => setShowSellForm(o => !o)}
            className="w-full mb-4 text-sm font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-lg hover:bg-emerald-500/30">
            {showSellForm ? '收起' : '+ 我要賣'}
          </button>

          {showSellForm && (
            <div className="bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20 mb-4 space-y-3">
              <select value={sellItemId} onChange={e => setSellItemId(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-[#494847]/40 rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-[#fcc025]">
                <option value="">選擇道具</option>
                {invItems.map((item: any) => (
                  <option key={item.id} value={item.id}>{item.name} (x{item.quantity})</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input type="number" min={1} placeholder="數量" value={sellQty} onChange={e => setSellQty(parseInt(e.target.value) || 1)}
                  className="w-20 bg-[#0e0e0e] border border-[#494847]/40 rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-[#fcc025]" />
                <input type="number" min={1} placeholder="價格 (ZXC)" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                  className="flex-1 bg-[#0e0e0e] border border-[#494847]/40 rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-[#fcc025]" />
              </div>
              <button onClick={handleCreateListing} disabled={!sellItemId || !sellPrice}
                className="w-full bg-[#fcc025] text-black font-black text-sm py-2 rounded-lg disabled:opacity-50">掛賣</button>
              {marketMsg && <p className="text-xs font-bold text-emerald-400">{marketMsg}</p>}
            </div>
          )}

          {marketLoading ? (
            <Loader2 size={16} className="animate-spin mx-auto text-[#fcc025]" />
          ) : listings.length === 0 ? (
            <p className="text-sm text-[#adaaaa] text-center py-8">目前無人在賣</p>
          ) : (
            <div className="space-y-3">
              {listings.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
                  <span className="text-2xl shrink-0">{l.itemIcon || '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{l.itemName || l.itemId}</p>
                    <p className="text-xs text-[#adaaaa]">{l.quantity} 個 · {l.sellerAddress?.slice(0, 6)}...{l.sellerAddress?.slice(-4)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-black text-[#fcc025]">{formatNumber(Number(l.price), numberMode)} ZXC</span>
                    <button onClick={() => handleBuyListing(l.id)} disabled={buyingListing === l.id}
                      className="text-xs font-black uppercase tracking-widest bg-[#fcc025] text-black px-3 py-1.5 rounded-lg disabled:opacity-50">
                      {buyingListing === l.id ? <Loader2 size={10} className="animate-spin" /> : '購買'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </>
          )}

          {marketTab === 'mine' && (
          <>
          <p className="text-sm text-[#adaaaa] mb-4">你可以在這裡管理你的掛賣物品</p>
          {myListings.length === 0 ? (
            <p className="text-sm text-[#adaaaa] text-center py-8">尚無掛賣</p>
          ) : (
            <div className="space-y-3">
              {myListings.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 bg-[#0e0e0e] rounded-xl p-4 border border-[#494847]/20">
                  <span className="text-2xl shrink-0">📦</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{l.itemId}</p>
                    <p className="text-xs text-[#adaaaa]">{l.quantity} 個 · {formatNumber(Number(l.price), numberMode)} ZXC</p>
                    <span className={`text-[10px] font-bold uppercase ${l.status === 'active' ? 'text-emerald-400' : 'text-[#adaaaa]'}`}>{l.status}</span>
                  </div>
                  {l.status === 'active' && (
                    <button onClick={() => handleCancelListing(l.id)}
                      className="text-xs font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg">取消</button>
                  )}
                </div>
              ))}
            </div>
          )}
          </>
          )}
        </section>
        )}

        </div>
      </main>

      {msg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#1a1919] border border-[#fcc025]/40 shadow-lg shadow-black/50 text-sm font-bold text-white animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">
          {msg}
        </div>
      )}

      <AppBottomNav current="shop" />
    </div>
  );
}
