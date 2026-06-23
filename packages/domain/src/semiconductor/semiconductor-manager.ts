import {
  NODE_DEFS, NODE_PROGRESSION, CHIP_DEFS, TECH_TREE_DEFS,
  NODE_BREAKTHROUGH_REQUIREMENTS, ROLE_DEFS,
  COMPUTER_DEFS, getMaxRackSlots,
  SEMICONDUCTOR_TICK_MS, MATERIAL_COST, BANKRUPTCY_THRESHOLD,
  type NodeDef, type TechDef,
} from "./constants.js";
import { rollEmployee, computeTeamBonus, type SemiconductorEmployee } from "./employee-gen.js";

export interface ProductionStatus {
  chipId: string;
  startTime: number;
  endTime: number;
}

export interface SemiconductorData {
  version: number;
  cash: number;
  nodeId: string;
  factoryTier: number;
  employees: SemiconductorEmployee[];
  pendingHire?: SemiconductorEmployee;
  inventory: Record<string, number>;
  techTree: Record<string, number>;
  computers: string[];        // ids of assembled computers
  production: ProductionStatus | null;
  lastTickAt: number;
  history: CompanyEvent[];
}

export interface CompanyEvent {
  at: string;
  type: string;
  summary: string;
}

export interface ProductionResult {
  success: boolean;
  totalWafers: number;
  goodDies: number;
  chips: Record<string, number>;
  yieldRate: number;
  events: CompanyEvent[];
}

export interface TickResult {
  ticksProcessed: number;
  salaryCost: number;
  events: CompanyEvent[];
}

function appendHistory(data: SemiconductorData, type: string, summary: string) {
  data.history = data.history || [];
  data.history.unshift({ at: new Date().toISOString(), type, summary });
  if (data.history.length > 80) data.history.length = 80;
}

function getNodeDef(nodeId: string): NodeDef | undefined {
  return NODE_DEFS[nodeId];
}

function getTechDef(techId: string): TechDef | undefined {
  return TECH_TREE_DEFS[techId];
}

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createDefaultSemiconductorData(nodeId?: string): SemiconductorData {
  return {
    version: 1,
    cash: 0,
    nodeId: nodeId || "hand_drawn_10um",
    factoryTier: 0,
    employees: [],
    inventory: {},
    techTree: {},
    computers: [],
    production: null,
    lastTickAt: Date.now(),
    history: [],
  };
}

export function computeYield(data: SemiconductorData): number {
  const node = getNodeDef(data.nodeId);
  if (!node) return 0;

  let yieldRate = node.baseYield;

  for (const [techId, level] of Object.entries(data.techTree)) {
    const tech = getTechDef(techId);
    if (!tech || level <= 0) continue;
    const effects = tech.effect(level);
    if (effects.yieldBonus) yieldRate += effects.yieldBonus;
    if (effects.wasteReduction) yieldRate += effects.wasteReduction;
  }

  const processEngineers = data.employees.filter(e => e.role === "process_engineer");
  for (const emp of processEngineers) {
    yieldRate += 0.02 * emp.productivity;
  }

  for (const computerId of data.computers) {
    const def = COMPUTER_DEFS[computerId];
    if (def) yieldRate += def.effects.yieldBonus;
  }

  const team = computeTeamBonus(data.employees);
  yieldRate *= team.effectiveMultiplier;

  return Math.max(0.05, Math.min(0.95, yieldRate));
}

export function getProductionDuration(data: SemiconductorData): number {
  const node = getNodeDef(data.nodeId);
  if (!node) return 0;

  let duration = node.baseDurationMs;

  const fabWorkers = data.employees.filter(e => e.role === "fab_worker").length;
  duration -= fabWorkers * node.timeReductionPerWorkerMs;

  let totalReduction = 0;
  for (const computerId of data.computers) {
    const def = COMPUTER_DEFS[computerId];
    if (def) totalReduction += def.effects.durationReduction;
  }
  duration *= (1 - totalReduction);

  const minDuration = Math.max(node.baseDurationMs * 0.3, 5 * 60 * 1000);
  return Math.max(minDuration, duration);
}

