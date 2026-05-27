// apps/api/src/routes/v1/games/coinflip.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

export async function coinflipRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const gameManager = new GameManager();

  const getContext = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) return null;
    const db = await requireDb();
    const session = await db.query.sessions.findFirst({
      where: (sessions: any, { eq }: any) => eq(sessions.id, sessionId)
    });
    if (!session || session.status !== "authorized") return null;
    const user = await db.query.users.findFirst({
      where: (users: any, { eq }: any) => eq(users.id, session.userId)
    });
    return { session, user };
  };

  typedFastify.post("/play", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        betAmount: z.number().min(1),
        selection: z.enum(["heads", "tails"]).default("heads"),
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
      }),
    },
  }, async (request) => {
    const { betAmount, selection, token } = request.body as { sessionId: string; betAmount: number; selection: "heads" | "tails"; token: "zhixi" | "yjc" };
    const ctx = await getContext(request);
    if (!ctx || !ctx.user) {
      return createApiEnvelope({ success: false, error: "UNAUTHORIZED" }, request.id, false);
    }
    const address = ctx.session.address;
    const userId = ctx.user.id;
    if (!address) {
      return createApiEnvelope({ success: false, error: "ADDRESS_NOT_FOUND" }, request.id, false);
    }

    const roundId = `coinflip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const amountStr = betAmount.toString();

    // 1. Validate and deduct balance
    const validation = await gameSettlement.validateAndDeductBalance(address, token, amountStr, `total_bet:${address}`);
    if (!validation.success) {
      return createApiEnvelope({ success: false, error: validation.error }, request.id, false, validation.error?.message || "Validation failed");
    }

    try {
      // 2. Resolve game
      const luckBias = await gameSettlement.getLuckBias(userId);
      const result = gameManager.resolveCoinflip(selection, `coinflip:${roundId}`, luckBias);
      const isWin = result.winner === selection;
      const payout = isWin ? betAmount * 1.96 : 0;
      const fee = isWin ? Math.min(payout * 0.01, payout * 0.1) : 0; // simplified fee
      const netPayout = Math.max(0, payout - fee);

      // 3. Credit payout directly (no executeSettlement, same as slots)
      const finalBalance = await gameSettlement.creditPayout(address, token, validation.balanceAfter, netPayout, 'coinflip', userId, betAmount);

      // 4. Background: XP, session, events
      void (async () => {
        try {
          await gameSettlement.updateTotalBet(address, betAmount, netPayout > 0 ? netPayout : undefined, userId, 'coinflip');
          if (isWin && netPayout > 0) {
            await gameSettlement.updateTotalWin(address, netPayout);
          }
          const db = await requireDb();
          const sessionManager = new GameSessionManager(db);
          await sessionManager.recordGame({
            userId, address, game: "coinflip",
            betAmount, gameResult: { result: isWin ? "win" : "lose", payout: netPayout, meta: { winner: result.winner, selection, betTxHash: null, payoutTxHash: null, fee, roundId } },
          });
          await gameSettlement.logGameEvent({
            game: "coinflip", userId, address, amount: amountStr, payout: netPayout.toString(), fee: fee.toString(),
            isWin, multiplier: isWin ? 1.96 : 0, betTxHash: undefined, payoutTxHash: undefined, roundId,
          });
          await gameSettlement.saveRound("coinflip", roundId, { winner: result.winner, selection, isWin });
        } catch {}
      })();

      return createApiEnvelope({
        roundId, selection, winner: result.winner,
        result: isWin ? "win" : "lose",
        payout: netPayout, betAmount, multiplier: isWin ? 1.96 : 0,
        fee, balance: finalBalance,
      }, request.id);

    } catch (error: any) {
      await gameSettlement.rollbackBalance(address, token, validation.balanceBefore);
      return createApiEnvelope({ success: false }, request.id, false, error?.message || "Unexpected error");
    }
  });
}
