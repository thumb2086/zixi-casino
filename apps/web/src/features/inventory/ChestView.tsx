import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronRight, X, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@repo/shared';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useToastStore } from '../../store/useToastStore';
import AppBottomNav from '../../components/AppBottomNav';
import { api } from '../../store/api';

interface ChestConfig {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  dropCount: { min: number; max: number };
  pityThreshold: number;
  rarities: {
    rarity: string;
    name: string;
    color: string;
    chance: number;
  }[];
}

interface ChestItem {
  item: {
    id: string;
    name: string;
    nameEn: string;
    type: string;
    rarity: string;
    description: string;
    icon: string;
  };
  isNew: boolean;
  quantity: number;
}

interface InventoryEntry {
  id: string;
  name: string;
  nameEn?: string;
  type: string;
  rarity: string;
  description?: string;
  icon: string;
  quantity: number;
  consumable?: boolean;
  tradable?: boolean;
  rarityColor?: string;
  rarityName?: string;
  effect?: { type: string; value?: number; duration?: number };
}

interface ActiveBuff {
  id: string;
  type: string;
  value: number;
  remaining?: number;
  expiresAt?: string | null;
  source?: string;
}

interface InventoryState {
  items: InventoryEntry[];
  activeBuffs: ActiveBuff[];
  ownedAvatars: string[];
  ownedTitles: string[];
  activeAvatar?: string;
  activeTitle?: string;
}

interface ChestStatus {
  chestPity: Record<string, number>;
  keyCounts: Record<string, number>;
  nextFreeChestAvailable: boolean;
  dailyFreeChestType: string;
  dailyFreeCooldownHours: number;
  balance: string;
  inventorySlotsUsed: number;
  inventorySlotsMax: number;
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
};

function formatExpires(expiresAt: string | null | undefined, t: (key: string, opts?: any) => string): string {
  if (!expiresAt) return '';
  const ts = Date.parse(expiresAt);
  if (!Number.isFinite(ts)) return '';
  const diff = ts - Date.now();
  if (diff <= 0) return t('chest.buff_expired');
  const mins = Math.ceil(diff / 60000);
  if (mins < 60) return t('chest.buff_remaining_min', { count: mins });
  const hrs = Math.ceil(mins / 60);
  return t('chest.buff_remaining_hour', { count: hrs });
}