export function getChipYield(data: SemiconductorData): { totalWafers: number; yieldRate: number } {
  const node = getNodeDef(data.nodeId);
  if (!node) return { totalWafers: 0, yieldRate: 0 };

  const yieldRate = computeYield(data);

  let baseOutput = node.baseOutputMin;
  const fabWorkers = data.employees.filter(e => e.role === "fab_worker");
  for (const emp of fabWorkers) {
    baseOutput += 0.5 * emp.productivity;
  }

  const chipDesigners = data.employees.filter(e => e.role === "chip_designer");
  for (const emp of chipDesigners) {
    baseOutput += 0.2 * emp.productivity;
  }

  const totalWafers = Math.max(1, Math.round(baseOutput));
  return { totalWafers, yieldRate };
}

export function settleProduction(data: SemiconductorData, seed?: string): ProductionResult {
  const node = getNodeDef(data.nodeId);
  if (!node) return { success: false, totalWafers: 0, goodDies: 0, chips: {}, yieldRate: 0, events: [] };

  const { totalWafers, yieldRate } = getChipYield(data);
  const events: CompanyEvent[] = [];

  const rngSeed = seed || `${data.nodeId}_${Date.now()}_${Math.random()}`;
  let hash = fnv1a32(rngSeed);

  let goodDies = 0;
  for (let i = 0; i < totalWafers; i++) {
    hash = fnv1a32(hash + "_" + i);
    const roll = (hash % 10000) / 10000;
    if (roll < yieldRate) goodDies++;
  }

  const chipId = node.chipProduced;
  const chips: Record<string, number> = {};
  chips[chipId] = goodDies;

  data.inventory[chipId] = (data.inventory[chipId] || 0) + goodDies;
  data.production = null;

  const wasteCount = totalWafers - goodDies;
  let summary = `本次投產 ${totalWafers} 片晶圓。良率 ${Math.round(yieldRate * 100)}%。`;
  if (goodDies > 0) {
    summary += ` 成功產出 ${CHIP_DEFS[chipId]?.name || chipId} x ${goodDies}。`;
  }
  if (wasteCount > 0) {
    summary += ` ${wasteCount} 片因${Math.random() > 0.5 ? '落塵與手抖' : '對焦不準'}報廢。`;
  }

  appendHistory(data, "production", summary);
  events.push({ at: new Date().toISOString(), type: "production", summary });

  return { success: true, totalWafers, goodDies, chips, yieldRate, events };
}

export function startProduction(data: SemiconductorData): { success: boolean; message?: string; endTime?: number } {
  if (data.production) {
    const remaining = data.production.endTime - Date.now();
    if (remaining > 0) {
      return { success: false, message: `生產進行中，剩餘 ${Math.ceil(remaining / 60000)} 分鐘` };
    }
  }

  const node = getNodeDef(data.nodeId);
  if (!node) return { success: false, message: "無效的製程節點" };

  if (data.cash < MATERIAL_COST) {
    return { success: false, message: `材料費不足，需要 ${MATERIAL_COST} ZXC` };
  }

  data.cash -= MATERIAL_COST;
  const duration = getProductionDuration(data);
  const now = Date.now();

  data.production = {
    chipId: node.chipProduced,
    startTime: now,
    endTime: now + duration,
  };

  appendHistory(data, "production_start", `開始 ${node.name} 曝光製程，預計耗時 ${Math.ceil(duration / 60000)} 分鐘`);

  return { success: true, endTime: data.production.endTime };
}

