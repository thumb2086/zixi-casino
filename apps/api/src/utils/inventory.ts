// apps/api/src/utils/inventory.ts
// Inventory & chest helper: persists chest opens, item usage, and active buffs
// to `user_profiles`, and exposes a single point to consume the "prevent_loss"
// buff used by game-settlement.

import {
  ChestManager,
  type ChestOpenResult,
  type UserInventory,
} from "@repo/domain";
import type { ChestType, ItemDefinition } from "@repo/shared";
import {
  CHEST_CONFIGS,
  ITEM_DROP_TABLES,
  SPECIAL_ITEMS,
  DAILY_FREE_CHEST_COOLDOWN_HOURS,
} from "@repo/shared";
import { UserRepository } from "@repo/infrastructure";

const chestManager = new ChestManager();
const userRepo = new UserRepository();

function chestMetaKey(userId: string): string {
  return `chest_meta:${userId}`;
}

export const ALL_ITEMS: Record<string, ItemDefinition> = (() => {
  const out: Record<string, ItemDefinition> = {};
  for (const rarity of Object.keys(ITEM_DROP_TABLES) as (keyof typeof ITEM_DROP_TABLES)[]) {
    for (const item of ITEM_DROP_TABLES[rarity]) {
      out[item.id] = item;
    }
  }
  for (const item of SPECIAL_ITEMS) {
    out[item.id] = item;
  }
  return out;
})();

export interface ActiveBuff {
  id: string;
  type: string;
  value: number;
  remaining?: number;
  expiresAt?: string | null;
  source?: string;
}

export interface ProfileInventoryState {
  inventory: Record<string, number>;
  ownedAvatars: string[];
  ownedTitles: string[];
  activeAvatar: string;
  activeTitle: string;
  activeBuffs: ActiveBuff[];
  chestPity: Record<ChestType, number>;
  lastFreeChestAt: string | null;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}

function coerceRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const num = Number(val);
    if (Number.isFinite(num) && num > 0) out[key] = Math.floor(num);
  }
  return out;
}

function coerceBuffs(value: unknown): ActiveBuff[] {
  if (!Array.isArray(value)) return [];
  const out: ActiveBuff[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const b = entry as Record<string, unknown>;
    const type = typeof b.type === "string" ? b.type : null;
    const id = typeof b.id === "string" ? b.id : type;
    if (!id || !type) continue;
    out.push({
      id,
      type,
      value: Number(b.value ?? 0) || 0,
      remaining: b.remaining === undefined || b.remaining === null ? undefined : Math.max(0, Number(b.remaining) || 0),
      expiresAt: typeof b.expiresAt === "string" ? b.expiresAt : null,
      source: typeof b.source === "string" ? b.source : undefined,
    });
  }
  return out;
}

function coercePity(value: unknown): Record<ChestType, number> {
  const defaults: Record<ChestType, number> = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, chaos: 0, abyss: 0, oracle: 0, primordial: 0, transcendent: 0 };
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const rec = value as Record<string, unknown>;
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as ChestType[]) {
    const n = Number(rec[key]);
    if (Number.isFinite(n) && n >= 0) out[key] = Math.floor(n);
  }
  return out;
}

interface ChestMeta {
  chestPity: Record<ChestType, number>;
  lastFreeChestAt: string | null;
}

async function loadChestMeta(userId: string, profile?: any): Promise<ChestMeta> {
  if (!profile) {
    profile = await userRepo.getUserProfile(userId);
  }
  return {
    chestPity: coercePity((profile as any)?.chestPity),
    lastFreeChestAt: typeof (profile as any)?.lastFreeChestAt === "string"
      ? (profile as any).lastFreeChestAt
      : (profile as any)?.lastFreeChestAt instanceof Date
        ? (profile as any).lastFreeChestAt.toISOString()
        : null,
  };
}

async function saveChestMeta(userId: string, meta: ChestMeta): Promise<void> {
  await userRepo.saveUserProfile(userId, {
    chestPity: meta.chestPity,
    lastFreeChestAt: meta.lastFreeChestAt ? new Date(meta.lastFreeChestAt) : null,
  } as any);
}

