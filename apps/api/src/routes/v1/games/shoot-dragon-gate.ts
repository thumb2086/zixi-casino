import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { gameSettlement } from "../../../utils/game-settlement.js";
import { playShootDragonGateRound, type DragonGateCard } from "./shoot-dragon-gate-shared.js";

const CARD_VALUES: Record<DragonGateCard, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
  "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};

type PendingGate = {
  userId: string;
  left: DragonGateCard;
  right: DragonGateCard;
  openedAt: number;
};

const GATE_TTL_MS = 2 * 60 * 1000;
const pendingGates = new Map<string, PendingGate>();
const gameManager = new GameManager();

function cleanupExpiredGates(now = Date.now()) {
  for (const [gateId, gate] of pendingGates.entries()) {
    if (now - gate.openedAt > GATE_TTL_MS) pendingGates.delete(gateId);
  }
}

function clearUserPendingGates(userId: string) {
  for (const [gateId, gate] of pendingGates.entries()) {
    if (gate.userId === userId) pendingGates.delete(gateId);
  }
}

export async function shootDragonGateRoutes(fastify: FastifyInstance) {
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

  typedFastify.post("/open", {
    schema: {
      body: z.object({ sessionId: z.string() }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx || !ctx.user) {
      return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED: Invalid session");
    }

    cleanupExpiredGates();
    const gateId = `gate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const luckBias = await gameSettlement.getLuckBias(ctx.user.id);
    const gateResult = gameManager.resolveDragonTiger('gate', {}, gateId, luckBias);
    const left = gateResult.gate.left.rank as DragonGateCard;
    const right = gateResult.gate.right.rank as DragonGateCard;
    const lo = Math.min(CARD_VALUES[left], CARD_VALUES[right]);
    const hi = Math.max(CARD_VALUES[left], CARD_VALUES[right]);
    const multiplier = gateResult.multiplier;

    clearUserPendingGates(ctx.user.id);
    pendingGates.set(gateId, { userId: ctx.user.id, left, right, openedAt: Date.now() });

    return createApiEnvelope({
      success: true,
      data: { gateId, left, right, lo, hi, multiplier, expiresAt: Date.now() + GATE_TTL_MS },
    }, request.id);
  });

  typedFastify.post("/play", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        betAmount: z.number().min(1),
        gateId: z.string().min(1),
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
      }),
    },
  }, async (request) => {
    const { betAmount, token, gateId } = request.body as {
      sessionId: string; betAmount: number; gateId: string; token: "zhixi" | "yjc";
    };

    const ctx = await getContext(request);
    if (!ctx || !ctx.user) {
      return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED: Invalid session");
    }

    const address = ctx.session.address;
    const userId = ctx.user.id;
    if (!address) {
      return createApiEnvelope({ success: false }, request.id, false, "USER_NOT_FOUND: Address not found");
    }

    cleanupExpiredGates();
    const pendingGate = pendingGates.get(gateId);
    if (!pendingGate || pendingGate.userId !== userId) {
      return createApiEnvelope({ success: false }, request.id, false, "GATE_INVALID: Please open a new gate.");
    }
    const openCards = { left: pendingGate.left, right: pendingGate.right };
    pendingGates.delete(gateId);

    const luckBias = await gameSettlement.getLuckBias(userId);

    try {
      const result = await playShootDragonGateRound({
        userId, address, betAmount, token, requestId: request.id, openCards, seed: gateId, bias: luckBias,
      });

      if (!result.ok) {
        return createApiEnvelope({ success: false }, request.id, false, result.error);
      }

      return createApiEnvelope({ success: true, data: result.data }, request.id);
    } catch (err: any) {
      return createApiEnvelope({ success: false }, request.id, false, err?.message || "Unexpected error");
    }
  });

  typedFastify.get("/history", {
    schema: { querystring: z.object({ sessionId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx || !ctx.user) {
      return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED: Invalid session");
    }
    const address = ctx.session.address;
    if (!address) {
      return createApiEnvelope({ success: false }, request.id, false, "USER_NOT_FOUND: Address not found");
    }
    const db = await requireDb();
    const manager = new GameSessionManager(db);
    const history = await manager.getHistory(address, "shoot_dragon_gate", 20);
    return createApiEnvelope({ success: true, data: history }, request.id);
  });
}