export function claimProduction(data: SemiconductorData): ProductionResult | { success: false; message: string } {
  if (!data.production) {
    return { success: false, message: "沒有進行中的生產" };
  }

  if (Date.now() < data.production.endTime) {
    const remaining = data.production.endTime - Date.now();
    return { success: false, message: `生產尚未完成，剩餘 ${Math.ceil(remaining / 60000)} 分鐘` };
  }

  const result = settleProduction(data);
  return result;
}

export function researchTech(data: SemiconductorData, techId: string): { success: boolean; message?: string; newLevel?: number } {
  const tech = getTechDef(techId);
  if (!tech) return { success: false, message: "無效的科技項目" };

  if (tech.requiredNode) {
    const currentNodeIdx = NODE_PROGRESSION.indexOf(data.nodeId);
    const requiredNodeIdx = NODE_PROGRESSION.indexOf(tech.requiredNode);
    if (currentNodeIdx < requiredNodeIdx) {
      return { success: false, message: `需要先達到 ${NODE_DEFS[tech.requiredNode]?.name || tech.requiredNode} 製程` };
    }
  }

  const currentLevel = data.techTree[techId] || 0;
  if (currentLevel >= tech.maxLevel) {
    return { success: false, message: `${tech.name} 已達最高等級` };
  }

  let cost = tech.costPerLevel;

  const researchScientists = data.employees.filter(e => e.role === "research_scientist");
  for (const emp of researchScientists) {
    cost = Math.round(cost * (1 - 0.08 * emp.productivity));
  }
  cost = Math.max(1, cost);

  if (data.cash < cost) {
    return { success: false, message: `需要 ${cost} ZXC，目前僅 ${data.cash} ZXC` };
  }

  data.cash -= cost;
  data.techTree[techId] = currentLevel + 1;

  appendHistory(data, "research", `${tech.name} 升級至 Lv.${currentLevel + 1}，花費 ${cost} ZXC`);

  return { success: true, newLevel: currentLevel + 1 };
}

export function getCraftRequirements(data: SemiconductorData): {
  available: Array<{ targetNode: string; canCraft: boolean; chipRequirements: Record<string, number>; zixiCost: number; description: string }>;
} {
  const currentNodeIdx = NODE_PROGRESSION.indexOf(data.nodeId);
  const available: Array<{ targetNode: string; canCraft: boolean; chipRequirements: Record<string, number>; zixiCost: number; description: string }> = [];

  for (const [nodeId, req] of Object.entries(NODE_BREAKTHROUGH_REQUIREMENTS)) {
    const targetIdx = NODE_PROGRESSION.indexOf(req.targetNode);
    if (targetIdx > currentNodeIdx + 1) continue;
    if (targetIdx <= currentNodeIdx) continue;

    let canCraft = true;
    for (const [chipId, qty] of Object.entries(req.chipRequirements)) {
      if ((data.inventory[chipId] || 0) < qty) {
        canCraft = false;
        break;
      }
    }
    if (data.cash < req.zixiCost) canCraft = false;

    available.push({
      targetNode: req.targetNode,
      canCraft,
      chipRequirements: req.chipRequirements,
      zixiCost: req.zixiCost,
      description: req.description,
    });
  }

  return { available };
}

export function craftBreakthrough(data: SemiconductorData, targetNode: string): { success: boolean; message?: string } {
  const currentNodeIdx = NODE_PROGRESSION.indexOf(data.nodeId);
  const targetIdx = NODE_PROGRESSION.indexOf(targetNode);
  if (targetIdx < 0) return { success: false, message: "無效的目標節點" };
  if (targetIdx <= currentNodeIdx) return { success: false, message: "目標節點已解鎖或落後" };
  if (targetIdx > currentNodeIdx + 1) return { success: false, message: "需要先解鎖中間節點" };

  const req = Object.values(NODE_BREAKTHROUGH_REQUIREMENTS).find(r => r.targetNode === targetNode);
  if (!req) return { success: false, message: "找不到突破配方" };

  for (const [chipId, qty] of Object.entries(req.chipRequirements)) {
    if ((data.inventory[chipId] || 0) < qty) {
      return { success: false, message: `需要 ${qty} 片 ${CHIP_DEFS[chipId]?.name || chipId}，庫存不足` };
    }
  }

  if (data.cash < req.zixiCost) {
    return { success: false, message: `需要 ${req.zixiCost} ZXC` };
  }

  for (const [chipId, qty] of Object.entries(req.chipRequirements)) {
    data.inventory[chipId] -= qty;
    if (data.inventory[chipId] <= 0) delete data.inventory[chipId];
  }
  data.cash -= req.zixiCost;
  data.nodeId = targetNode;

  const nodeName = NODE_DEFS[targetNode]?.name || targetNode;
  appendHistory(data, "breakthrough", `突破瓶頸！製程升級至 ${nodeName}`);

  return { success: true, message: `突破成功！製程升級至 ${nodeName}` };
}

