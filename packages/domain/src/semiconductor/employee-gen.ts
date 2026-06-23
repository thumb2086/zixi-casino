import { ROLE_DEFS } from "./constants.js";

const TRAITS = ["積極", "創意", "嚴謹", "敏捷", "傳統", "懶散", "完美主義", "激進", "保守", "穩定"];

const TRAIT_SYNERGY: Record<string, string[]> = {
  "積極": ["積極", "創意", "敏捷"],
  "創意": ["創意", "嚴謹"],
  "嚴謹": ["嚴謹", "完美主義", "穩定"],
  "敏捷": ["敏捷", "積極"],
  "傳統": ["傳統", "保守", "穩定"],
  "懶散": ["懶散"],
  "完美主義": ["完美主義", "嚴謹", "激進"],
  "激進": ["激進", "創意", "敏捷"],
  "保守": ["保守", "傳統", "穩定"],
  "穩定": ["穩定", "保守", "嚴謹"],
};

const TRAIT_CONFLICT: Record<string, string[]> = {
  "積極": ["懶散", "保守"],
  "創意": ["傳統", "保守"],
  "嚴謹": ["懶散", "激進"],
  "敏捷": ["懶散", "傳統"],
  "傳統": ["創意", "激進"],
  "懶散": ["積極", "嚴謹", "完美主義"],
  "完美主義": ["懶散"],
  "激進": ["嚴謹", "保守", "穩定"],
  "保守": ["積極", "創意", "激進"],
  "穩定": ["激進", "創意"],
};

const SURNAMES = [
  "陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊",
  "許", "鄭", "謝", "洪", "郭", "邱", "曾", "廖", "賴", "徐",
];

const GIVEN_NAMES = [
  "志明", "淑芬", "偉強", "雅婷", "建宏", "怡君", "宗翰", "佳穎",
  "俊傑", "美玲", "冠宇", "惠雯", "家豪", "靜怡", "文彬", "佩珊",
  "建良", "雅雯", "國華", "秀英",
];

export interface SemiconductorEmployee {
  id: string;
  name: string;
  role: string;
  productivity: number;
  leadership: number;
  salary: number;
  traits: string[];
  hiredAt: number;
}

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let h = fnv1a32(seed);
  return () => {
    h = Math.imul(h, 0x01000193) >>> 0;
    return (h % 1000000) / 1000000;
  };
}

function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2);
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

let employeeCounter = Date.now();

export function rollEmployee(): SemiconductorEmployee {
  employeeCounter++;
  const seed = `semiconductor_${Date.now()}_${employeeCounter}_${Math.random()}`;
  const rng = seededRandom(seed);

  const roles = Object.keys(ROLE_DEFS);
  const role = pickRandom(roles, rng);
  const roleDef = ROLE_DEFS[role];

  const productivity = Math.max(0.5, Math.min(2.0, 1.0 + normalRandom(rng) * 0.4));
  const leadership = Math.max(0, Math.min(2.0, (rng() < 0.05 ? 1.5 + rng() * 0.5 : rng() * 0.8)));

  const salary = Math.round(roleDef.baseSalary * productivity);

  const traitCount = rng() < 0.3 ? 3 : 2;
  const shuffled = [...TRAITS].sort(() => rng() - 0.5);
  const traits = shuffled.slice(0, traitCount);

  const surname = pickRandom(SURNAMES, rng);
  const givenName = pickRandom(GIVEN_NAMES, rng);

  return {
    id: `semi_emp_${employeeCounter}_${Date.now()}`,
    name: `${surname}${givenName}`,
    role,
    productivity: Math.round(productivity * 100) / 100,
    leadership: Math.round(leadership * 100) / 100,
    salary,
    traits,
    hiredAt: 0,
  };
}

export function computeTeamBonus(employees: SemiconductorEmployee[]): {
  synergyBonus: number;
  conflictPenalty: number;
  leadershipBonus: number;
  effectiveMultiplier: number;
  details: string[];
} {
  const details: string[] = [];

  let synergyBonus = 0;
  for (let i = 0; i < employees.length; i++) {
    for (let j = i + 1; j < employees.length; j++) {
      for (const trait of employees[i].traits) {
        if (employees[j].traits.includes(trait) || (TRAIT_SYNERGY[trait]?.some(t => employees[j].traits.includes(t)))) {
          synergyBonus += 0.15;
        }
      }
    }
  }
  synergyBonus = Math.min(synergyBonus, 0.5);
  if (synergyBonus > 0) details.push(`協同加成 +${Math.round(synergyBonus * 100)}%`);

  let conflictPenalty = 0;
  for (let i = 0; i < employees.length; i++) {
    for (const trait of employees[i].traits) {
      const conflicts = TRAIT_CONFLICT[trait] || [];
      for (let j = 0; j < employees.length; j++) {
        if (i === j) continue;
        if (employees[j].traits.some(t => conflicts.includes(t))) {
          conflictPenalty += 0.10;
        }
      }
    }
  }
  if (conflictPenalty > 0) details.push(`衝突懲罰 -${Math.round(conflictPenalty * 100)}%`);

  const maxLeadership = Math.max(...employees.map(e => e.leadership), 0);
  const leadershipBonus = Math.min(maxLeadership * 0.05, 0.3);
  if (leadershipBonus > 0) details.push(`領導力加成 +${Math.round(leadershipBonus * 100)}%`);

  const effectiveMultiplier = Math.max(0.1, 1 + synergyBonus + leadershipBonus - conflictPenalty);

  return { synergyBonus, conflictPenalty, leadershipBonus, effectiveMultiplier, details };
}
