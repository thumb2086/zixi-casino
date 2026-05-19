import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SessionRepository, UserRepository, WalletRepository, requireDb } from "@repo/infrastructure";
import { sql } from "drizzle-orm";
import { gameSettlement } from "../../utils/game-settlement.js";
import { WalletManager } from "@repo/domain";
import { rollEmployee, createDefaultCompany, processTicks, computeSummary, checkUnlocks,
  upgradeLevelCost, upgradeFabCost, researchCost, STARTUP_FEE } from "@repo/domain/company/company-manager.js";

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

  const db = () => requireDb();

  async function q(sqlStr: string, params?: any[]) {
    const conn = await db();
    return conn.execute(sql.raw(sqlStr), params);
  }

  typedFastify.get("/", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const [row] = await q(`SELECT * FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ company: null }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    processTicks(data, row.company_type);
    await q(`UPDATE company_accounts SET data = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(data), row.id]);
    return createApiEnvelope({ company: { ...row, data: computeSummary(data, row.company_type) } }, request.id);
  });

  typedFastify.post("/create", {
    schema: { body: z.object({ sessionId: z.string(), companyType: z.enum(["ai", "chip"]), companyName: z.string().min(1).max(30) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { companyType, companyName } = request.body;
    const [existing] = await q(`SELECT id FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (existing) return createApiEnvelope({ error: { code: "ALREADY_EXISTS", message: "你已經�?一?�公?��?" } }, request.id);
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < STARTUP_FEE) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `?�辦?��?${STARTUP_FEE} ZXC` } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - STARTUP_FEE).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", STARTUP_FEE.toString());
    intent.address = ctx.session.address; intent.meta = { source: "company_create" };
    await walletRepo.saveTxIntent(intent);
    const data = createDefaultCompany(companyType, companyName);
    const [row] = await q(
      `INSERT INTO company_accounts (user_id, company_type, company_name, level, data) VALUES ($1,$2,$3,1,$4) RETURNING *`,
      [ctx.user.id, companyType, companyName, JSON.stringify(data)]
    );
    return createApiEnvelope({ company: { ...row, data: computeSummary(data, companyType) } }, request.id);
  });

  typedFastify.get("/hire-preview", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const [row] = await q(`SELECT company_type FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    return createApiEnvelope({ candidate: rollEmployee(row.company_type) }, request.id);
  });

  typedFastify.post("/hire", {
    schema: { body: z.object({ sessionId: z.string(), employeeId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { employeeId } = request.body;
    const [row] = await q(`SELECT * FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const emp = data.employees?.find((e: any) => e.id === employeeId);
    if (!emp) return createApiEnvelope({ error: { code: "NOT_FOUND", message: "employee not found" } }, request.id);
    emp.hiredAt = Date.now();
    await q(`UPDATE company_accounts SET data = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(data), row.id]);
    return createApiEnvelope({ success: true, employee: emp }, request.id);
  });

  typedFastify.post("/fire", {
    schema: { body: z.object({ sessionId: z.string(), employeeId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { employeeId } = request.body;
    const [row] = await q(`SELECT * FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    data.employees = (data.employees || []).filter((e: any) => e.id !== employeeId);
    await q(`UPDATE company_accounts SET data = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(data), row.id]);
    return createApiEnvelope({ success: true }, request.id);
  });

  typedFastify.post("/set-price", {
    schema: { body: z.object({ sessionId: z.string(), productId: z.string(), multiplier: z.number().min(0.3).max(5.0) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { productId, multiplier } = request.body;
    const [row] = await q(`SELECT * FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if (data.products?.[productId]) data.products[productId].priceMultiplier = multiplier;
    await q(`UPDATE company_accounts SET data = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(data), row.id]);
    return createApiEnvelope({ success: true }, request.id);
  });

  typedFastify.post("/upgrade", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const [row] = await q(`SELECT * FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const cost = upgradeLevelCost(data.level);
    if (data.cash < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS", message: `?�司資�?不足，�?�?${cost} ZXC` } }, request.id);
    data.cash -= cost; data.level++;
    await q(`UPDATE company_accounts SET level = $1, data = $2, updated_at = NOW() WHERE id = $3`, [data.level, JSON.stringify(data), row.id]);
    return createApiEnvelope({ success: true, level: data.level }, request.id);
  });

  typedFastify.post("/research", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const [row] = await q(`SELECT * FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const cost = researchCost();
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    if (balance < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `?��?${cost} ZXC` } }, request.id);
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance - cost).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_debit", cost.toString());
    intent.address = ctx.session.address; intent.meta = { source: "company_research" };
    await walletRepo.saveTxIntent(intent);
    data.research = Math.min(100, (data.research || 0) + 10);
    if (data.research >= 100) { data.patents = (data.patents || 0) + 1; data.research = 0; checkUnlocks(data, row.company_type); }
    await q(`UPDATE company_accounts SET data = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(data), row.id]);
    return createApiEnvelope({ success: true, research: data.research, patents: data.patents }, request.id);
  });

  typedFastify.post("/withdraw", {
    schema: { body: z.object({ sessionId: z.string(), amount: z.number().min(1) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { amount } = request.body;
    const [row] = await q(`SELECT * FROM company_accounts WHERE user_id = $1 LIMIT 1`, [ctx.user.id]);
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if ((data.cash || 0) < amount) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS" } }, request.id);
    data.cash -= amount;
    const balance = parseFloat(await gameSettlement.getBalance(ctx.session.address, "zhixi"));
    await gameSettlement.setBalance(ctx.session.address, "zhixi", (balance + amount).toString());
    const intent = new WalletManager().createTxIntent(ctx.user.id, "ZXC", "admin_credit", amount.toString());
    intent.address = ctx.session.address; intent.meta = { source: "company_withdraw" };
    await walletRepo.saveTxIntent(intent);
    await q(`UPDATE company_accounts SET data = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(data), row.id]);
    return createApiEnvelope({ success: true, cash: data.cash }, request.id);
  });

  typedFastify.get("/investable", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await q(`SELECT id, company_name, company_type, level, data FROM company_accounts WHERE user_id != $1 LIMIT 50`, [ctx.user.id]);
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
    const [target] = await q(`SELECT data FROM company_accounts WHERE id = $1 LIMIT 1`, [companyId]);
    const targetData = target?.data ? (typeof target.data === "string" ? JSON.parse(target.data) : target.data) : {};
    targetData.cash = (targetData.cash || 0) + amount;
    const companyVal = targetData.cash || 0;
    const sharePct = companyVal + amount > 0 ? Math.round((amount / (companyVal + amount)) * 1000) / 10 : 0;
    await q(`INSERT INTO company_investments (investor_id, company_id, amount, share_pct) VALUES ($1,$2,$3,$4)`,
      [ctx.user.id, companyId, String(amount), String(sharePct)]);
    await q(`UPDATE company_accounts SET data = $1 WHERE id = $2`, [JSON.stringify(targetData), companyId]);
    return createApiEnvelope({ success: true, sharePct }, request.id);
  });
}
