import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SessionRepository, UserRepository, WalletRepository, OpsRepository, kv } from "@repo/infrastructure";
import { gameSettlement } from "../../utils/game-settlement.js";
import { getSessionContext } from "../../utils/auth.js";
import { loadInventoryState, persistInventoryState, ALL_ITEMS, grantBundleToUser } from "../../utils/inventory.js";

export async function giftRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const sessionRepo = new SessionRepository();
  const userRepo = new UserRepository();
  const opsRepo = new OpsRepository();

  const getContext = (req: any) => getSessionContext(req, sessionRepo);

  typedFastify.post("/send", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        toAddress: z.string(),
        zxc: z.number().min(0).optional(),
        yjc: z.number().min(0).optional(),
        itemId: z.string().optional(),
        quantity: z.number().int().min(1).max(9999).optional().default(1),
        note: z.string().max(240).optional(),
      }),
    },
  }, async (request) => {
    try {
      const ctx = await getContext(request);
      if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

      const body = request.body as any;
      const toAddr = body.toAddress.toLowerCase().trim();
      const fromAddr = ctx.address.toLowerCase();
      const sender = await userRepo.getUserById(ctx.userId);
      const senderName = sender?.displayName || fromAddr.slice(0, 6);

      // Atomic lock to prevent concurrent gift send (double-spend)
      const lockKey = `gift:lock:${fromAddr}`;
      const lockAcquired = await kv.claimSlot(lockKey, 10, Date.now().toString());
      if (!lockAcquired) {
        return createApiEnvelope({ error: { message: "正在處理中，請稍後再試" } }, request.id);
      }

      if (toAddr === fromAddr) {
        return createApiEnvelope({ error: { message: "不能贈送給自己" } }, request.id);
      }

      const recipient = await userRepo.getUserByAddress(toAddr);
      if (!recipient) {
        return createApiEnvelope({ error: { message: "接收者不存在" } }, request.id);
      }

      const hasZxc = typeof body.zxc === "number" && body.zxc > 0;
      const hasYjc = typeof body.yjc === "number" && body.yjc > 0;
      const hasItem = body.itemId && String(body.itemId).trim();

      if (!hasZxc && !hasYjc && !hasItem) {
        return createApiEnvelope({ error: { message: "請至少贈送 ZXC、YJC 或道具" } }, request.id);
      }

      const walletRepo = new WalletRepository();
      const bundleSummary: string[] = [];

      if (hasYjc) {
        const newSenderYjc = await walletRepo.adjustBalanceAtomic(fromAddr, `-${body.yjc}`, "yjc");
        if (newSenderYjc === null) {
          return createApiEnvelope({ error: { message: `YJC 餘額不足` } }, request.id);
        }
        await walletRepo.adjustBalanceAtomic(toAddr, `+${body.yjc}`, "yjc");
        bundleSummary.push(`${body.yjc.toLocaleString()} YJC`);
      }

      if (hasZxc) {
        const newSender = await walletRepo.adjustBalanceAtomic(fromAddr, `-${body.zxc}`, "zhixi");
        if (newSender === null) {
          return createApiEnvelope({ error: { message: `ZXC 餘額不足` } }, request.id);
        }
        await walletRepo.adjustBalanceAtomic(toAddr, `+${body.zxc}`, "zhixi");
        bundleSummary.push(`${body.zxc.toLocaleString()} ZXC`);
      }

      if (hasItem) {
        const itemId = String(body.itemId).trim();
        const qty = Math.max(1, Math.floor(Number(body.quantity) || 1));
        const def = ALL_ITEMS[itemId];

        if (def?.type === "avatar" || def?.type === "title" || itemId.startsWith("token_yjc")) {
          return createApiEnvelope({ error: { message: "頭像、稱號、YJC 無法贈送" } }, request.id);
        }

        const state = await loadInventoryState(ctx.userId);
        const owned = state.inventory[itemId] || 0;
        if (owned < qty) {
          return createApiEnvelope({ error: { message: `道具 ${def?.name || itemId} 數量不足，持有 ${owned} 個` } }, request.id);
        }

        const nextState = { ...state, inventory: { ...state.inventory } };
        nextState.inventory[itemId] = owned - qty;
        if (nextState.inventory[itemId] <= 0) delete nextState.inventory[itemId];
        await persistInventoryState(ctx.userId, nextState);

        const defName = def?.name || itemId;
        await grantBundleToUser(recipient.id, { items: [{ id: itemId, qty }] }, toAddr);

        bundleSummary.push(`${defName} ×${qty}`);
      }

      const summary = bundleSummary.join(" + ");

      try {
        const chatMsg = {
          id: crypto.randomUUID(),
          address: "",
          displayName: "🎁 系統",
          text: `🫵 ${senderName} 贈送 ${summary} 給 ${recipient.displayName || toAddr.slice(0, 6)}`,
          type: 'system' as const,
        };
        const { WalletRepository } = await import("@repo/infrastructure");
        const walletRepo = new WalletRepository();
        await walletRepo.saveChatMessage(chatMsg);
        const { broadcastChatMessage } = await import("../../utils/sse.js");
        broadcastChatMessage({ ...chatMsg, createdAt: new Date().toISOString() });
      } catch {}

      await opsRepo.logEvent({
        channel: "rewards", severity: "info", source: "gift", kind: "user_gift",
        userId: ctx.userId, address: fromAddr,
        message: `Gift: ${summary} → ${toAddr}`,
        meta: { toAddress: toAddr, bundle: summary, note: body.note || null },
      });

      return createApiEnvelope({ success: true, bundle: summary }, request.id);
    } catch (error: any) {
      console.error("[gift] send failed:", error);
      return createApiEnvelope(
        { error: { message: error?.message || "贈送失敗" } },
        request.id
      );
    }
  });

  typedFastify.get("/recipients", {
    schema: {
      querystring: z.object({
        search: z.string().max(60).optional(),
      }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

    const { search } = request.query as { search?: string };
    const users = await userRepo.listUsers({ search, limit: 50 });
    const list = (users || []).map((u: any) => ({
      address: u.address,
      displayName: u.displayName || u.address.slice(0, 8),
    })).filter((u: { address: string; displayName: string }) => u.address.toLowerCase() !== ctx.address.toLowerCase());

    return createApiEnvelope({ users: list }, request.id);
  });
}
