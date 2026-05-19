import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SessionRepository, UserRepository, WalletRepository, requireDb } from "@repo/infrastructure";
import * as schema from "@repo/infrastructure/db/schema.js";
import { eq } from "drizzle-orm";
import { gameSettlement } from "../../utils/game-settlement.js";
import { WalletManager } from "@repo/domain";
import {
  createDefaultCompany, processTicks, computeSummary, checkUnlocks,
  rollEmployee, upgradeLevelCost, upgradeFabCost, researchCost, STARTUP_FEE,
} from "@repo/domain/company/company-manager.js";

export async function companyRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const sessionRepo = new SessionRepository();
  const userRepo = new UserRepository();
  const walletRepo = new WalletRepository();

  const getContext = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) return null;
    const session = await sessionRepo.getSessionById(sessionId as string);
    if (!session || session.status !== "authorized") return null;
    const user = await userRepo.getUserById(session.userId);
    return { session, user };
  };

  typedFastify.get("/", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ company: null }, request.id);
    const data = row.data as any;
    const events = processTicks(data, row.companyType as "ai" | "chip");
    await db.update(schema.companyAccounts).set({ data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ company: { ...row, data: computeSummary(data, row.companyType as "ai" | "chip") } }, request.id);
  });

  typedFastify.post("/create", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        companyType: z.enum(["ai", "chip"]),
        companyName: z.string().min(1).max(30),
      }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { companyType, companyName } = request.body;
    const db = await requireDb();
    const existing = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (existing) return createApiEnvelope({ error: { code: "ALREADY_EXISTS", message: "你已經有一間公司了" } }, request.id);

    // Deduct startup fee from wallet
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < STARTUP_FEE) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `創辦需要 ${STARTUP_FEE} ZXC` } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - STARTUP_FEE).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", STARTUP_FEE.toString());
    intent.address = ctx.session.address;
    intent.meta = { source: "company_create" };
    await walletRepo.saveTxIntent(intent);

    const data = createDefaultCompany(companyType, companyName);
    const [row] = await db.insert(schema.companyAccounts).values({
      userId: ctx.user.id,
      companyType,
      companyName,
      level: 1,
      data,
    }).returning();
    return createApiEnvelope({ company: { ...row, data: computeSummary(data, companyType) } }, request.id);
  });

  typedFastify.get("/hire-preview", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const candidate = rollEmployee(row.companyType as "ai" | "chip");
    return createApiEnvelope({ candidate }, request.id);
  });

  typedFastify.post("/hire", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        employeeId: z.string(),
      }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { employeeId } = request.body;
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = row.data as any;
    const emp = data.employees?.find((e: any) => e.id === employeeId);
    if (!emp) return createApiEnvelope({ error: { code: "NOT_FOUND", message: "員工不存在，請重新抽卡" } }, request.id);
    emp.hiredAt = Date.now();
    await db.update(schema.companyAccounts).set({ data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ success: true, employee: emp });
  });

  typedFastify.post("/fire", {
    schema: {
      body: z.object({ sessionId: z.string(), employeeId: z.string() }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { employeeId } = request.body;
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = row.data as any;
    data.employees = (data.employees || []).filter((e: any) => e.id !== employeeId);
    await db.update(schema.companyAccounts).set({ data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ success: true });
  });

  typedFastify.post("/set-price", {
    schema: {
      body: z.object({ sessionId: z.string(), productId: z.string(), multiplier: z.number().min(0.3).max(5.0) }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { productId, multiplier } = request.body;
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = row.data as any;
    if (data.products?.[productId]) data.products[productId].priceMultiplier = multiplier;
    await db.update(schema.companyAccounts).set({ data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ success: true });
  });

  typedFastify.post("/upgrade", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = row.data as any;
    const cost = upgradeLevelCost(data.level);
    if (data.cash < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS", message: `公司資金不足，需要 ${cost} ZXC` } }, request.id);
    data.cash -= cost;
    data.level++;
    await db.update(schema.companyAccounts).set({ level: data.level, data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ success: true, level: data.level });
  });

  typedFastify.post("/research", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = row.data as any;
    const cost = researchCost();
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `需要 ${cost} ZXC` } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - cost).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", cost.toString());
    intent.address = ctx.session.address;
    intent.meta = { source: "company_research" };
    await walletRepo.saveTxIntent(intent);
    data.research = Math.min(100, (data.research || 0) + 10);
    if (data.research >= 100) {
      data.patents = (data.patents || 0) + 1;
      data.research = 0;
      checkUnlocks(data, row.companyType as "ai" | "chip");
    }
    await db.update(schema.companyAccounts).set({ data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ success: true, research: data.research, patents: data.patents });
  });

  typedFastify.post("/upgrade-fab", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = row.data as any;
    const cost = upgradeFabCost(data.fabLevel);
    if (data.cash < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS", message: `公司資金不足，需要 ${cost} ZXC` } }, request.id);
    data.cash -= cost;
    data.fabLevel++;
    checkUnlocks(data, "chip");
    await db.update(schema.companyAccounts).set({ data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ success: true, fabLevel: data.fabLevel });
  });

  typedFastify.post("/withdraw", {
    schema: {
      body: z.object({ sessionId: z.string(), amount: z.number().min(1) }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { amount } = request.body;
    const db = await requireDb();
    const row = await db.query.companyAccounts.findFirst({
      where: (c: any, { eq }: any) => eq(c.userId, ctx.user.id),
    });
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = row.data as any;
    if ((data.cash || 0) < amount) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS" } }, request.id);
    data.cash -= amount;
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance + amount).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_credit", amount.toString());
    intent.address = ctx.session.address;
    intent.meta = { source: "company_withdraw" };
    await walletRepo.saveTxIntent(intent);
    await db.update(schema.companyAccounts).set({ data, updatedAt: new Date() }).where(eq(schema.companyAccounts.id, row.id));
    return createApiEnvelope({ success: true, cash: data.cash });
  });

  typedFastify.get("/investable", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const db = await requireDb();
    const rows = await db.query.companyAccounts.findMany({
      where: (c: any, { ne }: any) => ne(c.userId, ctx.user.id),
      limit: 50,
    });
    const list = rows.map(r => ({
      id: r.id,
      companyName: r.companyName,
      companyType: r.companyType,
      level: r.level,
      data: computeSummary(r.data as any, r.companyType as "ai" | "chip"),
    }));
    return createApiEnvelope({ companies: list }, request.id);
  });

  typedFastify.post("/invest", {
    schema: {
      body: z.object({ sessionId: z.string(), companyId: z.string().uuid(), amount: z.number().min(100) }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { companyId, amount } = request.body;
    const db = await requireDb();
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < amount) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - amount).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", amount.toString());
    intent.address = ctx.session.address;
    intent.meta = { source: "company_invest", companyId };
    await walletRepo.saveTxIntent(intent);

    const target = await db.query.companyAccounts.findFirst({ where: (c: any, { eq }: any) => eq(c.id, companyId) });
    const companyVal = (target?.data as any)?.cash || 0;
    const sharePct = companyVal + amount > 0 ? Math.round((amount / (companyVal + amount)) * 1000) / 10 : 0;

    await db.insert(schema.companyInvestments).values({ investorId: ctx.user.id, companyId, amount: String(amount), sharePct: String(sharePct) });
    const targetData = target?.data as any;
    if (targetData) {
      targetData.cash = (targetData.cash || 0) + amount;
      await db.update(schema.companyAccounts).set({ data: targetData }).where(eq(schema.companyAccounts.id, companyId));
    }
    return createApiEnvelope({ success: true, sharePct });
  });

  typedFastify.get("/investments", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const db = await requireDb();
    const invs = await db.query.companyInvestments.findMany({
      where: (i: any, { eq }: any) => eq(i.investorId, ctx.user.id),
    });
    return createApiEnvelope({ investments: invs }, request.id);
  });
}
