import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SessionRepository, OpsRepository } from "@repo/infrastructure";
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
}
