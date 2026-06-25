import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { SessionRepository, UserRepository, WalletRepository, requireDb } from "@repo/infrastructure";
import { sql } from "drizzle-orm";
import { WalletManager } from "@repo/domain";
import { rollEmployee as aiRollEmployee, createDefaultCompany, processTicks as aiProcessTicks, computeSummary as aiComputeSummary,
  upgradeLevelCost, researchCost, EQUIPMENT_COST, STARTUP_FEE, checkUnlocks } from "@repo/domain/company/company-manager.js";
import {
  createDefaultSemiconductorData, computeSummary as semiComputeSummary,
  startProduction, claimProduction, getResearchTechCost, applyResearchTech, craftBreakthrough,
  assembleComputer, rollEmployee as semiRollEmployee, MATERIAL_COST, NODE_BREAKTHROUGH_REQUIREMENTS,
} from "@repo/domain/semiconductor/index.js";

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

  const deductWallet = async (address: string, userId: string, amount: number, source: string) => {
    const result = await walletRepo.adjustBalanceAtomic(address, `-${amount}`, "zhixi");
    if (result === null) return false;
    const intent = new WalletManager().createTxIntent(userId, "ZXC", "admin_debit", amount.toString());
    intent.address = address; intent.meta = { source };
    await walletRepo.saveTxIntent(intent);
    return true;
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

    if (row.company_type === "semiconductor") {
      await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
      return createApiEnvelope({ company: { ...row, data: semiComputeSummary(data) } }, request.id);
    }

    try { aiProcessTicks(data); } catch (err) { console.error("[Company] aiProcessTicks error:", err); }
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ company: { ...row, data: aiComputeSummary(data, "ai") } }, request.id);
  });

  typedFastify.post("/create", {
    schema: { body: z.object({ sessionId: z.string(), companyType: z.enum(["ai", "semiconductor"]), companyName: z.string().min(1).max(30) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { companyType, companyName } = request.body;
    const existing = await pgQuery`SELECT id FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    if (existing[0]) return createApiEnvelope({ error: { code: "ALREADY_EXISTS" } }, request.id);
    if (!await deductWallet(ctx.session.address, ctx.user.id, STARTUP_FEE, "company_create")) {
      return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    }

    let data: any;
    let summary: any;
    if (companyType === "semiconductor") {
      data = createDefaultSemiconductorData();
      summary = semiComputeSummary(data);
    } else {
      data = createDefaultCompany("ai", companyName);
      summary = aiComputeSummary(data, "ai");
    }

    const rows = await pgQuery`
      INSERT INTO company_accounts (user_id, company_type, company_name, level, data)
      VALUES (${ctx.user.id}, ${companyType}, ${companyName}, 1, ${JSON.stringify(data)}) RETURNING *
    `;
    const row = rows[0];
    return createApiEnvelope({ company: { ...row, data: summary } }, request.id);
  });

  typedFastify.get("/hire-preview", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const candidate = row.company_type === "semiconductor" ? semiRollEmployee() : aiRollEmployee("ai");
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
    const deposit = candidate.salary * 10;

    if (row.company_type === "semiconductor") {
      if (!await deductWallet(ctx.session.address, ctx.user.id, deposit, "semiconductor_hire")) {
        return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `需要 ${deposit} ZXC 招聘押金` } }, request.id);
      }
    } else {
      if ((data.cash || 0) < deposit) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS", message: `需要 ${deposit} ZXC 招聘押金` } }, request.id);
      data.cash -= deposit;
    }

    candidate.hiredAt = Date.now();
    data.employees = data.employees || [];
    data.employees.push(candidate);
    delete data.pendingHire;
    const history = data.history || [];
    history.unshift({ at: new Date().toISOString(), type: "hire", summary: `僱用 ${candidate.name}（${candidate.role}），押金 ${deposit} ZXC` });
    data.history = history;
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, employee: candidate, deposit }, request.id);
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

  // ─── Semiconductor-only routes (all deduct real ZXC from wallet) ─────

  typedFastify.post("/hardware/produce", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row || row.company_type !== "semiconductor") return createApiEnvelope({ error: { code: "NOT_SEMICONDUCTOR" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;

    if (!await deductWallet(ctx.session.address, ctx.user.id, MATERIAL_COST, "semiconductor_produce")) {
      return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `需要 ${MATERIAL_COST} ZXC 材料費` } }, request.id);
    }

    const result = startProduction(data);
    if (!result.success) return createApiEnvelope({ error: { code: "PRODUCTION_FAILED", message: result.message } }, request.id);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, endTime: result.endTime }, request.id);
  });

  typedFastify.post("/hardware/claim", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row || row.company_type !== "semiconductor") return createApiEnvelope({ error: { code: "NOT_SEMICONDUCTOR" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const result = claimProduction(data);
    if (!result.success) return createApiEnvelope({ error: { code: "CLAIM_FAILED", message: (result as any).message } }, request.id);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, result }, request.id);
  });

  typedFastify.post("/hardware/research", {
    schema: { body: z.object({ sessionId: z.string(), techId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { techId } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row || row.company_type !== "semiconductor") return createApiEnvelope({ error: { code: "NOT_SEMICONDUCTOR" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;

    const cost = getResearchTechCost(data, techId);
    if (cost === null) return createApiEnvelope({ error: { code: "RESEARCH_FAILED", message: "無法升級此科技" } }, request.id);

    if (!await deductWallet(ctx.session.address, ctx.user.id, cost, "semiconductor_research")) {
      return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `需要 ${cost} ZXC` } }, request.id);
    }

    const result = applyResearchTech(data, techId);
    if (!result.success) return createApiEnvelope({ error: { code: "RESEARCH_FAILED", message: result.message } }, request.id);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, newLevel: result.newLevel, cost }, request.id);
  });

  typedFastify.post("/hardware/craft", {
    schema: { body: z.object({ sessionId: z.string(), targetNode: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { targetNode } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row || row.company_type !== "semiconductor") return createApiEnvelope({ error: { code: "NOT_SEMICONDUCTOR" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;

    const reqs = NODE_BREAKTHROUGH_REQUIREMENTS;
    const req = Object.values(reqs).find(r => r.targetNode === targetNode);
    if (req) {
      if (!await deductWallet(ctx.session.address, ctx.user.id, req.zixiCost, "semiconductor_craft")) {
        return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `需要 ${req.zixiCost} ZXC` } }, request.id);
      }
    }

    const result = craftBreakthrough(data, targetNode);
    if (!result.success) return createApiEnvelope({ error: { code: "CRAFT_FAILED", message: result.message } }, request.id);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, message: result.message, nodeId: data.nodeId }, request.id);
  });

  typedFastify.post("/hardware/assemble", {
    schema: { body: z.object({ sessionId: z.string(), computerId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { computerId } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row || row.company_type !== "semiconductor") return createApiEnvelope({ error: { code: "NOT_SEMICONDUCTOR" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const result = assembleComputer(data, computerId);
    if (!result.success) return createApiEnvelope({ error: { code: "ASSEMBLE_FAILED", message: result.message } }, request.id);
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, message: result.message }, request.id);
  });

  // ─── AI-only routes ─────────────────────────────────────────────────

  typedFastify.post("/set-price", {
    schema: { body: z.object({ sessionId: z.string(), productId: z.string(), multiplier: z.number().min(0.3).max(5.0) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { productId, multiplier } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    if (row.company_type !== "ai") return createApiEnvelope({ error: { code: "AI_ONLY" } }, request.id);
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
    if (row.company_type !== "ai") return createApiEnvelope({ error: { code: "AI_ONLY" } }, request.id);
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
    if (row.company_type !== "ai") return createApiEnvelope({ error: { code: "AI_ONLY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const cost = researchCost();
    if (!await deductWallet(ctx.session.address, ctx.user.id, cost, "company_research")) {
      return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    }
    data.research = Math.min(100, (data.research || 0) + 10);
    if (data.research >= 100) { data.patents = (data.patents || 0) + 1; data.research = 0; checkUnlocks(data); }
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
    if (row.company_type !== "ai") return createApiEnvelope({ error: { code: "AI_ONLY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const cost = EQUIPMENT_COST[equipmentType];
    if (!cost) return createApiEnvelope({ error: { code: "INVALID_EQUIPMENT" } }, request.id);
    if ((data.cash || 0) < cost) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS" } }, request.id);
    data.equipment = data.equipment || { gpu: 0, supercomputer: 0 };
    data.equipment[equipmentType] = (data.equipment[equipmentType] || 0) + 1;
    data.cash -= cost;
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, equipment: data.equipment, cash: data.cash }, request.id);
  });

  // ─── AI-only deposit/withdraw ────────────────────────────────────────

  typedFastify.post("/deposit", {
    schema: { body: z.object({ sessionId: z.string(), amount: z.number().min(1) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { amount } = request.body;
    const rows = await pgQuery`SELECT * FROM company_accounts WHERE user_id = ${ctx.user.id} LIMIT 1`;
    const row = rows[0];
    if (!row) return createApiEnvelope({ error: { code: "NO_COMPANY" } }, request.id);
    if (row.company_type !== "ai") return createApiEnvelope({ error: { code: "AI_ONLY" } }, request.id);
    if (!await deductWallet(ctx.session.address, ctx.user.id, amount, "company_deposit")) {
      return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    }
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    data.cash = (data.cash || 0) + amount;
    const history = data.history || [];
    history.unshift({ at: new Date().toISOString(), type: "deposit", summary: `存入 ${amount} ZXC 至公司營運資金` });
    data.history = history;
    await pgQuery`UPDATE company_accounts SET data = ${JSON.stringify(data)}, updated_at = NOW() WHERE id = ${row.id}`;
    return createApiEnvelope({ success: true, cash: data.cash }, request.id);
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
    if (row.company_type !== "ai") return createApiEnvelope({ error: { code: "AI_ONLY" } }, request.id);
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if ((data.cash || 0) < amount) return createApiEnvelope({ error: { code: "INSUFFICIENT_FUNDS" } }, request.id);
    data.cash -= amount;
    await walletRepo.adjustBalanceAtomic(ctx.session.address, `+${amount}`, "zhixi");
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
    const list = (rows || []).map((r: any) => {
      const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
      let summary: any;
      if (r.company_type === "semiconductor") {
        summary = semiComputeSummary(parsed);
      } else {
        summary = aiComputeSummary(parsed, "ai");
      }
      return { id: r.id, companyName: r.company_name, companyType: r.company_type, level: r.level, data: summary };
    });
    return createApiEnvelope({ companies: list }, request.id);
  });

  typedFastify.post("/invest", {
    schema: { body: z.object({ sessionId: z.string(), companyId: z.string(), amount: z.number().min(100) }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { companyId, amount } = request.body;
    if (!await deductWallet(ctx.session.address, ctx.user.id, amount, "company_invest")) {
      return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE" } }, request.id);
    }
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