export function getComputableList(data: SemiconductorData): Array<{
  id: string;
  name: string;
  requirements: Record<string, number>;
  effects: { durationReduction: number; yieldBonus: number };
  canAssemble: boolean;
  missing: Record<string, number>;
  description: string;
  rackSlotsUsed: number;
  rackSlotsMax: number;
  rackFull: boolean;
}> {
  const usedSlots = data.computers.length;
  const maxSlots = getMaxRackSlots(data.factoryTier);

  return Object.entries(COMPUTER_DEFS).map(([id, def]) => {
    const missing: Record<string, number> = {};
    let canAssemble = true;

    for (const [chipId, qty] of Object.entries(def.chipRequirements)) {
      const have = data.inventory[chipId] || 0;
      if (have < qty) {
        missing[chipId] = qty - have;
        canAssemble = false;
      }
    }

    const rackFull = usedSlots >= maxSlots;

    return {
      id,
      name: def.name,
      requirements: def.chipRequirements,
      effects: def.effects,
      canAssemble: canAssemble && !rackFull,
      missing,
      description: def.description,
      rackSlotsUsed: usedSlots,
      rackSlotsMax: maxSlots,
      rackFull,
    };
  });
}

export function assembleComputer(data: SemiconductorData, computerId: string): { success: boolean; message?: string } {
  const def = COMPUTER_DEFS[computerId];
  if (!def) return { success: false, message: "無效的電腦類型" };

  const usedSlots = data.computers.length;
  const maxSlots = getMaxRackSlots(data.factoryTier);
  if (usedSlots >= maxSlots) {
    return { success: false, message: `機架已滿 (${usedSlots}/${maxSlots})，需升級工廠等級` };
  }

  for (const [chipId, qty] of Object.entries(def.chipRequirements)) {
    if ((data.inventory[chipId] || 0) < qty) {
      const chipName = CHIP_DEFS[chipId]?.name || chipId;
      return { success: false, message: `需要 ${qty} 片 ${chipName}，庫存不足` };
    }
  }

  for (const [chipId, qty] of Object.entries(def.chipRequirements)) {
    data.inventory[chipId] -= qty;
    if (data.inventory[chipId] <= 0) delete data.inventory[chipId];
  }

  data.computers.push(computerId);
  appendHistory(data, "assemble", `組裝 ${def.name}，生產速度 +${Math.round(def.effects.durationReduction * 100)}%，良率 +${Math.round(def.effects.yieldBonus * 100)}%`);

  return { success: true, message: `${def.name} 組裝完成！` };
}