// Per-request cache for loadInventoryState (cleared after each response)
const inventoryCache = new Map<string, { state: ProfileInventoryState; ts: number }>();
const INVENTORY_CACHE_TTL = 500; // ms — covers multiple calls within same request

/**
 * Read the user's inventory/meta from the profile row and KV, returning safe
 * defaults when columns are empty or the profile row is missing. Results are
 * cached per userId for INVENTORY_CACHE_TTL ms to avoid redundant DB/KV reads
 * within a single request (4+ calls per game round).
 */
export async function loadInventoryState(userId: string): Promise<ProfileInventoryState> {
  const cached = inventoryCache.get(userId);
  if (cached && Date.now() - cached.ts < INVENTORY_CACHE_TTL) return cached.state;

  const profile = await userRepo.getUserProfile(userId);
  const meta = await loadChestMeta(userId, profile);
  const state = {
    inventory: coerceRecord(profile?.inventory),
    ownedAvatars: coerceStringArray(profile?.ownedAvatars),
    ownedTitles: coerceStringArray(profile?.ownedTitles),
    activeAvatar: typeof profile?.selectedAvatarId === "string" ? profile.selectedAvatarId : "classic_chip",
    activeTitle: typeof profile?.selectedTitleId === "string" ? profile.selectedTitleId : "",
    activeBuffs: coerceBuffs(profile?.activeBuffs),
    chestPity: meta.chestPity,
    lastFreeChestAt: meta.lastFreeChestAt,
  };
  inventoryCache.set(userId, { state, ts: Date.now() });
  return state;
}

export async function persistInventoryState(userId: string, next: ProfileInventoryState): Promise<void> {
  inventoryCache.delete(userId);
  await Promise.all([
    userRepo.saveUserProfile(userId, {
      inventory: next.inventory,
      ownedAvatars: next.ownedAvatars,
      ownedTitles: next.ownedTitles,
      selectedAvatarId: next.activeAvatar,
      selectedTitleId: next.activeTitle || null,
      activeBuffs: next.activeBuffs,
    }),
    saveChestMeta(userId, {
      chestPity: next.chestPity,
      lastFreeChestAt: next.lastFreeChestAt,
    }),
  ]);
}

function toChestManagerInventory(state: ProfileInventoryState): UserInventory {
  return {
    items: { ...state.inventory },
    avatars: [...state.ownedAvatars],
    titles: [...state.ownedTitles],
    activeAvatar: state.activeAvatar,
    activeTitle: state.activeTitle,
    chestPity: { ...state.chestPity },
  };
}

export interface OpenChestOutcome {
  result: ChestOpenResult;
  state: ProfileInventoryState;
  compensationZXC: number;
}

const DUPLICATE_COMPENSATION: Record<string, number> = {
  avatar: 500,
  title: 300,
  collectible: 200,
};

export async function openChestForUser(
  userId: string,
  address: string,
  chestType: ChestType,
  customDropTables?: Record<string, ItemDefinition[]>,
): Promise<OpenChestOutcome> {
  if (!CHEST_CONFIGS[chestType]) throw new Error(`Unknown chest type: ${chestType}`);

  const state = await loadInventoryState(userId);
  const inventory = toChestManagerInventory(state);
  void address; // reserved for future chain-bound seeding
  const result = chestManager.openChest(userId, chestType, inventory, customDropTables);

  const nextPity = { ...state.chestPity };
  const threshold = CHEST_CONFIGS[chestType].pityThreshold;
  nextPity[chestType] = result.pityCount >= threshold ? 0 : result.pityCount;

  const nextState: ProfileInventoryState = {
    ...state,
    inventory: { ...state.inventory },
    ownedAvatars: [...state.ownedAvatars],
    ownedTitles: [...state.ownedTitles],
    chestPity: nextPity,
  };

  let compensationZXC = 0;

  for (const reward of result.items) {
    const itemId = reward.item.id;
    const def = ALL_ITEMS[itemId];

    if (def?.type === "avatar") {
      if (!nextState.ownedAvatars.includes(itemId)) {
        nextState.ownedAvatars.push(itemId);
      } else {
        compensationZXC += DUPLICATE_COMPENSATION.avatar;
      }
      continue;
    }
    if (def?.type === "title") {
      if (!nextState.ownedTitles.includes(itemId)) {
        nextState.ownedTitles.push(itemId);
      } else {
        compensationZXC += DUPLICATE_COMPENSATION.title;
      }
      continue;
    }
    if (def?.type === "collectible") {
      if (!nextState.inventory[itemId]) {
        nextState.inventory[itemId] = 1;
      } else {
        compensationZXC += DUPLICATE_COMPENSATION.collectible;
      }
      continue;
    }
    nextState.inventory[itemId] = (nextState.inventory[itemId] || 0) + 1;
  }

  await persistInventoryState(userId, nextState);
  return { result, state: nextState, compensationZXC };
}

