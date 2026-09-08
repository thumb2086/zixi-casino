// apps/api/src/routes/v1/games/roulette.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { getRoundInfo } from "@repo/domain/games/auto-round.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

const BetSchema = z.object({
  type: z.enum(["number", "color", "parity", "range", "dozen"]),
  value: z.union([z.number(), z.string()]),
  amount: z.number().optional(),
});

export async function rouletteRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const gameManager = new GameManager();

  typedFastify.post("/play", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        betAmount: z.number().min(1),
        bets: z.array(BetSchema),
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
      }),
    },
  }, async (request) => {
    const { betAmount, bets, token } = request.body as { sessionId: string; betAmount: number; bets: any[]; token: "zhixi" | "yjc" };

    const ctx = (request as any).ctx;
    if (!ctx || !ctx.user) {
      return createApiEnvelope(
        { success: false },
        request.id,
        false,
        "UNAUTHORIZED: Invalid session"
      );
    }

    const address = ctx.session.address;
    const userId = ctx.user.id;
    if (!address) {
      return createApiEnvelope(
        { success: false },
        request.id,
        false,
        "USER_NOT_FOUND: Address not found"
      );
    }

    // Get auto-round info (统�??��?)
    const roundInfo = getRoundInfo('roulette');
    if (!roundInfo.isBettingOpen) {
      return createApiEnvelope(
        { 
          success: false, 
          roundId: roundInfo.roundId,
          closesAt: roundInfo.closesAt,
          bettingClosesAt: roundInfo.bettingClosesAt,
        },
        request.id,
        false,
        "?��?开奖中，请等�?下�?局"
      );
    }

    const roundId = String(roundInfo.roundId);
    const amountStr = betAmount.toString();

    // 1. Validate and deduct balance
    const validation = await gameSettlement.validateAndDeductBalance(
      address,
      token,
      amountStr,
      `total_bet:${address}`
    );

    if (!validation.success) {
      return createApiEnvelope(
        { success: false },
        request.id,
        false,
        validation.error?.message || "Validation failed"
      );
    }

    try {
      // 2. Resolve game using GameManager with luck bias
      const luckBias = await gameSettlement.getLuckBias(userId);
      const gameResult = gameManager.resolveRoulette(bets, `roulette:${roundInfo.roundId}`, luckBias);
      const winningNumber = gameResult.winningNumber;
      const color = gameResult.color;
      const totalPayoutMultiplier = gameResult.totalPayoutMultiplier;
      const isWin = totalPayoutMultiplier > 0;
      const payout = isWin ? betAmount * totalPayoutMultiplier : 0;
      const payoutStr = payout.toString();

      // 3. Credit payout directly (settlement fires in background like coinflip/slots)
      const finalBalance = await gameSettlement.creditPayout(
        address,
        token,
        validation.balanceAfter,
        payout,
        'roulette',
        userId,
        betAmount
      );

      // 4. Background: settlement, XP, session, events
      void (async () => {
        try {
          await gameSettlement.executeSettlement({
            userId, address, game: "roulette",
            token: token === "yjc" ? "YJC" : "ZXC",
            betAmount: amountStr, payoutAmount: payout.toString(),
            roundId, requestId: request.id,
          });
          await gameSettlement.updateTotalBet(address, betAmount, payout > 0 ? payout : undefined, userId, 'roulette');
          const db = await requireDb();
          const sessionManager = new GameSessionManager(db);
          await sessionManager.recordGame({
            userId, address, game: "roulette", betAmount,
            gameResult: {
              result: payout > 0 ? "win" : "lose",
              payout,
              meta: { winningNumber, color, bets, betTxHash: null, payoutTxHash: null, fee: 0, roundId: roundInfo.roundId, closesAt: roundInfo.closesAt },
            },
          });
          await gameSettlement.logGameEvent({
            game: "roulette", userId, address, amount: amountStr, payout: payout.toString(),
            fee: "0", isWin: payout > 0, multiplier: totalPayoutMultiplier,
            betTxHash: undefined, payoutTxHash: undefined, roundId,
          });
          await gameSettlement.saveRound("roulette", roundId, { winningNumber, color, isWin: payout > 0, roundInfo });
        } catch (bgErr) {
          console.error(`[roulette] background processing failed for round ${roundId}:`, bgErr);
        }
      })();

      return createApiEnvelope({
        success: true,
        data: {
          roundId: roundInfo.roundId,
          winningNumber,
          color,
          result: isWin ? "win" : "lose",
          payout,
          betAmount,
          multiplier: totalPayoutMultiplier,
          fee: 0,
          balance: finalBalance,
          closesAt: roundInfo.closesAt,
          bettingClosesAt: roundInfo.bettingClosesAt,
        }
      }, request.id);

    } catch (err: any) {
      await gameSettlement.rollbackBalance(address, token, validation.balanceBefore);
      return createApiEnvelope(
        { success: false },
        request.id,
        false,
        err?.message || "Unexpected error"
      );
    }
  });

  typedFastify.get("/history", {
    schema: { querystring: z.object({ sessionId: z.string() }) },
  }, async (request) => {
    const ctx = (request as any).ctx;
    if (!ctx || !ctx.user) {
      return createApiEnvelope(
        { success: false },
        request.id,
        false,
        "UNAUTHORIZED: Invalid session"
      );
    }

    const address = ctx.session.address;
    if (!address) {
      return createApiEnvelope(
        { success: false },
        request.id,
        false,
        "USER_NOT_FOUND: Address not found"
      );
    }

    const db = await requireDb();
    const manager = new GameSessionManager(db);
    const history = await manager.getHistory(address, "roulette", 20);
    
    return createApiEnvelope({ success: true, data: history }, request.id);
  });
}
