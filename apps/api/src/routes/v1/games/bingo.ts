// apps/api/src/routes/v1/games/bingo.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

export async function bingoRoutes(fastify: FastifyInstance) {
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
        numbers: z.array(z.number().min(1).max(75)).min(1).max(8).refine((arr) => new Set(arr).size === arr.length, { message: "numbers must be unique" }),
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
      }),
    },
  }, async (request) => {
    const { betAmount, numbers, token } = request.body as { sessionId: string; betAmount: number; numbers: number[]; token: "zhixi" | "yjc" };

    const ctx = await getContext(request);
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

    const roundId = `bingo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
      // 2. Resolve game
      const luckBias = await gameSettlement.getLuckBias(userId);
      const gameResult = gameManager.resolveBingo(numbers, roundId, luckBias);
      const isWin = gameResult.multiplier > 0;
      const payout = isWin ? betAmount * gameResult.multiplier : 0;
      const payoutStr = payout.toString();

      // 3. Execute on-chain settlement
      const settlement = await gameSettlement.executeSettlement({
        userId,
        address,
        game: "bingo",
        token: token === "yjc" ? "YJC" : "ZXC",
        betAmount: amountStr,
        payoutAmount: payoutStr,
        roundId,
        requestId: request.id,
      });

      if (!settlement.success) {
        await gameSettlement.rollbackBalance(address, token, validation.balanceBefore);
        return createApiEnvelope(
          { success: false },
          request.id,
          false,
          settlement.error?.message || "Settlement failed"
        );
      }

      // 4. Credit payout to balance
      const finalBalance = await gameSettlement.creditPayout(
        address,
        token,
        validation.balanceAfter,
        settlement.finalPayout,
        'bingo',
        userId,
        betAmount
      );

      // 5. Update total bet
      await gameSettlement.updateTotalBet(address, betAmount, undefined, userId);

      // 6. Record game session
      const db = await requireDb();
      const sessionManager = new GameSessionManager(db);
      const session = await sessionManager.recordGame({
        userId,
        address,
        game: "bingo",
        betAmount,
        gameResult: {
          result: settlement.isWin ? "win" : "lose",
          payout: settlement.finalPayout,
          meta: { 
            selectedNumbers: numbers,
            winningNumbers: gameResult.winningNumbers,
            matches: gameResult.matches,
            matchCount: gameResult.matches.length,
            betTxHash: settlement.betTxHash,
            payoutTxHash: settlement.payoutTxHash,
            fee: settlement.feeAmount,
          },
        },
      });

      // 7. Log event
      await gameSettlement.logGameEvent({
        game: "bingo",
        userId,
        address,
        amount: amountStr,
        payout: settlement.finalPayout.toString(),
        fee: settlement.feeAmount.toString(),
        isWin: settlement.isWin,
        multiplier: gameResult.multiplier,
        betTxHash: settlement.betTxHash,
        payoutTxHash: settlement.payoutTxHash,
        roundId,
      });

      // 8. Save round
      await gameSettlement.saveRound("bingo", roundId, gameResult);

      return createApiEnvelope({
        success: true,
        data: {
          sessionId: session.id,
          roundId,
          selectedNumbers: numbers,
          winningNumbers: gameResult.winningNumbers,
          matches: gameResult.matches,
          matchCount: gameResult.matches.length,
          result: settlement.isWin ? "win" : "lose",
          payout: settlement.finalPayout,
          betAmount,
          multiplier: gameResult.multiplier,
          fee: settlement.feeAmount,
          balance: finalBalance,
          betTxHash: settlement.betTxHash,
          payoutTxHash: settlement.payoutTxHash,
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
    const ctx = await getContext(request);
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
    const history = await manager.getHistory(address, "bingo", 20);
    
    return createApiEnvelope({ success: true, data: history }, request.id);
  });
}
