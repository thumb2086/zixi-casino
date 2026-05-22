// apps/api/src/routes/v1/games/coinflip.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { getRoundInfo } from "@repo/domain/games/auto-round.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

export async function coinflipRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const gameManager = new GameManager();

  // GET /api/v1/games/coinflip/round - Get current round info (no auth needed for clock sync)
  typedFastify.get("/round", async (request) => {
    const roundInfo = getRoundInfo("coinflip");
    return createApiEnvelope({
      success: true,
      data: {
        serverNow: Date.now(),
        ...roundInfo,
      },
    }, request.id);
  });

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
        betAmount: z.number().min(1).max(1_000_000),
        selection: z.enum(["heads", "tails"]).default("heads"),
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
      }),
    },
  }, async (request) => {
    const { betAmount, selection, token } = request.body as { sessionId: string; betAmount: number; selection: "heads" | "tails"; token: "zhixi" | "yjc" };

    const ctx = await getContext(request);
    if (!ctx || !ctx.user) {
      return createApiEnvelope(
        { success: false, error: "UNAUTHORIZED: Invalid session" },
        request.id,
        false
      );
    }

    const address = ctx.session.address;
    const userId = ctx.user.id;
    if (!address) {
      return createApiEnvelope(
        { success: false, error: "USER_NOT_FOUND: Address not found" },
        request.id,
        false
      );
    }

    // Get auto-round info (统一分局)
    const roundInfo = getRoundInfo('coinflip');
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
        { success: false, error: validation.error, roundId: roundInfo.roundId },
        request.id,
        false,
        validation.error?.message || "Validation failed"
      );
    }

    try {
      // 2. Resolve game using GameManager (deterministic FNV hash)
      const result = gameManager.resolveCoinflip(selection, `coinflip:${roundInfo.roundId}`);
      const isWin = result.isWin;
      const payout = isWin ? betAmount * result.multiplier : 0;
      const payoutStr = payout.toString();

      // 3. Execute on-chain settlement
      const settlement = await gameSettlement.executeSettlement({
        userId,
        address,
        game: "coinflip",
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
          { success: false, roundId: roundInfo.roundId },
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
        'coinflip',
        userId
      );

      // 5-8. Background: updateTotalBet (XP/titles), game session, log event, save round
      void (async () => {
        try {
          await gameSettlement.updateTotalBet(address, betAmount, undefined, userId);
          const db = await requireDb();
          const sessionManager = new GameSessionManager(db);
          await sessionManager.recordGame({
            userId,
            address,
            game: "coinflip",
            betAmount,
            gameResult: {
              result: settlement.isWin ? "win" : "lose",
              payout: settlement.finalPayout,
              meta: { 
                winner: result.winner, 
                selection,
                betTxHash: settlement.betTxHash,
                payoutTxHash: settlement.payoutTxHash,
                fee: settlement.feeAmount,
                roundId: roundInfo.roundId,
                closesAt: roundInfo.closesAt,
              },
            },
          });
          await gameSettlement.logGameEvent({
            game: "coinflip",
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
          await gameSettlement.saveRound("coinflip", roundId, {
            winner: result.winner,
            selection,
            isWin,
            roundInfo,
          });
        } catch {}
      })();

      return createApiEnvelope({
        success: true,
        data: {
          sessionId: roundId,
          roundId: roundInfo.roundId,
          selection,
          winner: result.winner,
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
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid session" } },
        request.id
      );
    }

    const address = ctx.session.address;
    if (!address) {
      return createApiEnvelope(
        { success: false, error: { code: "USER_NOT_FOUND", message: "Address not found" } },
        request.id
      );
    }

    const db = await requireDb();
    const manager = new GameSessionManager(db);
    const history = await manager.getHistory(address, "coinflip", 20);
    
    return createApiEnvelope({ success: true, data: history }, request.id);
  });
}