export function isDailyFreeChestReady(lastFreeChestAt: string | null): boolean {
  if (!lastFreeChestAt) return true;
  const last = Date.parse(lastFreeChestAt);
  if (!Number.isFinite(last)) return true;
  const hoursSinceLast = (Date.now() - last) / (1000 * 60 * 60);
  return hoursSinceLast >= DAILY_FREE_CHEST_COOLDOWN_HOURS;
}

export async function markDailyFreeChestClaimed(userId: string): Promise<void> {
  const meta = await loadChestMeta(userId);
  meta.lastFreeChestAt = new Date().toISOString();
  await saveChestMeta(userId, meta);
}

/**
 * Restore the `lastFreeChestAt` cooldown timestamp to a previous value. Used to
 * roll back an early `markDailyFreeChestClaimed` if the actual chest open
 * fails downstream, so the user isn't locked out of today's free chest.
 */
export async function restoreDailyFreeChestMark(
  userId: string,
  previous: string | null
): Promise<void> {
  const meta = await loadChestMeta(userId);
  meta.lastFreeChestAt = previous;
  await saveChestMeta(userId, meta);
}

export interface UseItemOutcome {
  item: ItemDefinition;
  state: ProfileInventoryState;
  /** Pre-use snapshot; pass to `rollbackUseItem` if a downstream step (e.g. crediting ZXC) fails. */
  preUseState: ProfileInventoryState;
  effectSummary: string;
  currencyGranted?: number;
  currencyType?: "zhixi" | "yjc";
  buffActivated?: ActiveBuff;
}

/**
 * Apply an item effect. For token items this increments `pendingCurrencyCredit`
 * so the caller can credit the wallet; for buffs it adds to activeBuffs;
 * for avatar/title it moves the item into the owned list (already there,
 * but kept for safety) and clears inventory count.
 */
export interface UseAllTokensResult {
  totalZxc: number;
  totalYjc: number;
  usedItems: Array<{ itemId: string; quantity: number; value: number; currency: string }>;
  state: ProfileInventoryState;
  preState: ProfileInventoryState;
}

export async function useAllTokenItems(userId: string): Promise<UseAllTokensResult> {
  const state = await loadInventoryState(userId);
  const nextState: ProfileInventoryState = {
    ...state,
    inventory: { ...state.inventory },
    ownedAvatars: [...state.ownedAvatars],
    ownedTitles: [...state.ownedTitles],
    activeBuffs: [...state.activeBuffs],
  };

  const usedItems: UseAllTokensResult["usedItems"] = [];
  let totalZxc = 0;
  let totalYjc = 0;

  for (const [itemId, qty] of Object.entries(state.inventory)) {
    if (qty <= 0) continue;
    const def = ALL_ITEMS[itemId];
    if (!def || def.type !== "token") continue;
    if (def.effect?.type !== "currency" || !def.effect?.value) continue;

    const value = Number(def.effect.value);
    const currency = def.effect?.currency === "yjc" ? "yjc" : "zhixi";

    delete nextState.inventory[itemId];

    usedItems.push({ itemId, quantity: qty, value, currency });
    if (currency === "yjc") totalYjc += value * qty;
    else totalZxc += value * qty;
  }

  await persistInventoryState(userId, nextState);
  return { totalZxc, totalYjc, usedItems, state: nextState, preState: state };
}

export async function rollbackUseAllTokens(userId: string, preState: ProfileInventoryState): Promise<void> {
  await persistInventoryState(userId, preState);
}