export function processTicks(data: SemiconductorData): TickResult {
  const now = Date.now();
  const elapsed = now - data.lastTickAt;
  if (elapsed < SEMICONDUCTOR_TICK_MS) return { ticksProcessed: 0, salaryCost: 0, events: [] };

  const ticks = Math.floor(elapsed / SEMICONDUCTOR_TICK_MS);
  if (ticks <= 0) return { ticksProcessed: 0, salaryCost: 0, events: [] };

  const maxTicks = Math.min(ticks, 100);
  const events: CompanyEvent[] = [];

  for (let t = 0; t < maxTicks; t++) {
    let salaryCost = 0;
    for (const emp of data.employees) {
      salaryCost += emp.salary;
    }

    let rentCost = 0;
    if (data.factoryTier === 0) rentCost = 1;
    else if (data.factoryTier >= 1) rentCost = 10;

    const totalCost = salaryCost + rentCost;
    data.cash -= totalCost;

    if (data.cash < BANKRUPTCY_THRESHOLD) {
      const empCount = data.employees.length;
      data.employees = [];
      data.cash = 0;
      data.nodeId = "hand_drawn_10um";
      data.factoryTier = 0;
      data.production = null;
      data.inventory = {};
      data.techTree = {};
      appendHistory(data, "bankruptcy", `破產！已遣散 ${empCount} 名員工，製程歸零`);
      return { ticksProcessed: t + 1, salaryCost: totalCost, events };
    }
  }

  data.lastTickAt += maxTicks * SEMICONDUCTOR_TICK_MS;
  return { ticksProcessed: maxTicks, salaryCost: 0, events };
}

export function computeSummary(data: SemiconductorData) {
  const node = getNodeDef(data.nodeId);
  const production = data.production;
  let productionRemainingMs = 0;
  if (production) {
    productionRemainingMs = Math.max(0, production.endTime - Date.now());
  }

  const team = computeTeamBonus(data.employees);
  const yieldRate = computeYield(data);
  const duration = getProductionDuration(data);

  const availableTechs = Object.entries(TECH_TREE_DEFS).map(([id, tech]) => {
    const currentLevel = data.techTree[id] || 0;
    const canUpgrade = currentLevel < tech.maxLevel;
    let cost = tech.costPerLevel;
    const researchScientists = data.employees.filter(e => e.role === "research_scientist");
    for (const emp of researchScientists) {
      cost = Math.round(cost * (1 - 0.08 * emp.productivity));
    }
    cost = Math.max(1, cost);
    return {
      id,
      name: tech.name,
      currentLevel,
      maxLevel: tech.maxLevel,
      cost,
      canUpgrade,
      description: tech.description,
      effect: tech.effect(currentLevel + 1),
    };
  });

  return {
    nodeId: data.nodeId,
    nodeName: node?.name || "未知",
    nodeDescription: node?.description || "",
    factoryTier: data.factoryTier,
    factoryName: data.factoryTier === 0 ? "手工工作坊" : data.factoryTier === 1 ? "黃光無塵室" : "未知",
    cash: Math.round(data.cash * 100) / 100,
    yieldRate: Math.round(yieldRate * 10000) / 100,
    productionDuration: duration,
    productionRemainingMs,
    isProducing: !!production,
    inventory: { ...data.inventory },
    employees: data.employees.map(e => ({
      ...e,
      roleLabel: ROLE_DEFS[e.role]?.label || e.role,
    })),
    employeeCount: data.employees.length,
    totalSalary: data.employees.reduce((s, e) => s + e.salary, 0),
    techTree: availableTechs,
    computers: data.computers.map(id => {
      const def = COMPUTER_DEFS[id];
      return def ? { id, name: def.name, effects: def.effects } : { id, name: "未知", effects: { durationReduction: 0, yieldBonus: 0 } };
    }),
    rackSlotsUsed: data.computers.length,
    rackSlotsMax: getMaxRackSlots(data.factoryTier),
    computable: getComputableList(data),
    teamSynergy: Math.round(team.synergyBonus * 100),
    teamConflict: Math.round(team.conflictPenalty * 100),
    teamLeadership: Math.round(team.leadershipBonus * 100),
    effectiveMultiplier: Math.round(team.effectiveMultiplier * 100) / 100,
    teamDetails: team.details,
    history: data.history.slice(0, 20),
    breakthroughOptions: getCraftRequirements(data).available,
  };
}
