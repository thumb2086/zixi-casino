// apps/api/src/routes/v1/inventory.ts
// Read the user's persisted inventory and activate items.

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope, ITEM_DROP_TABLES, SPECIAL_ITEMS, RARITY_NAMES, type ItemDefinition, type Rarity } from "@repo/shared";
import { SessionRepository, OpsRepository, RewardCatalogRepository, kv } from "@repo/infrastructure";
import { gameSettlement } from "../../utils/game-settlement.js";
import { getSessionContext } from "../../utils/auth.js";
import { loadInventoryState, persistInventoryState, useItem, creditItemValue, grantBundleToUser, useAllTokenItems, rollbackUseAllTokens, type UseAllTokensResult } from "../../utils/inventory.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import * as schema from "@repo/infrastructure/db/schema.js";
import { eq, sql } from "drizzle-orm";

function buildItemIndex(): Record<string, ItemDefinition & { rarity: Rarity }> {
  const out: Record<string, ItemDefinition & { rarity: Rarity }> = {};
  for (const rarity of Object.keys(ITEM_DROP_TABLES) as Rarity[]) {
    for (const item of ITEM_DROP_TABLES[rarity]) {
      out[item.id] = { ...item, rarity };
    }
  }
  for (const item of SPECIAL_ITEMS) {
    out[item.id] = { ...item, rarity: item.rarity as Rarity };
  }
  return out;
}

const ITEM_INDEX = buildItemIndex();

