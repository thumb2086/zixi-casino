const FIRST_NAMES = ["小陳","阿豪","大偉","佳穎","怡君","志明","淑芬","建宏","雅婷","文彬","美玲","宗翰","婉如","宜臻","俊傑","詩涵","冠宇","品萱","柏翰","子晴"];
const LAST_NAMES = ["李","王","張","劉","陳","楊","趙","黃","周","吳","徐","孫","馬","胡","林","郭","何","高","羅","梁"];

const TRAITS = ["積極","創意","嚴謹","敏捷","傳統","懶散","完美主義","激進","保守","穩定"];

// synergy: same trait → bonus; conflict: this trait → -10% for other with same trait
const TRAIT_SYNERGY: Record<string, string[]> = {
  "積極": ["積極","敏捷"],
  "創意": ["創意","完美主義"],
  "嚴謹": ["嚴謹","穩定"],
  "敏捷": ["敏捷","積極"],
  "傳統": ["傳統","保守"],
  "懶散": ["創意"],
  "完美主義": ["完美主義","嚴謹"],
  "激進": ["激進","積極"],
  "保守": ["保守","傳統"],
  "穩定": ["穩定","嚴謹"],
};

const TRAIT_CONFLICT: Record<string, string[]> = {
  "嚴謹": ["懶散","激進"],
  "懶散": ["嚴謹","完美主義"],
  "激進": ["保守","穩定"],
  "保守": ["激進","創意"],
  "完美主義": ["懶散","傳統"],
  "傳統": ["完美主義","敏捷"],
};

export interface Employee {
  id: string;
  name: string;
  role: string;
  productivity: number;    // 0.5 - 2.0, normal distribution around 1.0
  leadership: number;      // 0.0 - 2.0, 5% chance > 1.5
  salary: number;          // per tick in ZXC
  traits: string[];        // 2-3 traits
  hiredAt: number;         // epoch ms
}

export const ROLE_DEFS: Record<string, { label: string; baseSalary: number; desc: string }> = {
  data_scientist: { label: "資料科學家", baseSalary: 5, desc: "提升模型準確度、產品品質" },
  engineer:       { label: "工程師",     baseSalary: 3, desc: "產品開發速度、營收加成" },
  researcher:     { label: "研究員",     baseSalary: 8, desc: "解鎖專利、新產品研發" },
};

// Box-Muller for normal distribution
function normalRandom(mean = 0, std = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function rollEmployee(companyType?: "ai"): Employee {
  const rolePool = ["data_scientist", "engineer", "researcher"];

  const role = rolePool[Math.floor(Math.random() * rolePool.length)];
  const def = ROLE_DEFS[role];
  const rawProd = 0.7 + normalRandom(0, 0.3);
  const productivity = clamp(Math.round(rawProd * 100) / 100, 0.5, 2.0);

  // Leadership: 5% chance of > 1.5
  const rawLead = Math.random() < 0.05 ? 1.3 + Math.random() * 0.7 : Math.random() * 0.8;
  const leadership = clamp(Math.round(rawLead * 100) / 100, 0, 2.0);

  const salary = Math.round(def.baseSalary * productivity);

  // 2-3 random traits
  const shuffled = [...TRAITS].sort(() => Math.random() - 0.5);
  const traitCount = Math.random() < 0.3 ? 3 : 2;
  const traits = shuffled.slice(0, traitCount);

  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

  return {
    id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: lastName + firstName,
    role,
    productivity,
    leadership,
    salary,
    traits,
    hiredAt: Date.now(),
  };
}

export function computeTeamBonus(employees: Employee[]): {
  synergyBonus: number;   // 0.0 - 0.5
  conflictPenalty: number; // 0.0 - 1.0+
  leadershipBonus: number; // 0.0 - 0.3
  effectiveMultiplier: number; // final multiplier for each employee
  details: string[];
} {
 const details: string[] = [];
  let synergyBonus = 0;
  let conflictPenalty = 0;

  // Synergy: same trait → +15% each
  for (let i = 0; i < employees.length; i++) {
    for (let j = i + 1; j < employees.length; j++) {
      for (const t of employees[i].traits) {
        if (employees[j].traits.includes(t)) {
          synergyBonus += 0.15;
          details.push(`${employees[i].name} + ${employees[j].name} 「${t}」協同 +15%`);
        }
      }
    }
  }

  // Conflict: A.trait conflict matches B.trait → B -10%
  for (let i = 0; i < employees.length; i++) {
    for (let j = 0; j < employees.length; j++) {
      if (i === j) continue;
      for (const t of employees[i].traits) {
        const conflicts = TRAIT_CONFLICT[t] || [];
        for (const ct of conflicts) {
          if (employees[j].traits.includes(ct)) {
            conflictPenalty += 0.10;
            details.push(`${employees[j].name} 「${ct}」與 ${employees[i].name}「${t}」衝突 -10%`);
          }
        }
      }
    }
  }

  // Leadership: highest leader in team gives bonus to all
  const maxLeadership = Math.max(...employees.map(e => e.leadership));
  const leadershipBonus = Math.min(maxLeadership * 0.05, 0.3);

  const cappedSynergy = Math.min(synergyBonus, 0.5);
  const effectiveMultiplier = 1 + cappedSynergy + leadershipBonus - conflictPenalty;

  return {
    synergyBonus: cappedSynergy,
    conflictPenalty,
    leadershipBonus,
    effectiveMultiplier: Math.max(0.1, effectiveMultiplier),
    details,
  };
}
