import { rollEmployee, computeTeamBonus, type Employee, ROLE_DEFS } from "./employee-gen.js";

const COMPANY_TICK_MS = 30_000;
const STARTUP_FEE = 1000;

export interface ProductDef {
  id: string;
  name: string;
  unlockedBy: string;
  baseRevenue: number;
}

export const PRODUCT_DEFS: Record<string, ProductDef> = {
  chatbot_api:   { id: "chatbot_api",   name: "ChatBot API",        unlockedBy: "初始自帶",  baseRevenue: 10 },
  image_gen:     { id: "image_gen",     name: "圖片生成器",         unlockedBy: "2 工程師",   baseRevenue: 25 },
  enterprise_ai: { id: "enterprise_ai", name: "企業 AI 套件",       unlockedBy: "3 研究員+1專利", baseRevenue: 100 },
};

export interface Product {
  id: string;
  priceMultiplier: number;
  unlockedAt: number;
}

export interface CompanyData {
  version: number;
  cash: number;
  level: number;
  research: number;
  patents: number;
  employees: Employee[];
  products: Record<string, Product>;
  unlockedProducts: string[];
  reputation: number;
  lastTickAt: number;
  history: CompanyEvent[];
  equipment: { gpu: number; supercomputer: number };
}

export interface CompanyEvent {
  at: string;
  type: string;
  summary: string;
  detail?: Record<string, unknown>;
}

export function appendHistory(data: CompanyData, type: string, summary: string, detail?: Record<string, unknown>) {
  data.history = data.history || [];
  data.history.unshift({ at: new Date().toISOString(), type, summary, detail });
  if (data.history.length > 80) data.history.length = 80;
}

export function createDefaultCompany(companyType: "ai", companyName: string): CompanyData {
  const defaultProducts: Record<string, Product> = {};
  const unlocked: string[] = [];
  for (const [id, def] of Object.entries(PRODUCT_DEFS)) {
    if (def.unlockedBy === "初始自帶") {
      defaultProducts[id] = { id, priceMultiplier: 1.0, unlockedAt: Date.now() };
      unlocked.push(id);
    }
  }
  return {
    version: 1,
    cash: 0,
    level: 1,
    research: 0,
    patents: 0,
    employees: [],
    products: defaultProducts,
    unlockedProducts: unlocked,
    reputation: 50,
    lastTickAt: Date.now(),
    history: [],
    equipment: { gpu: 0, supercomputer: 0 },
  };
}

export function getAvailableRoles(): string[] {
  return ["data_scientist", "engineer", "researcher"];
}

export function checkUnlocks(data: CompanyData): void {
  const engCount = data.employees.filter(e => e.role === "engineer").length;
  const resCount = data.employees.filter(e => e.role === "researcher").length;

  if (!data.unlockedProducts.includes("image_gen") && engCount >= 2) {
    data.products["image_gen"] = { id: "image_gen", priceMultiplier: 1.0, unlockedAt: Date.now() };
    data.unlockedProducts.push("image_gen");
    appendHistory(data, "unlock", "解鎖新產品：圖片生成器");
  }
  if (!data.unlockedProducts.includes("enterprise_ai") && resCount >= 3 && data.patents >= 1) {
    data.products["enterprise_ai"] = { id: "enterprise_ai", priceMultiplier: 1.0, unlockedAt: Date.now() };
    data.unlockedProducts.push("enterprise_ai");
    appendHistory(data, "unlock", "解鎖新產品：企業 AI 套件");
  }
}

