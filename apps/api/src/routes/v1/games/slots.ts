// apps/api/src/routes/v1/games/slots.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

const SYMBOLS = ["??", "??", "??", "??", "??", "??", "7️⃣"];

export async function slotsRoutes(fastify: FastifyInstance) {
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
      }),
    },
  }, async (request) => {
    const { betAmount, token } = request.body as { sessionId: string; betAmount: number; token: "zhixi" | "yjc" };
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

    const roundId = `slots_${crypto.randomUUID().slice(0, 8)}`;

    // 1. Validate and deduct balance (synchronous, required)
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

    // 2. Resolve game (in-memory, fast)
    const luckBias = await gameSettlement.getLuckBias(userId);
    const gameResult = gameManager.resolveSlots(betAmount, roundId, luckBias);
    const isWin = gameResult.multiplier > 0;
    const payout = isWin ? betAmount * gameResult.multiplier : 0;

    // 3. Credit payout to balance (synchronous, required)
    const finalBalance = await gameSettlement.creditPayout(
      address,
      token,
      validation.balanceAfter,
      payout,
      'slots',
      userId,
      betAmount
    );

    // Respond immediately ??remaining work fires in background
    const responsePayload = {
      success: true,
      data: {
        symbols: gameResult.symbols,
        result: isWin ? "win" : "lose",
        payout,
        betAmount,
        multiplier: gameResult.multiplier,
        winLines: gameResult.winLines,
        balance: finalBalance,
      }
    };

    // 4-8. Background: executeSettlement, updateTotalBet, recordGame, logEvent, saveRound
    void (async () => {
      try {
        const settlement = await gameSettlement.executeSettlement({
          userId,
          address,
          game: "slots",
          token: token === "yjc" ? "YJC" : "ZXC",
          betAmount: amountStr,
          payoutAmount: payout.toString(),
          roundId,
          requestId: request.id,
        });

        if (!settlement.success) {
          console.error(`[slots] settlement failed for round ${roundId}:`, settlement.error);
          return;
        }

        await gameSettlement.updateTotalBet(address, betAmount, payout, userId);

        const db = await requireDb();
        const sessionManager = new GameSessionManager(db);
        await sessionManager.recordGame({
          userId,
          address,
          game: "slots",
          betAmount,
          gameResult: {
            result: settlement.isWin ? "win" : "lose",
            payout: settlement.finalPayout,
            meta: { 
              symbols: gameResult.symbols, 
              multiplier: gameResult.multiplier,
              betTxHash: settlement.betTxHash,
              payoutTxHash: settlement.payoutTxHash,
              fee: settlement.feeAmount,
            },
          },
        });

        await gameSettlement.logGameEvent({
          game: "slots",
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

        await gameSettlement.saveRound("slots", roundId, gameResult);
      } catch (bgErr) {
        console.error(`[slots] background processing failed for round ${roundId}:`, bgErr);
      }
    })();

    return createApiEnvelope(responsePayload, request.id);
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
    const history = await manager.getHistory(address, "slots", 20);
    
    return createApiEnvelope({ success: true, data: history }, request.id);
  });
}
