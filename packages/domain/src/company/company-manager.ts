import { rollEmployee, computeTeamBonus, type Employee, ROLE_DEFS } from "./employee-gen.js";

const COMPANY_TICK_MS = 30_000;
const STARTUP_FEE = 1000;

export interface ProductDef {
  id: string;
  name: string;
  unlockedBy: string; // condition description
  baseRevenue: number;
  aiOnly?: boolean;
  chipOnly?: boolean;
}

export const PRODUCT_DEFS: Record<string, ProductDef> = {
  chatbot_api:   { id: "chatbot_api",   name: "ChatBot API",        unlockedBy: "初始自帶",  baseRevenue: 10, aiOnly: true },
  image_gen:     { id: "image_gen",     name: "圖片生成器",         unlockedBy: "2 工程師",   baseRevenue: 25, aiOnly: true },
  enterprise_ai: { id: "enterprise_ai", name: "企業 AI 套件",       unlockedBy: "3 研究員+1專利", baseRevenue: 100, aiOnly: true },
  processor:     { id: "processor",     name: "處理器晶片",         unlockedBy: "初始自帶",  baseRevenue: 15, chipOnly: true },
  memory_chip:   { id: "memory_chip",   name: "記憶體晶片",         unlockedBy: "fabLevel≥3", baseRevenue: 35, chipOnly: true },
  custom_asic:   { id: "custom_asic",   name: "客製化 ASIC",       unlockedBy: "2 專利",     baseRevenue: 120, chipOnly: true },
};

export interface Product {
  id: string;
  priceMultiplier: number; // 0.3 - 5.0 user-set
  unlockedAt: number;      // epoch ms
}

export interface CompanyData {
  version: number;
  cash: number;            // internal operating cash
  level: number;
  research: number;        // 0-100 accumulated research progress
  patents: number;
  employees: Employee[];
  products: Record<string, Product>;
  unlockedProducts: string[];
  fabLevel: number;        // chip only
  reputation: number;      // 0-100
  lastTickAt: number;      // epoch ms
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

export function createDefaultCompany(companyType: "ai" | "chip", companyName: string): CompanyData {
  const defaultProducts: Record<string, Product> = {};
  const unlocked: string[] = [];
  for (const [id, def] of Object.entries(PRODUCT_DEFS)) {
    if (def.unlockedBy === "初始自帶" && !def.chipOnly === (companyType === "ai")) {
      // For AI: chatbot_api; for Chip: processor
      if ((companyType === "ai" && def.aiOnly) || (companyType === "chip" && def.chipOnly)) {
        defaultProducts[id] = { id, priceMultiplier: 1.0, unlockedAt: Date.now() };
        unlocked.push(id);
      }
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
    fabLevel: 1,
    reputation: 50,
    lastTickAt: Date.now(),
    history: [],
    equipment: { gpu: 0, supercomputer: 0 },
  };
}

export function getAvailableRoles(companyType: "ai" | "chip"): string[] {
  return companyType === "ai"
    ? ["data_scientist", "engineer", "researcher"]
    : ["chip_designer", "process_engineer", "materials_scientist"];
}

export function checkUnlocks(data: CompanyData, companyType: "ai" | "chip"): void {
  const engCount = data.employees.filter(e => e.role === "engineer").length;
  const resCount = data.employees.filter(e => e.role === "researcher").length;

  if (!data.unlockedProducts.includes("image_gen") && companyType === "ai" && engCount >= 2) {
    data.products["image_gen"] = { id: "image_gen", priceMultiplier: 1.0, unlockedAt: Date.now() };
    data.unlockedProducts.push("image_gen");
    appendHistory(data, "unlock", "解鎖新產品：圖片生成器");
  }
  if (!data.unlockedProducts.includes("enterprise_ai") && companyType === "ai" && resCount >= 3 && data.patents >= 1) {
    data.products["enterprise_ai"] = { id: "enterprise_ai", priceMultiplier: 1.0, unlockedAt: Date.now() };
    data.unlockedProducts.push("enterprise_ai");
    appendHistory(data, "unlock", "解鎖新產品：企業 AI 套件");
  }
  if (!data.unlockedProducts.includes("memory_chip") && companyType === "chip" && data.fabLevel >= 3) {
    data.products["memory_chip"] = { id: "memory_chip", priceMultiplier: 1.0, unlockedAt: Date.now() };
    data.unlockedProducts.push("memory_chip");
    appendHistory(data, "unlock", "解鎖新產品：記憶體晶片");
  }
  if (!data.unlockedProducts.includes("custom_asic") && companyType === "chip" && data.patents >= 2) {
    data.products["custom_asic"] = { id: "custom_asic", priceMultiplier: 1.0, unlockedAt: Date.now() };
    data.unlockedProducts.push("custom_asic");
    appendHistory(data, "unlock", "解鎖新產品：客製化 ASIC");
  }
}

export function processTicks(data: CompanyData, companyType: "ai" | "chip"): { ticksProcessed: number; events: CompanyEvent[] } {
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

    // Pay salaries
    let salaryCost = 0;
    for (const emp of data.employees) {
      salaryCost += emp.salary;
    }
    data.cash -= salaryCost;

    // Product revenue
    let revenue = 0;
    for (const [prodId, product] of Object.entries(data.products)) {
      const def = PRODUCT_DEFS[prodId];
      if (!def) continue;
      // Quality multiplier based on relevant employees
      const relRoles = companyType === "ai"
        ? ["data_scientist", "engineer"]
        : ["chip_designer", "process_engineer"];
      const relEmps = data.employees.filter(e => relRoles.includes(e.role));
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

    // Research progress (equipment adds multiplicative bonus)
    const engCount = data.employees.filter(e => e.role === "engineer" || e.role === "chip_designer" || e.role === "materials_scientist").length;
    const equip = data.equipment || { gpu: 0, supercomputer: 0 };
    const equipMult = 1 + equip.gpu * 0.5 + equip.supercomputer * 2;
    data.research = Math.min(100, data.research + engCount * 0.1 * teamMult * equipMult);

    // Every 100 research → patent
    if (data.research >= 100) {
      data.patents++;
      data.research = 0;
      appendHistory(data, "patent", `獲得專利！共 ${data.patents} 項專利`);
      checkUnlocks(data, companyType);
    }

    // Reputation drift toward 50
    if (data.reputation > 55) data.reputation -= 0.1;
    else if (data.reputation < 45) data.reputation += 0.1;

    // Bankruptcy check
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

export function computeSummary(data: CompanyData, companyType: "ai" | "chip") {
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
    fabLevel: data.fabLevel,
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

export function upgradeFabCost(currentFabLevel: number): number {
  return currentFabLevel * 10000;
}

export function researchCost(): number {
  return 1000;
}

export const EQUIPMENT_COST: Record<string, number> = {
  gpu: 5_000,
  supercomputer: 50_000,
};

export { rollEmployee, STARTUP_FEE };
