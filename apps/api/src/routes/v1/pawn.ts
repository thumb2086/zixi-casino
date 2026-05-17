import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { MarketManager } from "@repo/domain";
import { SessionRepository, OpsRepository, MarketRepository } from "@repo/infrastructure";
import { gameSettlement } from "../../utils/game-settlement.js";
import { getSessionContext } from "../../utils/auth.js";
import { loadInventoryState, persistInventoryState, ALL_ITEMS } from "../../utils/inventory.js";

const PAWN_PRICES: Record<string, number> = {
  common: 10,
  rare: 50,
  epic: 250,
  legendary: 1000,
  mythic: 5000,
};

export async function pawnRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const sessionRepo = new SessionRepository();
  const opsRepo = new OpsRepository();
  const marketRepo = new MarketRepository();
  const marketManager = new MarketManager();

  const getContext = (req: any) => getSessionContext(req, sessionRepo);

  typedFastify.post(
    "/sell",
    {
      schema: {
        body: z.object({
          sessionId: z.string().optional(),
          itemId: z.string(),
          quantity: z.number().int().min(1).optional().default(1),
        }),
      },
    },
    async (request: any) => {
      const ctx = await getContext(request);
      if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

      const { itemId, quantity } = request.body as { itemId: string; quantity: number };

      const state = await loadInventoryState(ctx.userId);
      const owned = state.inventory[itemId] || 0;
      if (owned < quantity) {
        return createApiEnvelope({ success: false }, request.id, false, "道具數量不足");
      }

      const def = ALL_ITEMS[itemId];
      if (!def) {
        return createApiEnvelope({ success: false }, request.id, false, "未知道具");
      }

      if (def.type === "avatar" || def.type === "title") {
        return createApiEnvelope({ success: false }, request.id, false, "頭像與稱號無法典當");
      }

      const pricePerUnit = PAWN_PRICES[def.rarity] || 5;
      const totalPayout = pricePerUnit * quantity;

      const nextState = { ...state, inventory: { ...state.inventory } };
      nextState.inventory[itemId] = owned - quantity;
      if (nextState.inventory[itemId] <= 0) delete nextState.inventory[itemId];
      await persistInventoryState(ctx.userId, nextState);

      const currentBal = parseFloat(await gameSettlement.getBalance(ctx.address, "zhixi")) || 0;
      const newBal = (currentBal + totalPayout).toString();
      await gameSettlement.setBalance(ctx.address, "zhixi", newBal);

      await opsRepo.logEvent({
        channel: "rewards",
        severity: "info",
        source: "pawn",
        kind: "item_pawned",
        userId: ctx.userId,
        address: ctx.address,
        message: `Pawned ${quantity}x ${itemId} for ${totalPayout} ZXC`,
        meta: { itemId, quantity, payout: totalPayout, rarity: def.rarity },
      });

      return createApiEnvelope(
        {
          success: true,
          itemId,
          quantity,
          payout: totalPayout,
          balanceAfter: newBal,
          remainingQuantity: nextState.inventory[itemId] || 0,
        },
        request.id,
      );
    },
  );

  typedFastify.post(
    "/price",
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
      const def = ALL_ITEMS[itemId];
      if (!def) {
        return createApiEnvelope({ success: false }, request.id, false, "未知道具");
      }

      const pricePerUnit = PAWN_PRICES[def.rarity] || 5;
      return createApiEnvelope({ itemId, rarity: def.rarity, pricePerUnit }, request.id);
    },
  );

  // ── Stock Pawn: sell stocks at discount ─────────────────────────────────

  typedFastify.post("/stock-sell", {
    schema: {
      body: z.object({
        sessionId: z.string().optional(),
        symbol: z.string(),
        quantity: z.number().int().min(1).optional().default(1),
      }),
    },
  }, async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    const { symbol, quantity } = request.body as { symbol: string; quantity: number };
    const address = ctx.address.toLowerCase();

    const account = await marketRepo.getAccount(address);
    if (!account) {
      return createApiEnvelope({ success: false }, request.id, false, "尚無股票帳戶");
    }

    const holding = account.stockHoldings?.[symbol];
    if (!holding || holding.qty < quantity) {
      return createApiEnvelope({ success: false }, request.id, false, `持股不足，目前 ${holding?.qty || 0} 股`);
    }

    const market = marketManager.buildSnapshot();
    const snapshot = market.symbols[symbol];
    if (!snapshot) {
      return createApiEnvelope({ success: false }, request.id, false, "查無此股票");
    }

    const currentPrice = Number(snapshot.price) || 0;
    const discountRate = 0.7; // 70% of market value
    const payoutPerUnit = Math.round(currentPrice * discountRate);
    const totalPayout = payoutPerUnit * quantity;

    // Deduct stocks
    const remainingQty = holding.qty - quantity;
    if (remainingQty <= 0) {
      delete account.stockHoldings[symbol];
    } else {
      account.stockHoldings[symbol] = { qty: remainingQty, avgPrice: holding.avgPrice };
    }

    // No need to recalculate - just save and credit
    const now = new Date().toISOString();
    account.updatedAt = now;
    await marketRepo.saveAccount(address, ctx.userId, account);

    const currentBal = parseFloat(await gameSettlement.getBalance(ctx.address, "zhixi")) || 0;
    const newBal = (currentBal + totalPayout).toString();
    await gameSettlement.setBalance(ctx.address, "zhixi", newBal);

    await opsRepo.logEvent({
      channel: "market",
      severity: "info",
      source: "pawn",
      kind: "stock_pawned",
      userId: ctx.userId,
      address: ctx.address,
      message: `Pawned ${quantity} shares of ${symbol} for ${totalPayout} ZXC (70% of market)`,
      meta: { symbol, quantity, payout: totalPayout, marketPrice: currentPrice },
    });

    return createApiEnvelope({
      success: true,
      symbol,
      quantity,
      payout: totalPayout,
      marketPrice: currentPrice,
      payoutPerUnit,
      balanceAfter: newBal,
      remainingShares: account.stockHoldings?.[symbol]?.qty || 0,
    }, request.id);
  });

  typedFastify.post("/stock-info", {
    schema: {
      body: z.object({
        sessionId: z.string().optional(),
        symbol: z.string(),
      }),
    },
  }, async (request: any) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED");

    const { symbol } = request.body as { symbol: string };
    const market = marketManager.buildSnapshot();
    const snapshot = market.symbols[symbol];
    if (!snapshot) {
      return createApiEnvelope({ success: false }, request.id, false, "查無此股票");
    }

    const discountRate = 0.7;
    const marketPrice = Number(snapshot.price) || 0;
    const payoutPerUnit = Math.round(marketPrice * discountRate);

    return createApiEnvelope({
      symbol,
      marketPrice,
      payoutPerUnit,
      change24h: snapshot.changePct,
    }, request.id);
  });
}