export default function ChestView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const [chests, setChests] = useState<ChestConfig[]>([]);
  const [status, setStatus] = useState<ChestStatus | null>(null);
  const [inventory, setInventory] = useState<InventoryState>({
    items: [],
    activeBuffs: [],
    ownedAvatars: [],
    ownedTitles: [],
  });
  const [invTab, setInvTab] = useState<'chests' | 'tokens' | 'buffs' | 'collection'>('chests');
  const [useStatusMessage, setUseStatusMessage] = useState<string | null>(null);
  const [usingAllTokens, setUsingAllTokens] = useState(false);
  const showToast = useToastStore((s) => s.showToast);
  const [useQty, setUseQty] = useState<Record<string, string>>({});
  const [giftDialog, setGiftDialog] = useState<{ itemId: string; name: string; maxQty: number } | null>(null);
  const [giftAddress, setGiftAddress] = useState('');
  const [giftQty, setGiftQty] = useState('1');
  const [giftSending, setGiftSending] = useState(false);
  const [recipients, setRecipients] = useState<Array<{ address: string; displayName: string }>>([]);

  const pity = status?.chestPity || {};
  const keyCounts = status?.keyCounts || {};
  const [localPity, setLocalPity] = useState<Record<string, number> | null>(null);
  const [localKeyCounts, setLocalKeyCounts] = useState<Record<string, number> | null>(null);
  const displayPity = localPity || pity;
  const displayKeyCounts = localKeyCounts || keyCounts;

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/gift/recipients");
      if (res.data?.success) setRecipients(res.data.data.users);
    } catch {
      // silently ignore
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/chests/status');
      if (res.data?.success) setStatus(res.data.data);
    } catch {
      // silently ignore
    }
  }, []);

  const refreshInventory = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/inventory');
      if (res.data?.success) setInventory(res.data.data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
    (async () => {
      try {
        const res = await api.get('/api/v1/chests');
        if (res.data?.success) setChests(res.data.data);
        } catch {
        // silently ignore
      }
    })();
    refreshStatus();
    refreshInventory();
  }, [refreshStatus, refreshInventory, fetchRecipients]);

  const [opening, setOpening] = useState(false);
  const [openQtys, setOpenQtys] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [openedItems, setOpenedItems] = useState<ChestItem[]>([]);
  const [openCompensation, setOpenCompensation] = useState(0);

  const handleOpen = async (chestId: string, quantity: number) => {
    if (opening) return;
    setOpening(true);
    try {
      const endpoint = quantity === 1 ? '/api/v1/chests/open' : '/api/v1/chests/open-bulk';
      const body = quantity === 1
        ? { chestType: chestId, free: false }
        : { chestType: chestId, quantity };
      const res = await api.post(endpoint, body);
      if (res.data?.success) {
        const data = res.data.data;
        const items = data.items || data.result?.items || [];
        const compensation = data.compensationZXC || 0;
        setOpenedItems(items);
        setOpenCompensation(compensation);
        if (data.status) {
          setLocalPity(data.status.chestPity);
          setLocalKeyCounts(data.status.keyCounts);
        } else {
          if (data.pityCount !== undefined) {
            setLocalPity(prev => ({ ...(prev || pity), [chestId]: data.pityCount }));
          }
          if (data.keyCounts) {
            setLocalKeyCounts(prev => ({ ...(prev || keyCounts), ...data.keyCounts }));
          }
        }
        setShowResult(true);
        await refreshInventory();
        await refreshStatus();
      } else {
        showToast(res.data?.error || '操作失敗');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || '網路錯誤');
    } finally {
      setOpening(false);
    }
  };

  const useAllTokens = async () => {
    setUsingAllTokens(true);
    setUseStatusMessage('收藏部?...');
    try {
      const res = await api.post('/api/v1/inventory/use-all-tokens', {});
      if (res.data?.success) {
        const d = res.data.data;
        const parts: string[] = [];
        if (d.totalZxc > 0) parts.push(`${d.totalZxc.toLocaleString()} ZXC`);
        if (d.totalYjc > 0) parts.push(`${d.totalYjc} YJC`);
        showToast(`×使用 ${d.itemCount} ?物收藏 ${parts.join(' + ')}`);
        await refreshInventory();
        queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      } else {
        showToast(res.data?.error || '操作失敗');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || '操作失敗');
    } finally {
      setUsingAllTokens(false);
      setUseStatusMessage(null);
    }
  };

  const useItem = async (itemId: string, quantity: number = 1) => {
    setUseStatusMessage('使用中...');
    try {
      const res = await api.post('/api/v1/inventory/use', { itemId, quantity });
      if (res.data?.success) {
        const d = res.data.data;
        if (d.currencyGranted > 0) {
          showToast(`× ${nf(d.currencyGranted)} ${d.currencyToken === 'yjc' ? 'YJC' : 'ZXC'}`);
        } else if (d.effectSummary) {
          showToast(d.effectSummary);
        } else {
          showToast(`×使用 ${quantity} ?物?`);
        }
        await refreshInventory();
        queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      } else {
        showToast(res.data?.error || '使用失?');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || '使用失?');
    } finally {
      setUseStatusMessage(null);
    }
  };

  const groupedItems = inventory.items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, InventoryEntry[]>);

  const itemTypeLabels: Record<string, string> = {
    chest_key: '遊戲',
    token: '代幣',
    buff: '增益',
    avatar: '頭像',
    title: '稱號',
    collectible: '收藏品',
  };

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Package className="text-accent" />
            <div>
              <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
                ×中?
              </h1>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                收藏?
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-caption font-bold uppercase tracking-widest text-secondary">空?</p>
            <p className="text-sm font-black text-white">
              {status?.inventorySlotsUsed || 0}
              <span className="mx-1 text-muted">/</span>
              {status?.inventorySlotsMax || 0}
            </p>
          </div>
        </div>
      </header>

      <main className="px-6 pt-24 space-y-8">
        {/* Active Buffs */}
        {inventory.activeBuffs.length > 0 && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {inventory.activeBuffs.map((buff) => (
              <div key={buff.id} className="relative overflow-hidden rounded-xl border border-accent/20 bg-card p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    {buff.type === 'prevent_loss' ? <Shield size={16} /> : <Zap size={16} />}
                  </div>
                  <div>
                    <p className="text-caption font-bold uppercase tracking-wider text-secondary">
                      {t(`chest.buff_type_${buff.type}`)}
                    </p>
                    <p className="text-xs font-bold text-white">
                      {buff.type === 'prevent_loss' ? `x${buff.remaining}` : buff.type === 'vip_tier' ? `VIP ${buff.value}` : `+${buff.value * 100}%`}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-caption font-bold text-secondary opacity-60">
                  {buff.expiresAt ? formatExpires(buff.expiresAt, t) : t('chest.buff_active')}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-border/20 pb-3">
          {(['chests', 'tokens', 'buffs', 'collection'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInvTab(tab)}
              className={`text-sm font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors ${
                invTab === tab ? 'bg-accent text-black' : 'bg-[#494847]/20 text-secondary hover:bg-[#494847]/30'
              }`}
            >
              {{ chests: '寶箱', tokens: '💰', buffs: '遊戲', collection: '遊戲' }[tab]}
            </button>
          ))}
        </div>

        {/* Tab: Chests */}
        {invTab === 'chests' && (
        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-secondary mb-4">×?寶</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {chests.map((chest) => {
              const keys = displayKeyCounts[chest.id] || 0;
              const currentPity = displayPity[chest.id] || 0;
              const chestOpenQty = openQtys[chest.id] ?? '1';
              const openQtyNum = parseInt(chestOpenQty, 10) || 1;
              const canOpen = keys >= openQtyNum;

              return (
                <div key={chest.id} className="group relative overflow-hidden rounded-2xl border border-border/20 bg-card p-5 transition-all hover:border-accent/30">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white">{chest.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-accent/10 px-2 py-0.5 text-caption font-bold uppercase tracking-wider text-accent">
                          {keys} ?鑰×
                        </span>
                      </div>
                    </div>
                    <div className="text-4xl">?</div>
                  </div>

                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between text-caption font-bold uppercase tracking-widest text-secondary">
                      <span>保×度</span>
                      <span className="text-accent">{currentPity} / {chest.pityThreshold}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentPity / chest.pityThreshold) * 100}%` }}
                        className="h-full bg-gradient-to-r from-[#fcc025] to-[#e6ad03]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-3">
                    {[1, 5, 10, 100].map((q) => (
                      <button key={q} onClick={() => setOpenQtys(p => ({ ...p, [chest.id]: String(q) }))}
                        className={`rounded-md px-2 py-1 text-caption font-bold transition-all ${parseInt(chestOpenQty, 10) === q ? 'bg-accent text-black' : 'bg-[#494847]/20 text-secondary'}`}>x{q}</button>
                    ))}
                    <input type="text" inputMode="numeric" value={chestOpenQty}
                      onChange={(e) => setOpenQtys(p => ({ ...p, [chest.id]: e.target.value }))}
                      onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!v || v < 1) setOpenQtys(p => ({ ...p, [chest.id]: '1' })); }}
                      className="w-14 bg-surface border border-border/40 rounded-lg text-white font-bold text-xs text-center py-1 focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>

                  <button
                    onClick={() => handleOpen(chest.id, openQtyNum)}
                    disabled={!canOpen || opening}
                    className={`w-full rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                      canOpen
                        ? 'bg-accent text-black shadow-lg shadow-[#fcc025]/20 hover:brightness-110 active:scale-[0.98]'
                        : 'bg-[#494847]/20 text-muted cursor-not-allowed border border-border/10'
                    }`}
                  >
                    {opening ? '開啟中..' : `× ${openQtyNum} ?`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* Tab: Tokens */}
        {invTab === 'tokens' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-secondary">?</h2>
              {(() => {
                const tokenItems = groupedItems['token'] || [];
                const totalTokens = tokenItems.reduce((sum, i) => sum + (i.effect?.value || 0) * i.quantity, 0);
                return tokenItems.length > 0 ? (
                  <button
                    onClick={useAllTokens}
                    disabled={usingAllTokens}
                    className="text-xs font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {usingAllTokens ? '開啟中..' : `?部使用 (×{totalTokens.toLocaleString()} ZXC)`}
                  </button>
                ) : null;
              })()}
            </div>
            {(!groupedItems['token'] || groupedItems['token'].length === 0) ? (
              <p className="text-sm text-secondary text-center py-8">?無×?</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {groupedItems['token'].map((item) => (
                  <div key={item.id} className="flex flex-col rounded-xl border border-border/20 bg-card p-3">
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="rounded bg-elevated px-1.5 py-0.5 text-caption font-bold text-secondary">x{item.quantity}</span>
                    </div>
                    <h4 className="mb-1 truncate text-xs font-bold text-white">{item.name}</h4>
                    <p className="mb-3 text-caption font-bold text-secondary leading-relaxed min-h-[2.4em]">{item.description}</p>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <input type="text" inputMode="numeric"
                        value={useQty[item.id] ?? '1'}
                        onChange={(e) => setUseQty(p => ({ ...p, [item.id]: e.target.value }))}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!v || v < 1) setUseQty(p => ({ ...p, [item.id]: '1' }));
                          else if (v > item.quantity) setUseQty(p => ({ ...p, [item.id]: String(item.quantity) }));
                        }}
                        className="w-12 bg-surface border border-border/40 rounded-lg text-white font-bold text-xs text-center focus:outline-none focus:border-accent"
                      />
                      <button onClick={() => setUseQty(p => ({ ...p, [item.id]: String(item.quantity) }))}
                        className="text-caption font-bold bg-[#494847]/20 text-secondary px-1.5 py-1 rounded-lg hover:bg-[#494847]/40">Max</button>
                      <button onClick={() => useItem(item.id, parseInt(useQty[item.id] || '1', 10) || 1)}
                        className="flex-1 bg-accent text-black font-black text-sm py-2 rounded-lg hover:bg-[#e6ad03]">使用</button>
                      <button onClick={() => setGiftDialog({ itemId: item.id, name: item.name, maxQty: item.quantity })}
                        className="flex-1 border border-accent text-accent font-black text-sm py-2 rounded-lg hover:bg-accent/10">贈</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Buffs */}
        {invTab === 'buffs' && (
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-secondary">收藏</h2>
            {(!groupedItems['buff'] || groupedItems['buff'].length === 0) ? (
              <p className="text-sm text-secondary text-center py-8">?無收藏</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {groupedItems['buff'].map((item) => (
                  <div key={item.id} className="flex flex-col rounded-xl border border-border/20 bg-card p-3">
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="rounded bg-elevated px-1.5 py-0.5 text-caption font-bold text-secondary">x{item.quantity}</span>
                    </div>
                    <h4 className="mb-1 truncate text-xs font-bold text-white">{item.name}</h4>
                    <p className="mb-3 text-caption font-bold text-secondary leading-relaxed min-h-[2.4em]">{item.description}</p>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <input type="text" inputMode="numeric"
                        value={useQty[item.id] ?? '1'}
                        onChange={(e) => setUseQty(p => ({ ...p, [item.id]: e.target.value }))}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!v || v < 1) setUseQty(p => ({ ...p, [item.id]: '1' }));
                          else if (v > item.quantity) setUseQty(p => ({ ...p, [item.id]: String(item.quantity) }));
                        }}
                        className="w-12 bg-surface border border-border/40 rounded-lg text-white font-bold text-xs text-center focus:outline-none focus:border-accent"
                      />
                      <button onClick={() => useItem(item.id, parseInt(useQty[item.id] || '1', 10) || 1)}
                        className="flex-1 bg-accent text-black font-black text-sm py-2 rounded-lg hover:bg-[#e6ad03]">使用</button>
                      <button onClick={() => setGiftDialog({ itemId: item.id, name: item.name, maxQty: item.quantity })}
                        className="flex-1 border border-accent text-accent font-black text-sm py-2 rounded-lg hover:bg-accent/10">贈</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Collection */}
        {invTab === 'collection' && (
          <section className="space-y-6">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-secondary">×</h2>
            {(['avatar', 'title', 'collectible', 'chest_key'] as const).map((type) => {
              const items = groupedItems[type] || [];
              if (items.length === 0) return null;
              return (
                <div key={type} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">{itemTypeLabels[type] || type}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col rounded-xl border border-border/20 bg-card p-3">
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-2xl">{item.icon}</span>
                          {(type === 'chest_key' || item.quantity > 1) && (
                            <span className="rounded bg-elevated px-1.5 py-0.5 text-caption font-bold text-secondary">x{item.quantity}</span>
                          )}
                        </div>
                        <h4 className="mb-1 truncate text-xs font-bold text-white">{item.name}</h4>
                        <p className="mb-3 text-caption font-bold text-secondary leading-relaxed min-h-[2.4em]">{item.description}</p>
                        {(type === 'avatar' || type === 'title') && (
                          <div className="mt-auto flex gap-2">
                            <button onClick={() => useItem(item.id)}
                              className="flex-1 border border-accent text-accent font-black text-sm py-2 rounded-lg hover:bg-accent hover:text-black">裝?</button>
                            <button onClick={() => setGiftDialog({ itemId: item.id, name: item.name, maxQty: item.quantity })}
                              className="flex-1 border border-accent text-accent font-black text-sm py-2 rounded-lg hover:bg-accent/10">贈</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {['avatar', 'title', 'collectible', 'chest_key'].every(t => !groupedItems[t]?.length) && (
              <p className="text-sm text-secondary text-center py-8">暫無物品</p>
            )}
          </section>
        )}
      </main>

      <AppBottomNav current="none" />

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && openedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-start justify-center pt-12 pb-24 p-4"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-3xl w-full max-h-[75vh] flex flex-col"
            >
              <h2 className="text-3xl font-black italic text-center text-accent mb-6">
                收藏!
              </h2>

              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 pr-1 scrollbar-thin">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2 mb-6">
                  {[...openedItems]
                    .sort((a, b) => {
                      const order = ['common', 'rare', 'epic', 'legendary', 'mythic', 'oracle'];
                      return order.indexOf(b.item.rarity) - order.indexOf(a.item.rarity);
                    })
                    .map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: index * 0.03, type: 'spring' }}
                      className="bg-card rounded-xl p-2 border-2 text-center relative"
                      style={{ borderColor: RARITY_COLORS[item.item.rarity] || '#494847' }}
                    >
                      {(item.quantity || 0) > 1 && (
                        <span className="absolute -top-2 -right-2 bg-accent text-black text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 shadow-lg z-10">
                          x{item.quantity}
                        </span>
                      )}
                      <div className="text-2xl mb-1">{item.item.icon}</div>
                      <h3 className="font-bold text-xs mb-0.5 truncate">{item.item.name}</h3>
                      <p className="text-xs text-secondary mb-1 truncate">{item.item.description}</p>
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className="text-xs px-1 py-0.5 rounded-full font-bold"
                          style={{
                            backgroundColor: `${RARITY_COLORS[item.item.rarity]}30`,
                            color: RARITY_COLORS[item.item.rarity],
                          }}
                        >
                          {item.item.rarity}
                        </span>
                        {item.isNew && (
                          <span className="text-xs bg-accent text-black px-1 py-0.5 rounded-full font-bold">
                            NEW
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {openCompensation > 0 && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-3 bg-gradient-to-br from-[#fcc025]/20 to-[#e6ad03]/10 border border-accent/40 rounded-2xl px-6 py-4 shadow-lg shadow-[#fcc025]/5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fcc025] to-[#e6ad03] flex items-center justify-center shadow-lg">
                       <span className="text-lg">?</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold uppercase tracking-widest text-secondary">×補?</p>
                      <p className="text-lg font-black italic text-accent">+{nf(openCompensation)} ZXC</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={() => {
                    setOpenQtys({});
                    setShowResult(false);
                  }}
                  className="bg-[#494847] hover:bg-[#5a5858] text-white font-bold px-8 py-3
                    rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  繼?
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Dialog */}
      <AnimatePresence>
        {giftDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setGiftDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl p-6 max-w-sm w-full border border-border/30"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-black">贈?{giftDialog.name}</h2>
                <button onClick={() => setGiftDialog(null)}>
                  <X className="w-5 h-5 text-secondary" />
                </button>
              </div>

              <label className="block text-sm font-bold text-secondary mb-1">?收</label>
              <select
                value={giftAddress}
                onChange={(e) => setGiftAddress(e.target.value)}
                className="w-full bg-surface border border-border/40 rounded-lg px-3 py-2 text-white text-sm
                  focus:outline-none focus:border-accent mb-4"
              >
                <option value="">×?收×..</option>
                {recipients.map(r => (
                  <option key={r.address} value={r.address}>
                    {r.displayName} ({r.address.slice(0, 6)}...{r.address.slice(-4)})
                  </option>
                ))}
              </select>

              <label className="block text-sm font-bold text-secondary mb-1">×</label>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setGiftQty(String(Math.max(1, (parseInt(giftQty || '1', 10) || 1) - 1)))}
                  disabled={(parseInt(giftQty || '1', 10) || 1) <= 1}
                  className="w-8 h-8 rounded-full bg-[#494847]/40 text-accent font-bold text-lg
                    flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed
                    hover:bg-[#494847]/60 transition-colors"
                >
                  ×
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={giftQty}
                  onChange={(e) => setGiftQty(e.target.value)}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!v || v < 1) setGiftQty('1');
                    else if (v > giftDialog.maxQty) setGiftQty(String(giftDialog.maxQty));
                  }}
                  className="w-16 bg-surface border border-border/40 rounded-lg text-white font-bold text-lg text-center
                    focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setGiftQty(String(Math.min(giftDialog.maxQty, (parseInt(giftQty || '1', 10) || 1) + 1)))}
                  disabled={(parseInt(giftQty || '1', 10) || 1) >= giftDialog.maxQty}
                  className="w-8 h-8 rounded-full bg-[#494847]/40 text-accent font-bold text-lg
                    flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed
                    hover:bg-[#494847]/60 transition-colors"
                >
                  +
                </button>
                <span className="text-sm text-secondary">/ {giftDialog.maxQty}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setGiftDialog(null)}
                  className="flex-1 border border-border/40 text-secondary font-bold text-sm py-2 rounded-lg hover:bg-[#494847]/20"
                >
                  ×
                </button>
                <button
                  disabled={giftSending || !giftAddress.trim()}
                  onClick={async () => {
                    if (!giftAddress.trim() || !giftDialog) return;
                    setGiftSending(true);
                    try {
                      const res = await api.post('/api/v1/gift/send', {
                        toAddress: giftAddress.trim(),
                        itemId: giftDialog.itemId,
                        quantity: parseInt(giftQty || '1', 10) || 1,
                      });
                      if (res.data?.success) {
                        showToast('贈送成功');
                        setGiftDialog(null);
                        setGiftAddress('');
                        setGiftQty('1');
                        await refreshInventory();
                      } else {
                        showToast(res.data?.error || '贈送失敗');
                      }
                    } catch (err: any) {
                      showToast(err?.response?.data?.data?.error || err?.response?.data?.error || '贈送失敗');
                    } finally {
                      setGiftSending(false);
                    }
                  }}
                  className="flex-1 bg-accent text-black font-black text-sm py-2 rounded-lg
                    disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e6ad03]"
                >
                  {giftSending ? '贈送中...' : '確認贈送'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}