export async function useItem(
  userId: string,
  itemId: string
): Promise<UseItemOutcome> {
  const def = ALL_ITEMS[itemId];
  if (!def) throw new Error(`Unknown item: ${itemId}`);

  const state = await loadInventoryState(userId);
  const owned = state.inventory[itemId] || 0;
  const isAvatarOrTitle = def.type === "avatar" || def.type === "title";
  const isAlreadyOwned = isAvatarOrTitle && (
    (def.type === "avatar" && state.ownedAvatars.includes(itemId)) ||
    (def.type === "title" && state.ownedTitles.includes(itemId))
  );
  if (owned <= 0 && !isAlreadyOwned) throw new Error(`Item not in inventory: ${itemId}`);

  const nextState: ProfileInventoryState = {
    ...state,
    inventory: { ...state.inventory },
    ownedAvatars: [...state.ownedAvatars],
    ownedTitles: [...state.ownedTitles],
    activeBuffs: [...state.activeBuffs],
  };

  let effectSummary = `${def.name} 已使用`;
  let currencyGranted: number | undefined;
  let currencyType: 'zhixi' | 'yjc' = 'zhixi';
  let buffActivated: ActiveBuff | undefined;

  if (def.consumable) {
    const nextCount = owned - 1;
    if (nextCount <= 0) delete nextState.inventory[itemId];
    else nextState.inventory[itemId] = nextCount;
  }

  switch (def.type) {
    case "token": {
      const value = Number(def.effect?.value || 0);
      if (value > 0) {
        currencyGranted = value;
        currencyType = def.effect?.currency === "yjc" ? "yjc" : "zhixi";
        const label = currencyType === "yjc" ? "YJC" : "ZXC";
        effectSummary = `已領取 ${value} ${label}`;
      }
      break;
    }
    case "buff": {
      const effectType = def.effect?.type || "buff";
      const remaining = def.effect?.type === "prevent_loss" ? Number(def.effect?.value || 0) : undefined;
      const duration = typeof def.effect?.duration === "number" ? def.effect.duration : null;
      const expiresAt = duration ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() : null;
      buffActivated = {
        id: `${def.id}_${Date.now()}`,
        type: effectType,
        value: Number(def.effect?.value || 0),
        remaining,
        expiresAt,
        source: def.id,
      };
      const isDuplicate = effectType === 'vip_tier' && nextState.activeBuffs.some((b: ActiveBuff) => b.type === 'vip_tier' && b.value === Number(def.effect?.value || 0));
      if (isDuplicate) {
        effectSummary = `${def.name} 已是生效中，無需重複使用`;
      } else {
        nextState.activeBuffs.push(buffActivated);
        effectSummary = duration
          ? `${def.name} 已啟用，將於 ${duration} 小時後失效`
          : remaining !== undefined
          ? `${def.name} 已啟用，剩餘 ${remaining} 次`
          : `${def.name} 已啟用`;
      }
      break;
    }
    case "avatar":
      if (!nextState.ownedAvatars.includes(itemId)) nextState.ownedAvatars.push(itemId);
      nextState.activeAvatar = itemId;
      if (nextState.inventory[itemId]) {
        nextState.inventory[itemId] -= 1;
        if (nextState.inventory[itemId] <= 0) delete nextState.inventory[itemId];
      }
      effectSummary = `已裝備頭像：${def.name}`;
      break;
    case "title":
      if (!nextState.ownedTitles.includes(itemId)) nextState.ownedTitles.push(itemId);
      nextState.activeTitle = itemId;
      if (nextState.inventory[itemId]) {
        nextState.inventory[itemId] -= 1;
        if (nextState.inventory[itemId] <= 0) delete nextState.inventory[itemId];
      }
      effectSummary = `已裝備稱號：${def.name}`;
      break;
    case "collectible":
      effectSummary = `${def.name} 已展示在收藏櫃`;
      break;
  }

  await persistInventoryState(userId, nextState);
  return {
    item: def,
    state: nextState,
    preUseState: state,
    effectSummary,
    currencyGranted,
    currencyType,
    buffActivated,
  };
}

/**
 * Reverse a `useItem` call by re-persisting the pre-use snapshot captured in
 * `UseItemOutcome.preUseState`. Use this in the route handler when a
 * post-useItem step (e.g. crediting the wallet for a token item) fails, so the
 * user does not permanently lose the consumed item.
 */