export function processTicks(data: CompanyData): { ticksProcessed: number; events: CompanyEvent[] } {
  const now = Date.now();
  const elapsed = now - data.lastTickAt;
  if (elapsed < COMPANY_TICK_MS) return { ticksProcessed: 0, events: [] };
  const ticks = Math.floor(elapsed / COMPANY_TICK_MS);
  if (ticks <= 0) return { ticksProcessed: 0, events: [] };
  const events: CompanyEvent[] = [];

  const maxTicks = Math.min(ticks, 100);
  const team = computeTeamBonus(data.employees);
  const teamMult = team.effectiveMultiplier;

  for (let t = 0; t < maxTicks; t++) {
    let salaryCost = 0;
    for (const emp of data.employees) {
      salaryCost += emp.salary;
    }
    data.cash -= salaryCost;

    let revenue = 0;
    for (const [prodId, product] of Object.entries(data.products)) {
      const def = PRODUCT_DEFS[prodId];
      if (!def) continue;
      const relEmps = data.employees.filter(e => ["data_scientist", "engineer"].includes(e.role));
      const avgProd = relEmps.length > 0
        ? relEmps.reduce((s, e) => s + e.productivity, 0) / relEmps.length
        : 1;
      const qualityMult = 1 + (avgProd - 1) * 0.5 * teamMult;
      const researchMult = 1 + data.research * 0.01;
      const priceMult = product.priceMultiplier;
      const base = def.baseRevenue * data.level;
      const demand = Math.max(0.1, Math.min(2.0, 1 - (priceMult - 1) * 0.15));
      const prodRevenue = base * qualityMult * researchMult * priceMult * demand;
      revenue += prodRevenue;
    }

    data.cash += revenue;

    const engCount = data.employees.filter(e => e.role === "engineer" || e.role === "data_scientist").length;
    const equip = data.equipment || { gpu: 0, supercomputer: 0 };
    const equipMult = 1 + equip.gpu * 0.5 + equip.supercomputer * 2;
    data.research = Math.min(100, data.research + engCount * 0.1 * teamMult * equipMult);

    if (data.research >= 100) {
      data.patents++;
      data.research = 0;
      appendHistory(data, "patent", `獲得專利！共 ${data.patents} 項專利`);
      checkUnlocks(data);
    }

    if (data.reputation > 55) data.reputation -= 0.1;
    else if (data.reputation < 45) data.reputation += 0.1;

    if (data.cash < -5000) {
      const empCount = data.employees.length;
      data.employees = [];
      data.products = {};
      data.unlockedProducts = [];
      data.research = 0;
      data.level = 1;
      data.cash = 0;
      appendHistory(data, "bankruptcy", `破產！已遣散 ${empCount} 名員工，等級重置`);
      break;
    }
  }

  data.lastTickAt += maxTicks * COMPANY_TICK_MS;
  return { ticksProcessed: maxTicks, events };
}

export function computeSummary(data: CompanyData, companyType: "ai") {
  const team = computeTeamBonus(data.employees);
  return {
    companyType,
    level: data.level,
    cash: Math.round(data.cash * 100) / 100,
    employeeCount: data.employees.length,
    totalSalary: data.employees.reduce((s, e) => s + e.salary, 0),
    patents: data.patents,
    research: Math.round(data.research * 100) / 100,
    equipment: data.equipment || { gpu: 0, supercomputer: 0 },
    reputation: Math.round(data.reputation),
    unlockedProducts: data.unlockedProducts.length,
    teamSynergy: Math.round(team.synergyBonus * 100),
    teamConflict: Math.round(team.conflictPenalty * 100),
    teamLeadership: Math.round(team.leadershipBonus * 100),
    effectiveMultiplier: Math.round(team.effectiveMultiplier * 100) / 100,
    teamDetails: team.details,
    employees: data.employees.map(e => ({
      ...e,
      roleLabel: ROLE_DEFS[e.role]?.label || e.role,
    })),
    products: Object.values(data.products).map(p => {
      const def = PRODUCT_DEFS[p.id];
      return { ...p, name: def?.name || p.id, baseRevenue: def?.baseRevenue || 0 };
    }),
    revenuePerTick: (() => {
      let rev = 0;
      for (const p of Object.values(data.products)) {
        const def = PRODUCT_DEFS[p.id];
        if (!def) continue;
        rev += def.baseRevenue * data.level * p.priceMultiplier;
      }
      return Math.round(rev);
    })(),
    costPerTick: data.employees.reduce((s, e) => s + e.salary, 0),
    history: data.history.slice(0, 20),
  };
}

export function upgradeLevelCost(currentLevel: number): number {
  return currentLevel * 5000;
}

export function researchCost(): number {
  return 1000;
}

export const EQUIPMENT_COST: Record<string, number> = {
  gpu: 5_000,
  supercomputer: 50_000,
};

export { rollEmployee, STARTUP_FEE };
