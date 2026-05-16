// apps/api/src/routes/v1/games.ts

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { RoomManager, VipManager } from "@repo/domain";
import { SessionRepository, UserRepository } from "@repo/infrastructure";
import { playShootDragonGateRound } from "./games/shoot-dragon-gate-shared.js";

export async function gameRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  
  const sessionRepo = new SessionRepository();
  const userRepo = new UserRepository();
  const roomManager = new RoomManager();

  const getContext = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) return null;
    const session = await sessionRepo.getSessionById(sessionId as string);
    if (!session || session.status !== "authorized") return null;
    const user = await userRepo.getUserById(session.userId);
    return { session, user };
  };

  // ─── Play Game (Bet & Settle) ─────────────────────────────────────────────

  typedFastify.post("/:game/play", {
    schema: {
      params: z.object({ game: z.string() }),
      body: z.object({
        sessionId: z.string(),
        amount: z.string(),
        token: z.enum(["zhixi", "yjc"]).optional().default("zhixi"),
        action: z.any().optional(),
      }),
    },
  }, async (request) => {
    const { game } = request.params;
    const { amount, token, action } = request.body;
    const amountNum = parseFloat(amount);

    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED", message: "Invalid session" } }, request.id);

    const address = ctx.session.address;
    const userId = ctx.user.id;

    if (game !== "dragon") {
      return createApiEnvelope(
        { code: "DEPRECATED_ROUTE", message: `Use /api/v1/games/${game}/play` },
        request.id,
        false,
        "DEPRECATED_ROUTE"
      );
    }

    try {
      const result = await playShootDragonGateRound({
        userId,
        address,
        betAmount: amountNum,
        token,
        requestId: request.id,
      });

      if (!result.ok) {
        return createApiEnvelope({ code: "SETTLEMENT_ERROR", message: result.error }, request.id, false, result.error);
      }

      return createApiEnvelope(result.data, request.id);
    } catch (error: any) {
      return createApiEnvelope(
        { code: "SETTLEMENT_ERROR", message: error?.message || "Dragon settlement failed" },
        request.id,
        false,
        error?.message || "Dragon settlement failed"
      );
    }
  });

  // ─── Room Management ──────────────────────────────────────────────────────


  typedFastify.post("/rooms/join", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        roomId: z.string(),
      }),
    },
  }, async (request) => {
    const { roomId } = request.body as { sessionId: string; roomId: string };
    const ctx = await getContext(request);
    if (!ctx || !ctx.user || !ctx.session?.address) {
      return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED: Invalid session");
    }

    const vipManager = new VipManager();
    const tier = await vipManager.getYjcVipTierByAddress(ctx.session.address);
    const vipLevel = tier.key === "vip2" ? 2 : tier.key === "vip1" ? 1 : 0;

    try {
      const room = await roomManager.joinRoom(roomId, {
        userId: ctx.user.id,
        displayName: ctx.user.username || ctx.user.displayName || `玩家${ctx.user.id.slice(0, 4)}`,
        avatar: "🧑",
        vipLevel,
      });

      // 補位機器人：若房間人數偏低，補到 70%
      await roomManager.fillWithBots(roomId);
      const hydrated = (await roomManager.getRooms()).find((r) => r.id === roomId) || room;

      return createApiEnvelope({ success: true, room: hydrated }, request.id);
    } catch (error: any) {
      return createApiEnvelope({ success: false }, request.id, false, error?.message || "JOIN_ROOM_FAILED");
    }
  });

  typedFastify.post("/rooms/leave", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        roomId: z.string(),
      }),
    },
  }, async (request) => {
    const { roomId } = request.body as { sessionId: string; roomId: string };
    const ctx = await getContext(request);
    if (!ctx || !ctx.user) {
      return createApiEnvelope({ success: false }, request.id, false, "UNAUTHORIZED: Invalid session");
    }

    await roomManager.leaveRoom(roomId, ctx.user.id);
    const rooms = await roomManager.getRooms();
    const room = rooms.find((r) => r.id === roomId) || null;
    return createApiEnvelope({ success: true, room }, request.id);
  });

  typedFastify.get("/rooms", {
    schema: {
        querystring: z.object({ game: z.string().optional() })
    }
  }, async (request) => {
      const { game } = request.query as any;
      const rooms = await roomManager.getRooms(game);
      return createApiEnvelope({ rooms }, request.id);
  });
}