export async function inventoryRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const sessionRepo = new SessionRepository();
  const opsRepo = new OpsRepository();
  const rewardCatalogRepo = new RewardCatalogRepository();

  const getContext = (req: any) => getSessionContext(req, sessionRepo);

  typedFastify.get("/", async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    const state = await loadInventoryState(ctx.userId);

    const items = Object.entries(state.inventory)
      .filter(([itemId, qty]) => qty > 0 && !itemId.startsWith('chest_key_') && !itemId.startsWith('combo_'))
      .map(([itemId, quantity]) => {
        const def = ITEM_INDEX[itemId];
        if (!def) {
          return { id: itemId, name: itemId, type: "unknown", rarity: "common", quantity, icon: "❓" };
        }
        return {
          ...def,
          quantity,
          rarityColor: RARITY_NAMES[def.rarity].color,
          rarityName: RARITY_NAMES[def.rarity].name,
        };
      });

    // Include owned avatars/titles even if not in inventory (already equipped)
    for (const avatarId of state.ownedAvatars) {
      if (!items.find((i) => i.id === avatarId)) {
        const def = ITEM_INDEX[avatarId];
        if (def) {
          items.push({
            ...def,
            quantity: 1,
            rarityColor: RARITY_NAMES[def.rarity].color,
            rarityName: RARITY_NAMES[def.rarity].name,
          });
        }
      }
    }
    for (const titleId of state.ownedTitles) {
      if (!items.find((i) => i.id === titleId)) {
        const def = ITEM_INDEX[titleId];
        if (def) {
          items.push({
            ...def,
            quantity: 1,
            rarityColor: RARITY_NAMES[def.rarity].color,
            rarityName: RARITY_NAMES[def.rarity].name,
          });
        }
      }
    }

    return createApiEnvelope(
      {
        items,
        ownedAvatars: state.ownedAvatars,
        ownedTitles: state.ownedTitles,
        activeAvatar: state.activeAvatar,
        activeTitle: state.activeTitle,
        activeBuffs: state.activeBuffs,
      },
      request.id,
    );
  });

  typedFastify.post(
    "/use",
    {
      schema: {
        body: z.object({
          sessionId: z.string().optional(),
          itemId: z.string(),
          quantity: z.number().int().min(1).max(9999).optional().default(1),
        }),
      },
    },
    async (request: any) => {
      const ctx = await getContext(request);
      if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

      const { itemId, quantity } = request.body as { itemId: string; quantity: number };

      let lastOutcome;
      let totalCurrency = 0;
      let totalBuffs: any[] = [];

      try {
        for (let i = 0; i < quantity; i++) {
          lastOutcome = await useItem(ctx.userId, itemId);
          if (lastOutcome.currencyGranted) totalCurrency += lastOutcome.currencyGranted;
          if (lastOutcome.buffActivated) totalBuffs.push(lastOutcome.buffActivated);
        }
      } catch (error: any) {
        return createApiEnvelope(
          { success: false },
          request.id,
          false,
          error?.message || "USE_ITEM_FAILED",
        );
      }

      if (!lastOutcome) return createApiEnvelope({ success: false }, request.id, false, "USE_ITEM_FAILED");

      // Sync avatar/title active state to KV
      if (lastOutcome.item.type === "avatar" || lastOutcome.item.type === "title") {
        const key = lastOutcome.item.type === "title" ? `active_title:${ctx.address}` : `active_avatar:${ctx.address}`;
        await kv.set(key, lastOutcome.item.id).catch(() => {});
      }

      // Credit total amount
      const creditToken = lastOutcome.currencyType || "zhixi";
      if (totalCurrency > 0) {
        try {
          const curBalance = await gameSettlement.getBalance(ctx.address, creditToken);
          const newBal = (Number(curBalance) + totalCurrency).toFixed(4);
          await gameSettlement.setBalance(ctx.address, creditToken, newBal);
        } catch (err: any) {
          return createApiEnvelope({ success: false }, request.id, false, "CREDIT_FAILED");
        }
      }

      await opsRepo.logEvent({
        channel: "rewards",
        severity: "info",
        source: "inventory",
        kind: "item_used",
        userId: ctx.userId,
        address: ctx.address,
        message: `Used ${quantity}x ${itemId}`,
        meta: { itemId, quantity, totalCurrency, buffsActivated: totalBuffs.length },
      });

      const finalBalance = totalCurrency > 0
        ? await gameSettlement.getBalance(ctx.address, creditToken).catch(() => null)
        : null;

      return createApiEnvelope(
        {
          success: true,
          item: lastOutcome.item,
          effectSummary: lastOutcome.effectSummary,
          currencyGranted: totalCurrency,
          currencyToken: creditToken,
          buffActivated: totalBuffs[0] || null,
          balance: finalBalance,
          activeBuffs: lastOutcome.state.activeBuffs,
          activeAvatar: lastOutcome.state.activeAvatar,
          activeTitle: lastOutcome.state.activeTitle,
          remainingQuantity: lastOutcome.state.inventory[itemId] || 0,
        },
        request.id,
      );
    },
  );

  // ─── Use all token items ──────────────────────────────────────────────────

  typedFastify.post(
    "/use-all-tokens",
    {
      schema: {
        body: z.object({
          sessionId: z.string().optional(),
        }).optional(),
      },
    },
    async (request: any) => {
      try {
        const ctx = await getContext(request);
        if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

        const result = await useAllTokenItems(ctx.userId);

        if (result.totalZxc > 0) {
          const curBal = await gameSettlement.getBalance(ctx.address, "zhixi");
          await gameSettlement.setBalance(ctx.address, "zhixi", (Number(curBal) + result.totalZxc).toString());
        }
        if (result.totalYjc > 0) {
          const curBal = await gameSettlement.getBalance(ctx.address, "yjc");
          await gameSettlement.setBalance(ctx.address, "yjc", (Number(curBal) + result.totalYjc).toString());
        }

        await opsRepo.logEvent({
          channel: "rewards",
          severity: "info",
          source: "inventory",
          kind: "all_tokens_used",
          userId: ctx.userId,
          address: ctx.address,
          message: `Used all token items: ${result.totalZxc} ZXC, ${result.totalYjc} YJC`,
          meta: { totalZxc: result.totalZxc, totalYjc: result.totalYjc, items: result.usedItems },
        });

        return createApiEnvelope(
          {
            success: true,
            totalZxc: result.totalZxc,
            totalYjc: result.totalYjc,
            itemCount: result.usedItems.length,
          },
          request.id,
        );
      } catch (error: any) {
        console.error("[use-all-tokens]", error);
        return createApiEnvelope({ success: false }, request.id, false, error?.message || "USE_ALL_TOKENS_FAILED");
      }
    },
  );

  // ─── Buy item from shop ──────────────────────────────────────────────────

  typedFastify.post(
    "/buy",
    {
      schema: {
        body: z.object({
          sessionId: z.string().optional(),
          itemId: z.string(),
        }),
      },
    },
    async (request: any) => {
      const ctx = await getContext(request);
      if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

      const { itemId } = request.body as { itemId: string };

      const allCatalog = await rewardCatalogRepo.listItems({ includeInactive: false });
      const catalogItem = allCatalog.find(
        (i: any) => i.itemId === itemId && i.source === "shop" && i.isActive !== false,
      );
      if (!catalogItem) {
        return createApiEnvelope({ success: false }, request.id, false, "ITEM_NOT_FOUND");
      }

      const price = Number(catalogItem.price);
      if (!price || price <= 0) {
        return createApiEnvelope({ success: false }, request.id, false, "ITEM_NOT_PURCHASABLE");
      }

      const rawMeta = catalogItem.meta as Record<string, any> | undefined;
      const paymentToken: "zhixi" | "yjc" = rawMeta?.token === "yjc" ? "yjc" : "zhixi";

      const balanceStr = await gameSettlement.getBalance(ctx.address, paymentToken);
      const balance = parseFloat(balanceStr) || 0;
      if (balance < price) {
        return createApiEnvelope({ success: false }, request.id, false, "INSUFFICIENT_BALANCE");
      }

      const subItems = rawMeta?.bundle as Array<{ id: string; qty?: number }> | undefined;
      const isBundle = !!subItems;

      // ── Purchase limit: one per user for bundles / unique items / VIP passes ──
      const state = await loadInventoryState(ctx.userId);
      if (itemId === 'vip_pass') {
        if ((state.activeBuffs || []).some((b: any) => b.id === 'vip_1_permanent')) {
          return createApiEnvelope({ success: false }, request.id, false, "你已擁有 VIP 1 通行證");
        }
      }
      if (itemId === 'vip2_pass') {
        if ((state.activeBuffs || []).some((b: any) => b.id === 'vip_2_permanent')) {
          return createApiEnvelope({ success: false }, request.id, false, "你已擁有 VIP 2 通行證");
        }
      }
      if (isBundle || catalogItem.type === "avatar" || catalogItem.type === "title") {
        if (isBundle) {
          if (state.inventory[itemId] > 0) {
            return createApiEnvelope({ success: false }, request.id, false, "你已購買過此組合包");
          }
        } else if (catalogItem.type === "avatar" && state.ownedAvatars.includes(itemId)) {
          return createApiEnvelope({ success: false }, request.id, false, "你已擁有此頭像");
        } else if (catalogItem.type === "title" && state.ownedTitles.includes(itemId)) {
          return createApiEnvelope({ success: false }, request.id, false, "你已擁有此稱號");
        }
      }

      // Deduct balance for ALL items (including VIP passes)
      await gameSettlement.setBalance(ctx.address, paymentToken, (balance - price).toString());

      // VIP passes: grant permanent buff in user_profiles
      if (itemId === 'vip_pass' || itemId === 'vip2_pass') {
        try {
          const db = await requireDb();
          const tier = itemId === 'vip2_pass' ? 'vip_2_permanent' : 'vip_1_permanent';
          await db.execute(sql`
            UPDATE user_profiles
            SET active_buffs = COALESCE(active_buffs, '[]'::jsonb) || ${JSON.stringify([{
              id: tier,
              label: itemId === 'vip2_pass' ? 'VIP 2 永久' : 'VIP 1 永久',
              source: 'shop',
              acquiredAt: new Date().toISOString(),
            }])}::jsonb,
            updated_at = NOW()
            WHERE user_id = ${ctx.userId} AND address = ${ctx.address.toLowerCase()}
          `);
          await opsRepo.logEvent({
            channel: "rewards",
            severity: "info",
            source: "inventory",
            kind: "vip_pass_purchased",
            userId: ctx.userId,
            address: ctx.address,
            message: `Purchased ${itemId}`,
            meta: { itemId, price, token: paymentToken },
          });
        } catch (err: any) {
          // Non-fatal: purchase still succeeded, buff just not persisted
          console.error("Failed to grant VIP buff:", err.message);
        }
      }

      const isVipPass = itemId === 'vip_pass' || itemId === 'vip2_pass';
      const bundle = subItems
        ? { items: subItems.map((i: any) => ({ id: i.id, qty: i.qty || 1 })) }
        : { items: [{ id: itemId, qty: 1 }] };
      try {
        await grantBundleToUser(ctx.userId, bundle, ctx.address);
        if (isBundle) {
          const state = await loadInventoryState(ctx.userId);
          state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
          await persistInventoryState(ctx.userId, state);
        }
      } catch (err: any) {
        if (!isVipPass) await gameSettlement.setBalance(ctx.address, paymentToken, balanceStr);
        return createApiEnvelope({ success: false }, request.id, false, "GRANT_FAILED");
      }

      await opsRepo.logEvent({
        channel: "rewards",
        severity: "info",
        source: "inventory",
        kind: "item_purchased",
        userId: ctx.userId,
        address: ctx.address,
        message: `Purchased item ${itemId} for ${price} ZXC`,
        meta: { itemId, price },
      });

      return createApiEnvelope(
        { success: true, itemId, name: catalogItem.name, price, token: paymentToken, balanceAfter: isVipPass ? balanceStr : (balance - price).toString() },
        request.id,
      );
    },
  );
}
