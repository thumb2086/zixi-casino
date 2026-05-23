// apps/api/src/routes/v1/support.ts

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SupportManager, IdentityManager } from "@repo/domain";
import { AnnouncementRepository, SessionRepository, UserRepository, kv, OpsRepository } from "@repo/infrastructure";

export async function supportRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  
  const supportManager = new SupportManager();
  const identityManager = new IdentityManager();
  const announcementRepo = new AnnouncementRepository();
  
  const sessionRepo = new SessionRepository();
  const userRepo = new UserRepository();
  const opsRepo = new OpsRepository();

  const getContext = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) return null;
    const session = await sessionRepo.getSessionById(sessionId as string);
    if (!session || session.status !== "authorized") return null;
    const user = await userRepo.getUserById(session.userId);
    return { session, user };
  };

  // ─── Announcements ────────────────────────────────────────────────────────

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

  // ─── Ticketing (Feedback/Reports) ────────────────────────────────────────

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

    // Save ticket to DB
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
      channel: "support",
      severity: "info",
      source: "ticketing",
      kind: "ticket_created",
      userId: ctx.user.id,
      address: ctx.session.address,
      message: `Support ticket created: ${ticket.title}`,
      meta: { reportId: ticket.reportId, category: ticket.category }
    });

    return createApiEnvelope({ success: true, reportId: ticket.reportId }, request.id);
  });

  // ─── Chat Logic ──────────────────────────────────────────────────────────

  typedFastify.get("/chat/health", async () => {
    const kvUrl = process.env.KV_REST_API_URL ? 'set' : 'missing';
    const kvToken = process.env.KV_REST_API_TOKEN ? 'set' : 'missing';
    let kvConnected = false;
    let testWrite = false;
    let testRead = false;
    let messages: any[] = [];
    let cacheKey = '';
    let cacheValue: string | null = null;
    try {
      const pingResult = await (kv as any).ping ? await (kv as any).ping() : null;
      kvConnected = pingResult === true;
    } catch {}
    try {
      const testId = `test_${Date.now()}`;
      await kv.lpush("chat:global:messages", { id: testId, text: 'health_check', address: '', displayName: 'system', createdAt: Date.now() });
      await kv.ltrim("chat:global:messages", 0, 49);
      testWrite = true;
      messages = await kv.lrange<any>("chat:global:messages", 0, 5);
      testRead = Array.isArray(messages);
    } catch (err) {
      return { error: String(err) };
    }
    try {
      cacheKey = "api:GET:/api/v1/support/chat/messages:";
      cacheValue = await kv.get<string>(cacheKey);
    } catch {}
    return {
      kvUrl, kvToken, kvConnected, testWrite, testRead,
      messageCount: messages.length,
      messages: messages.map((m: any) => ({ id: m.id?.slice(0, 12), text: m.text, displayName: m.displayName })),
      cacheKey,
      cacheHit: cacheValue !== null,
      cachePreview: cacheValue ? cacheValue.slice(0, 100) : null,
      timestamp: Date.now(),
    };
  });

  typedFastify.get("/chat/messages", async (request) => {
    // Test write first
    const testId = `get_test_${Date.now()}`;
    await kv.lpush("chat:global:messages", { id: testId, text: 'get_test', address: '', displayName: 'test', createdAt: Date.now() });
    await kv.ltrim("chat:global:messages", 0, 49);
    const raw = await kv.lrange<any>("chat:global:messages", 0, 49);
    return createApiEnvelope({
      messages: raw,
      debug: {
        wroteTest: true,
        count: raw?.length,
        sample: raw?.map((m: any) => m.text).slice(0, 5),
        firstId: raw?.[0]?.id?.slice(0, 16),
        testFound: raw?.some((m: any) => m.id === testId),
        rawType: typeof raw,
        isArray: Array.isArray(raw),
      }
    }, request.id);
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
      createdAt: Date.now()
    };

    const pushResult = await kv.lpush("chat:global:messages", newMessage);
    const trimResult = await kv.ltrim("chat:global:messages", 0, 49);
    console.log(`Chat POST: saved msg=${newMessage.id?.slice(0,12)} push=${pushResult} trim=${trimResult}`);

    // Invalidate GET cache so new message appears immediately
    try { await kv.del("api:GET:/api/v1/support/chat/messages:"); } catch (e: any) {
      console.error("Failed to invalidate chat cache:", e);
    }

    return createApiEnvelope({ message: newMessage, pushResult, trimResult }, request.id);
  });
}
