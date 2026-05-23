// apps/api/src/routes/v1/support.ts

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SupportManager, IdentityManager } from "@repo/domain";
import { AnnouncementRepository, SessionRepository, UserRepository, OpsRepository, WalletRepository } from "@repo/infrastructure";
import { addSSEClient, broadcastChatMessage } from "../../utils/sse.js";

export async function supportRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  
  const supportManager = new SupportManager();
  const identityManager = new IdentityManager();
  const announcementRepo = new AnnouncementRepository();
  const sessionRepo = new SessionRepository();
  const userRepo = new UserRepository();
  const opsRepo = new OpsRepository();
  const walletRepo = new WalletRepository();

  const getContext = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) return null;
    const session = await sessionRepo.getSessionById(sessionId as string);
    if (!session || session.status !== "authorized") return null;
    const user = await userRepo.getUserById(session.userId);
    return { session, user };
  };

  // ─── SSE Stream ─────────────────────────────────────────────────────────────

  typedFastify.get("/chat/stream", async (request, reply) => {
    const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    addSSEClient(clientId, reply);
  });

  // ─── Announcements ──────────────────────────────────────────────────────────

  typedFastify.get("/announcements", async (request) => {
    const dbAnnouncements = await announcementRepo.listActiveAnnouncements();
    const active = dbAnnouncements.map((item: any) => ({
      id: item.id,
      announcementId: item.announcementId,
      title: item.title,
      content: item.content,
      isPinned: item.isPinned ?? false,
      isActive: item.isActive ?? true,
      publishedBy: item.publishedBy || undefined,
      updatedBy: item.updatedBy || undefined,
      publishedAt: new Date(item.publishedAt || item.createdAt).toISOString(),
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt || item.createdAt).toISOString(),
    }));
    return createApiEnvelope({ announcements: active }, request.id);
  });

  // ─── Ticketing ──────────────────────────────────────────────────────────────

  typedFastify.post("/tickets", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        title: z.string(),
        category: z.string(),
        message: z.string(),
        contact: z.string().optional(),
        pageUrl: z.string().optional(),
      })
    }
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

    const input = supportManager.sanitizeIssueInput(request.body);
    const validationError = supportManager.validateIssueInput(input);
    if (validationError) {
      return createApiEnvelope({ error: { message: validationError } }, request.id);
    }

    const ticket = supportManager.createTicket({
      ...input,
      address: ctx.session.address,
      displayName: ctx.user.displayName,
      platform: ctx.session.platform,
      clientType: ctx.session.clientType,
      deviceId: ctx.session.deviceId,
      appVersion: ctx.session.appVersion,
      mode: ctx.session.mode
    });

    try {
      const db = await (await import("@repo/infrastructure/db/index.js")).requireDb();
      const { supportTickets } = await import("@repo/infrastructure/db/schema.js");
      await db.insert(supportTickets).values({
        id: crypto.randomUUID(),
        reportId: ticket.reportId,
        userId: ctx.user.id,
        address: ctx.session.address,
        displayName: ctx.user.displayName,
        category: ticket.category,
        title: ticket.title,
        message: ticket.message,
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (dbErr: any) {
      await opsRepo.logEvent({
        channel: "support", severity: "error", source: "ticketing", kind: "ticket_db_failed",
        userId: ctx.user.id, message: `Failed to save ticket to DB: ${dbErr?.message}`,
      }).catch(() => {});
    }

    await opsRepo.logEvent({
      channel: "support", severity: "info", source: "ticketing", kind: "ticket_created",
      userId: ctx.user.id, address: ctx.session.address,
      message: `Support ticket created: ${ticket.title}`,
      meta: { reportId: ticket.reportId, category: ticket.category }
    });

    return createApiEnvelope({ success: true, reportId: ticket.reportId }, request.id);
  });

  // ─── Chat ───────────────────────────────────────────────────────────────────

  typedFastify.get("/chat/messages", async (request) => {
    const query = request.query as any;
    const limit = Math.min(parseInt(query?.limit || "50"), 100);
    const messages = await walletRepo.listChatMessages(limit);
    return createApiEnvelope({ messages }, request.id);
  });

  typedFastify.post("/chat/messages", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        text: z.string().min(1).max(500),
      })
    }
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

    const newMessage = {
      id: crypto.randomUUID(),
      userId: ctx.user.id,
      address: ctx.session.address,
      displayName: ctx.user.displayName || "匿名玩家",
      text: request.body.text,
      type: 'user' as const,
    };

    await walletRepo.saveChatMessage(newMessage);

    // Push to SSE clients
    broadcastChatMessage({
      id: newMessage.id,
      address: newMessage.address,
      displayName: newMessage.displayName,
      text: newMessage.text,
      type: 'user',
      createdAt: new Date().toISOString(),
    });

    return createApiEnvelope({ message: newMessage }, request.id);
  });
}
