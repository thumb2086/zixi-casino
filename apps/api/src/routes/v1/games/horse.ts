// apps/api/src/routes/v1/games/horse.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { GameManager, HORSES } from "@repo/domain/games/game-manager.js";
import { getRoundInfo } from "@repo/domain/games/auto-round.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

export async function horseRoutes(fastify: FastifyInstance) {
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

  typedFastify.get("/horses", async (request) => {
    return createApiEnvelope(HORSES, request.id);
  });

  typedFastify.get("/round", async (request) => {
    const roundInfo = getRoundInfo('horse');
    return createApiEnvelope({
      success: true,
      data: {
        roundId: roundInfo.roundId,
        closesAt: roundInfo.closesAt,
        bettingClosesAt: roundInfo.bettingClosesAt,
        isBettingOpen: roundInfo.isBettingOpen,
        msLeft: roundInfo.msLeft,
        serverNow: Date.now(),
      }
    }, request.id);
  });

  typedFastify.post("/play", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        betAmount: z.number().min(1).max(1_000_000),
        horseId: z.number().min(1).max(6),
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
      }),
    },
  }, async (request) => {
    const { betAmount, horseId, token } = request.body as { sessionId: string; betAmount: number; horseId: number; token: "zhixi" | "yjc" };

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

    // Get auto-round info (统一分局)
    const roundInfo = getRoundInfo('horse');
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
        "本局开奖中，请等待下一局"
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
      // 2. Resolve game using GameManager deterministic horse race (with luck bias)
      const luckBias = await gameSettlement.getLuckBias(userId);
      const result = gameManager.resolveHorseRace(horseId, `horse:${roundInfo.roundId}`, luckBias);
      const isWin = result.isWin;
      const payout = isWin ? betAmount * result.multiplier : 0;
      const payoutStr = payout.toString();

      // 3. Execute on-chain settlement
      const settlement = await gameSettlement.executeSettlement({
        userId,
        address,
        game: "horse",
        token: token === "yjc" ? "YJC" : "ZXC",
        betAmount: amountStr,
        payoutAmount: payoutStr,
        roundId,
        requestId: request.id,
      });

      if (!settlement.success) {
        // Rollback balance on settlement error
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
        'horse',
        userId,
        betAmount
      );

      // 5. Update total bet
      await gameSettlement.updateTotalBet(address, betAmount, payout > 0 ? payout : undefined, userId);

      // 6. Record game session
      const db = await requireDb();
      const sessionManager = new GameSessionManager(db);
      const session = await sessionManager.recordGame({
        userId,
        address,
        game: "horse",
        betAmount,
        gameResult: {
          result: settlement.isWin ? "win" : "lose",
          payout: settlement.finalPayout,
          meta: { 
            selectedHorse: horseId,
            winnerId: result.winnerId,
            winnerName: result.winnerName,
            betTxHash: settlement.betTxHash,
            payoutTxHash: settlement.payoutTxHash,
            fee: settlement.feeAmount,
            roundId: roundInfo.roundId,
            closesAt: roundInfo.closesAt,
          },
        },
      });

      // 7. Log event
      await gameSettlement.logGameEvent({
        game: "horse",
        userId,
        address,
        amount: amountStr,
        payout: settlement.finalPayout.toString(),
        fee: settlement.feeAmount.toString(),
        isWin: settlement.isWin,
        multiplier: result.multiplier,
        betTxHash: settlement.betTxHash,
        payoutTxHash: settlement.payoutTxHash,
        roundId,
      });

      // 8. Save round
      await gameSettlement.saveRound("horse", roundId, {
        selectedHorse: horseId,
        winnerId: result.winnerId,
        winnerName: result.winnerName,
        isWin,
        roundInfo,
      });

      return createApiEnvelope({
        success: true,
        data: {
          sessionId: session.id,
          roundId: roundInfo.roundId,
          selectedHorse: horseId,
          winnerId: result.winnerId,
          winnerName: result.winnerName,
          result: settlement.isWin ? "win" : "lose",
          payout: settlement.finalPayout,
          betAmount,
          multiplier: result.multiplier,
          fee: settlement.feeAmount,
          balance: finalBalance,
          betTxHash: settlement.betTxHash,
          payoutTxHash: settlement.payoutTxHash,
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
    const history = await manager.getHistory(address, "horse", 20);
    
    return createApiEnvelope({ success: true, data: history }, request.id);
  });
}
