// apps/api/src/routes/v1/games/crash.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

export async function crashRoutes(fastify: FastifyInstance) {
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
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
        roundId: z.string().optional(),
      }),
    },
  }, async (request) => {
    const { betAmount, token, roundId: incomingRoundId } = request.body as {
      sessionId: string;
      betAmount: number;
      token: "zhixi" | "yjc";
      roundId?: string;
    };
    const amountStr = betAmount.toString();

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

    const roundId = incomingRoundId || `crash_${crypto.randomUUID().slice(0, 8)}`;
    const luckBias = await gameSettlement.getLuckBias(userId);

    // Server generates random stop point using deterministic seed — client cannot control timing
    const stopSeed = `${roundId}:stop`;
    let h = 0x811c9dc5;
    for (let i = 0; i < stopSeed.length; i++) { h ^= stopSeed.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    const stopHash = h >>> 0;
    const stopRatio = (stopHash % 1000000) / 1000000;
    const elapsedSeconds = Math.round(stopRatio * 30); // random 0-30s

    const gameResult = gameManager.resolveCrash(elapsedSeconds, roundId, luckBias);
    const isWin = !gameResult.crashed;
    const payout = isWin ? betAmount * gameResult.multiplier : 0;
    const payoutStr = payout.toString();
    const result = isWin ? "win" : "lose";

    // Always settle — server determines outcome
    {
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
        // 2. Execute on-chain settlement
        const settlement = await gameSettlement.executeSettlement({
          userId,
          address,
          game: "crash",
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

        // 3. Credit payout to balance
        const finalBalance = await gameSettlement.creditPayout(
          address,
          token,
          validation.balanceAfter,
          settlement.finalPayout,
          'crash',
          userId,
          betAmount
        );

        // 4. Update total bet
        await gameSettlement.updateTotalBet(address, betAmount, undefined, userId);

        // 5. Record game session
        const db = await requireDb();
        const sessionManager = new GameSessionManager(db);
        const session = await sessionManager.recordGame({
          userId,
          address,
          game: "crash",
          betAmount,
          gameResult: {
            result,
            payout: settlement.finalPayout,
            meta: { 
              multiplier: gameResult.multiplier,
              crashed: gameResult.crashed,
              crashPoint: gameResult.crashPoint,
              elapsedSeconds,
              betTxHash: settlement.betTxHash,
              payoutTxHash: settlement.payoutTxHash,
              fee: settlement.feeAmount,
            },
          },
        });

        // 6. Log event
        await gameSettlement.logGameEvent({
          game: "crash",
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

        // 7. Save round
        await gameSettlement.saveRound("crash", roundId, gameResult);

        return createApiEnvelope({
          success: true,
          data: {
            sessionId: session.id,
            roundId,
            multiplier: gameResult.multiplier,
            crashed: gameResult.crashed,
            crashPoint: gameResult.crashPoint,
            result,
            payout: settlement.finalPayout,
            betAmount,
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
    const history = await manager.getHistory(address, "crash", 20);
    
    return createApiEnvelope({ success: true, data: history }, request.id);
  });
}