export async function rollbackUseItem(
  userId: string,
  preUseState: ProfileInventoryState
): Promise<void> {
  await persistInventoryState(userId, preUseState);
}

/**
 * Decrement the user's active `prevent_loss` buff by 1 if present and return
 * whether the buff was consumed. Used by game-settlement to refund losing bets.
 */
export async function consumePreventLossBuff(userId: string): Promise<{
  consumed: boolean;
  remaining: number | null;
}> {
  const state = await loadInventoryState(userId);
  const idx = state.activeBuffs.findIndex(
    (buff) => buff.type === "prevent_loss" && (buff.remaining ?? 0) > 0
  );
  if (idx < 0) return { consumed: false, remaining: null };

  const buff = { ...state.activeBuffs[idx] };
  const nextRemaining = Math.max(0, (buff.remaining ?? 0) - 1);
  const nextBuffs = [...state.activeBuffs];
  if (nextRemaining > 0) {
    nextBuffs[idx] = { ...buff, remaining: nextRemaining };
  } else {
    nextBuffs.splice(idx, 1);
  }

  await persistInventoryState(userId, { ...state, activeBuffs: nextBuffs });
  return { consumed: true, remaining: nextRemaining };
}

/**
 * Reverse the effect of `consumePreventLossBuff`. Used by game-settlement when
 * the on-chain settlement subsequently fails so the user does not lose a
 * paid-for buff charge on a transaction that never completed.
 */
export async function restorePreventLossBuff(userId: string): Promise<void> {
  const state = await loadInventoryState(userId);
  const idx = state.activeBuffs.findIndex((buff) => buff.type === "prevent_loss");
  const nextBuffs = [...state.activeBuffs];
  if (idx < 0) {
    nextBuffs.push({
      id: `buff_prevent_loss_restored_${Date.now()}`,
      type: "prevent_loss",
      value: 1,
      remaining: 1,
      expiresAt: null,
      source: "settlement_rollback",
    });
  } else {
    const current = { ...nextBuffs[idx] };
    current.remaining = (current.remaining ?? 0) + 1;
    nextBuffs[idx] = current;
  }
  await persistInventoryState(userId, { ...state, activeBuffs: nextBuffs });
}

/**
 * Grant a bundle of rewards (items / avatars / titles) to a user's profile.
 * Token adjustments (ZXC/YJC) must be handled by the caller via the wallet layer.
 */
export interface RewardBundle {
  items?: Array<{ id: string; qty?: number }>;
  avatars?: string[];
  titles?: string[];
}

export interface GrantBundleResult {
  /** Post-grant inventory state (same shape as return value from loadInventoryState). */
  nextState: ProfileInventoryState;
  /** Snapshot of inventory state BEFORE the grant — feed into `rollbackGrantBundle` if a later step fails. */
  preState: ProfileInventoryState;
  /** Avatar IDs that were actually newly-added by this grant (ignoring duplicates already owned). */
  addedAvatars: string[];
  /** Title IDs that were actually newly-added by this grant (ignoring duplicates already owned). */
  addedTitles: string[];
}

export async function grantBundleToUser(
  userId: string,
  bundle: RewardBundle,
  address?: string,
): Promise<GrantBundleResult> {
  const preState = await loadInventoryState(userId);
  const nextInventory = { ...preState.inventory };
  const nextAvatars = [...preState.ownedAvatars];
  const nextTitles = [...preState.ownedTitles];

  const addedAvatars: string[] = [];
  const addedTitles: string[] = [];

  for (const it of bundle.items ?? []) {
    const id = String(it?.id || "").trim();
    if (!id) continue;
    // Chest keys: always go into inventory map regardless of ALL_ITEMS
    if (id.startsWith('chest_key_')) {
      const qty = Math.max(1, Math.floor(Number(it?.qty || 1)));
      nextInventory[id] = (nextInventory[id] || 0) + qty;
      continue;
    }
    const def = ALL_ITEMS[id];
    if (def?.type === "avatar") {
      if (!nextAvatars.includes(id)) {
        nextAvatars.push(id);
        addedAvatars.push(id);
      }
    } else if (def?.type === "title") {
      if (!nextTitles.includes(id)) {
        nextTitles.push(id);
        addedTitles.push(id);
      }
    } else {
      const qty = Math.max(1, Math.floor(Number(it?.qty || 1)));
      nextInventory[id] = (nextInventory[id] || 0) + qty;
    }
  }
  for (const avId of bundle.avatars ?? []) {
    const id = String(avId || "").trim();
    if (id && !nextAvatars.includes(id)) {
      nextAvatars.push(id);
      addedAvatars.push(id);
    }
  }
  for (const ttId of bundle.titles ?? []) {
    const id = String(ttId || "").trim();
    if (id && !nextTitles.includes(id)) {
      nextTitles.push(id);
      addedTitles.push(id);
    }
  }

  const nextState: ProfileInventoryState = {
    ...preState,
    inventory: nextInventory,
    ownedAvatars: nextAvatars,
    ownedTitles: nextTitles,
  };
  await persistInventoryState(userId, nextState);

  return { nextState, preState, addedAvatars, addedTitles };
}

