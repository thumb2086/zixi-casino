import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SessionRepository, UserRepository, WalletRepository, requireDb } from "@repo/infrastructure";
import { sql } from "drizzle-orm";
import { gameSettlement } from "../../utils/game-settlement.js";
import { WalletManager } from "@repo/domain";
import { rollEmployee, createDefaultCompany, processTicks, computeSummary, checkUnlocks,
  upgradeLevelCost, upgradeFabCost, researchCost, EQUIPMENT_COST, STARTUP_FEE } from "@repo/domain/company/company-manager.js";

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

  const pgQuery = async (strings: TemplateStringsArray, ...values: any[]) => {
    const conn = await requireDb();
    const res = await conn.execute(sql(strings as any, ...values));
    return res?.rows || res || [];
  };

  typedFastify.get("/", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ company: null }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    try {
      processTicks(data, row.company_type);
    } catch (err) {
      console.error("[Company] processTicks error:", err);
    }
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ company: { ...row, data: computeSummary(data, row.company_type) } }, request.id);
  });

  typedFastify.post("/create", {
    schema: { body: z.object({ sessionId: z.string(), companyType: z.enum(["ai", "chip"]), companyName: z.string().min(1).max(30) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { companyType, companyName } = request.body;
    const existing = await pgQuery`SELECT id FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    if (existing[0]) return createApiEnvelope({ error: { code: "ALREADY_EXISTS" } }, request.id);
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < STARTUP_FEE) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - STARTUP_FEE).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", STARTUP_FEE.toString());
    intent.address = ctx.session.address; intent.meta = { source: "company_create" };
    await walletRepo.saveTxIntent(intent);
    const data = createDefaultCompany(companyType, companyName);
    const rows = await pgQuery`
      INSERT INTO company_accounts (user_id, company_type, company_name, level, data)
      VALUES (${ctx.user.id}, ${companyType}, ${companyName}, 1, ${JSON.stringify(data)}) RETURNING *
    `;
    const row = rows[0];
    return createApiEnvelope({ company: { ...row, data: computeSummary(data, companyType) } }, request.id);
  });

  typedFastify.get("/hire-preview", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const candidate = rollEmployee(row.company_type);
    data.pendingHire = candidate;
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ candidate }, request.id);
  });

  typedFastify.post("/hire", {
    schema: { body: z.object({ sessionId: z.string(), employeeId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { employeeId } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const candidate = data.pendingHire;
    if (!candidate || candidate.id !== employeeId) return createApiEnvelope({ error: { code: "NOT_FOUND", message: "employee not found or expired" } }, request.id);
    candidate.hiredAt = Date.now();
    data.employees = data.employees || [];
    data.employees.push(candidate);
    delete data.pendingHire;
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, employee: candidate }, request.id);
  });

  typedFastify.post("/fire", {
    schema: { body: z.object({ sessionId: z.string(), employeeId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { employeeId } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    data.employees = (data.employees || []).filter((e: any) => e.id !== employeeId);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true }, request.id);
  });

  typedFastify.post("/set-price", {
    schema: { body: z.object({ sessionId: z.string(), productId: z.string(), multiplier: z.number().min(0.3).max(5.0) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { productId, multiplier } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if (data.products?.[productId]) data.products[productId].priceMultiplier = multiplier;
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true }, request.id);
  });

  typedFastify.post("/upgrade", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const cost = upgradeLevelCost(data.level);
    if (data.cash < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS" } }, request.id);
    data.cash -= cost; data.level++;
    await pgQuery`UPDATE company_accounts SET level = ${data.level}, data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, level: data.level }, request.id);
  });

  typedFastify.post("/research", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const cost = researchCost();
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - cost).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", cost.toString());
    intent.address = ctx.session.address; intent.meta = { source: "company_research" };
    await walletRepo.saveTxIntent(intent);
    data.research = Math.min(100, (data.research || 0) + 10);
    if (data.research >= 100) { data.patents = (data.patents || 0) + 1; data.research = 0; checkUnlocks(data, row.company_type); }
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, research: data.research, patents: data.patents }, request.id);
  });

  typedFastify.post("/buy-equipment", {
    schema: { body: z.object({ sessionId: z.string(), equipmentType: z.enum(["gpu", "supercomputer"]) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { equipmentType } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const cost = EQUIPMENT_COST[equipmentType];
    if (!cost) return createApiEnvelope({ error: { code: "INVALID_EQUIPMENT" } }, request.id);
    if ((data.cash || 0) < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS" } }, request.id);
    data.equipment = data.equipment || { gpu: 0, supercomputer: 0 };
    data.equipment[equipmentType] = (data.equipment[equipmentType] || 0) + 1;
    data.cash -= cost;
    appendHistory(data, "equipment", `購買 ${equipmentType === "gpu" ? "GPU" : "超級電腦"} x1（${cost.toLocaleString()} ZXC）`);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, equipment: data.equipment, cash: data.cash }, request.id);
  });

  typedFastify.post("/withdraw", {
    schema: { body: z.object({ sessionId: z.string(), amount: z.number().min(1) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { amount } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if ((data.cash || 0) < amount) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS" } }, request.id);
    data.cash -= amount;
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance + amount).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_credit", amount.toString());
    intent.address = ctx.session.address; intent.meta = { source: "company_withdraw" };
    await walletRepo.saveTxIntent(intent);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, cash: data.cash }, request.id);
  });

  typedFastify.get("/investable", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT id, company_name, company_type, level, data FROM company_accounts WHERE user_id != ${ctx.user.id} LIMIT 50`;
    const list = (rows || []).map((r: any) => ({
      id: r.id, companyName: r.company_name, companyType: r.company_type, level: r.level,
      data: computeSummary(typeof r.data === "string" ? JSON.parse(r.data) : r.data, r.company_type),
    }));
    return createApiEnvelope({ companies: list }, request.id);
  });

  typedFastify.post("/invest", {
    schema: { body: z.object({ sessionId: z.string(), companyId: z.string(), amount: z.number().min(100) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { companyId, amount } = request.body;
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < amount) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - amount).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", amount.toString());
    intent.address = ctx.session.address; intent.meta = { source: "company_invest", companyId };
    await walletRepo.saveTxIntent(intent);
    const targetRows = await pgQuery`SELECT data FROM company_accounts WHERE id = ${companyId} LIMIT 1`;
    const target = targetRows[0];
    const targetData = target?.data ? (typeof target.data === "string" ? JSON.parse(target.data) : target.data) : {};
    targetData.cash = (targetData.cash || 0) + amount;
    const companyVal = targetData.cash || 0;
    const sharePct = companyVal + amount > 0 ? Math.round((amount / (companyVal + amount)) * 1000) / 10 : 0;
    await pgQuery`
      INSERT INTO company_investments (investor_id, company_id, amount, share_pct)
      VALUES (${ctx.user.id}, ${companyId}, ${String(amount)}, ${String(sharePct)})
    `;
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(targetData)} WHERE id = ${companyId}`;
    return createApiEnvelope({ success: true, sharePct }, request.id);
  });
}
