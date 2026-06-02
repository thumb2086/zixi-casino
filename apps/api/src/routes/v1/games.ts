// apps/api/src/routes/v1/games.ts

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { RoomManager, VipManager, MultiplayerGameManager } from "@repo/domain";
import { SessionRepository, UserRepository, kv } from "@repo/infrastructure";
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

  // ─── Multiplayer Room Actions ──────────────────────────────────────────────

  const mgr = new MultiplayerGameManager();

  // Validate that ctx.user.id is a member of the given room
  async function assertRoomMembership(roomId: string, userId: string): Promise<boolean> {
    const room = await roomManager.getRoom(roomId);
    if (!room) return false;
    return room.players.some((p: any) => p.userId === userId);
  }

  typedFastify.post("/rooms/poker/action", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        roomId: z.string(),
        action: z.enum(["init", "fold", "call", "raise", "check"]),
        amount: z.number().optional(),
      }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { roomId, action, amount } = request.body;

    // Validate room membership
    if (!await assertRoomMembership(roomId, ctx.user.id)) {
      return createApiEnvelope({ error: { code: "NOT_IN_ROOM", message: "You are not a member of this room" } }, request.id);
    }

    const stateKey = `room:game:${roomId}`;
    let state = await kv.get<any>(stateKey);

    if (action === "init") {
      const room = await roomManager.getRoom(roomId);
      if (!room) return createApiEnvelope({ error: { code: "ROOM_NOT_FOUND" } }, request.id);
      const players = room.players.map(p => ({
        userId: p.userId,
        displayName: p.displayName,
        stack: 1000,
        isBot: p.isBot,
      }));
      state = mgr.initPoker(players);
      await kv.set(stateKey, state);
      return createApiEnvelope({ state: { ...state, players: state.players.map((p: Record<string, any>) => ({ ...p, hand: p.hand.map(() => ({ rank: '?', suit: '?' })) })) } }, request.id);
    }

    if (!state) return createApiEnvelope({ error: { code: "GAME_NOT_STARTED" } }, request.id);

    if (action === "fold") state = mgr.advancePoker(state, { type: "fold", userId: ctx.user.id });
    else if (action === "call") state = mgr.advancePoker(state, { type: "call", userId: ctx.user.id });
    else if (action === "raise" && amount) state = mgr.advancePoker(state, { type: "raise", userId: ctx.user.id, amount });
    else if (action === "check") state = mgr.advancePoker(state, { type: "check", userId: ctx.user.id });

    await kv.set(stateKey, state);
    return createApiEnvelope({ state }, request.id);
  });

  typedFastify.post("/rooms/bluffdice/action", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        roomId: z.string(),
        action: z.enum(["bet", "call_bluff", "new_round"]),
        quantity: z.number().optional(),
        value: z.number().optional(),
      }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { roomId, action, quantity, value } = request.body;

    // Validate room membership
    if (!await assertRoomMembership(roomId, ctx.user.id)) {
      return createApiEnvelope({ error: { code: "NOT_IN_ROOM", message: "You are not a member of this room" } }, request.id);
    }

    const stateKey = `room:game:${roomId}`;

    if (action === "new_round") {
      const state = { phase: "betting", bets: [], dice: Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1), currentTurn: 0, winner: null };
      await kv.set(stateKey, state);
      return createApiEnvelope({ state }, request.id);
    }

    let state = await kv.get<any>(stateKey);
    if (!state) return createApiEnvelope({ error: { code: "GAME_NOT_STARTED" } }, request.id);

    if (action === "bet" && quantity && value) {
      state.bets.push({ userId: ctx.user.id, displayName: ctx.user.displayName || ctx.user.username, quantity, value });
    } else if (action === "call_bluff") {
      const allDice = state.dice;
      if (state.bets.length > 0) {
        const lastBet = state.bets[state.bets.length - 1];
        const actualCount = allDice.filter((d: number) => d === lastBet.value).length;
        state.winner = actualCount < lastBet.quantity ? lastBet.userId : ctx.user.id;
        state.phase = "result";
      }
    }

    await kv.set(stateKey, state);
    return createApiEnvelope({ state }, request.id);
  });
}