/**
 * Undo a `grantBundleToUser` call. Pass the pre-grant state (captured before
 * the grant) and the lists of NEWLY-added avatar/title IDs so we can both
 * restore the DB-side profile inventory AND remove the synced KV entries.
 *
 * This is used by the campaign-claim flow to revert an item/cosmetic grant
 * when a later step (balance credit, logGrant) fails. Without this, retries
 * would double-accumulate item quantities.
 */
export async function rollbackGrantBundle(
  userId: string,
  preState: ProfileInventoryState,
  address?: string,
  addedAvatars?: string[],
  addedTitles?: string[],
): Promise<void> {
  await persistInventoryState(userId, preState);
}

export function listAllItems(): ItemDefinition[] {
  return Object.values(ALL_ITEMS);
}

/**
 * Credit a user's wallet after using a token item. Handles both ZXC and YJC.
 * Call this after `useItem()` succeeds. If crediting fails, the item is
 * automatically rolled back (restored to inventory).
 *
 * Returns the new balance string, or throws if both credit and rollback fail.
 */
export async function creditItemValue(
  userId: string,
  address: string,
  outcome: UseItemOutcome,
  opsRepo: import("@repo/infrastructure").OpsRepository,
): Promise<string | null> {
  if (!outcome.currencyGranted || outcome.currencyGranted <= 0) return null;
  const token = outcome.currencyType || "zhixi";
  const { WalletRepository } = await import("@repo/infrastructure");
  const walletRepo = new WalletRepository();

  try {
    const updated = await walletRepo.adjustBalanceAtomic(address, `+${outcome.currencyGranted}`, token);
    if (updated === null) throw new Error("adjustBalanceAtomic returned null");
    const current = (parseFloat(updated) - outcome.currencyGranted).toFixed(4);
    // Record in wallet ledger so it appears in transaction history
    await walletRepo.saveLedgerEntry({
      id: crypto.randomUUID(),
      userId,
      address: address.toLowerCase(),
      token,
      type: "item_use",
      amount: String(outcome.currencyGranted),
      balanceBefore: current,
      balanceAfter: updated,
      meta: { itemId: outcome.item.id, itemName: outcome.item.name },
      createdAt: new Date(),
    }).catch(() => {});
    return updated;
  } catch (err: any) {
    // Credit failed — restore the pre-use inventory snapshot
    try {
      await rollbackUseItem(userId, outcome.preUseState);
    } catch (rollbackErr: any) {
      await opsRepo.logEvent({
        channel: "rewards",
        severity: "error",
        source: "inventory",
        kind: "item_use_rollback_failed",
        userId,
        address,
        message: `Failed to restore item ${outcome.item.id} after credit failure: ${rollbackErr?.message || "unknown"}`,
        meta: { itemId: outcome.item.id, creditError: err?.message || String(err) },
      });
    }
    // Always report the original credit error
    await opsRepo.logEvent({
      channel: "rewards",
      severity: "error",
      source: "inventory",
      kind: "item_use_credit_failed",
      userId,
      address,
      message: `Credit for item ${outcome.item.id} failed; inventory restored`,
      meta: {
        itemId: outcome.item.id,
        amount: outcome.currencyGranted,
        token,
        error: err?.message || String(err),
      },
    });
    throw err;
  }
}
