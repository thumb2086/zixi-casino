import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { gameSettlement } from "../../../utils/game-settlement.js";
import { requestTokenToSymbol, type RequestTokenKey } from "@repo/domain";

const gameManager = new GameManager();

export async function dragonTigerRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();

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
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
      }),
    },
  }, async (request) => {
    const { betAmount, token } = request.body as { sessionId: string; betAmount: number; token: RequestTokenKey };
    const roundId = `dt_${crypto.randomUUID().slice(0, 8)}`;

    const ctx = await getContext(request);
    if (!ctx || !ctx.user) {
      return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED: Invalid session");
    }

    const address = ctx.session.address;
    const userId = ctx.user.id;
    if (!address) {
      return createApiEnvelope({ success: false }, request.id, false, "USER_NOT_FOUND: Address not found");
    }

    const amountStr = betAmount.toString();

    // 1. Validate & deduct balance
    const validation = await gameSettlement.validateAndDeductBalance(address, token, amountStr, `total_bet:${address}`);
    if (!validation.success) {
      return createApiEnvelope({ success: false }, request.id, false, validation.error?.message || "Insufficient balance");
    }

    try {
      // 2. Resolve game
      const luckBias = await gameSettlement.getLuckBias(userId);
      const result = gameManager.resolveDragonTigerSingle(roundId, luckBias);
      const payout = result.result === 'win' ? betAmount * result.payoutMultiplier : result.result === 'draw' ? betAmount : 0;

      // 3. Credit payout immediately
      const finalBalance = await gameSettlement.creditPayout(address, token, validation.balanceAfter, payout, 'dragon_tiger', userId, betAmount);

      // 4. Background: settlement, tracking, recording
      gameSettlement.executeSettlement({
        userId, address, game: "dragon_tiger",
        token: requestTokenToSymbol(token),
        betAmount: amountStr, payoutAmount: payout.toString(), roundId, requestId: request.id,
      }).catch(() => {});
      gameSettlement.updateTotalBet(address, betAmount, payout, userId, 'dragon_tiger').catch(() => {});
      gameSettlement.logGameEvent({
        game: "dragon_tiger", userId, address, amount: amountStr,
        payout: payout.toString(), fee: "0", isWin: result.isWin,
        multiplier: result.payoutMultiplier, roundId,
      }).catch(() => {});
      gameSettlement.saveRound("dragon_tiger", roundId, result).catch(() => {});

      const db = await requireDb();
      const sessionManager = new GameSessionManager(db);
      sessionManager.recordGame({
        userId, address, game: "dragon_tiger", betAmount,
        gameResult: { result: result.result, payout, meta: { left: result.left.rank, right: result.right.rank, mid: result.mid.rank, lo: result.lo, hi: result.hi, multiplier: result.payoutMultiplier } },
      }).catch(() => {});

      return createApiEnvelope({
        success: true,
        data: {
          roundId,
          left: result.left, right: result.right, mid: result.mid,
          lo: result.lo, hi: result.hi, range: result.range,
          multiplier: result.payoutMultiplier,
          result: result.result, isWin: result.isWin,
          payout, betAmount, balance: finalBalance,
        },
      }, request.id);

    } catch (err: any) {
      await gameSettlement.rollbackBalance(address, token, validation.balanceBefore);
      return createApiEnvelope({ success: false }, request.id, false, err?.message || "Unexpected error");
    }
  });
}
