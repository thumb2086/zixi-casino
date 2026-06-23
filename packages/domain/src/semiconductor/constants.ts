export const SEMICONDUCTOR_TICK_MS = 30_000;
export const STARTUP_FEE = 1000;
export const MATERIAL_COST = 50;
export const BANKRUPTCY_THRESHOLD = -5000;

export interface NodeDef {
  id: string;
  name: string;
  baseYield: number;
  baseOutputMin: number;
  baseOutputMax: number;
  baseDurationMs: number;
  timeReductionPerWorkerMs: number;
  chipProduced: string;
  description: string;
}

export const NODE_DEFS: Record<string, NodeDef> = {
  hand_drawn_10um: {
    id: "hand_drawn_10um",
    name: "手繪 10μm",
    baseYield: 0.23,
    baseOutputMin: 3,
    baseOutputMax: 8,
    baseDurationMs: 4 * 60 * 60 * 1000,
    timeReductionPerWorkerMs: 30 * 60 * 1000,
    chipProduced: "zixi_4004",
    description: "工程師趴在繪圖桌上，用美工刀手工割製 10微米 電路紅膠膜",
  },
  hand_drawn_5um: {
    id: "hand_drawn_5um",
    name: "手繪 5μm",
    baseYield: 0.28,
    baseOutputMin: 2,
    baseOutputMax: 6,
    baseDurationMs: 2 * 60 * 60 * 1000,
    timeReductionPerWorkerMs: 15 * 60 * 1000,
    chipProduced: "zixi_8086",
    description: "工程師使用改良的縮小相機進行 5微米 曝光製程",
  },
  yellow_room_g_line: {
    id: "yellow_room_g_line",
    name: "黃光 G-line",
    baseYield: 0.35,
    baseOutputMin: 2,
    baseOutputMax: 5,
    baseDurationMs: 45 * 60 * 1000,
    timeReductionPerWorkerMs: 5 * 60 * 1000,
    chipProduced: "zixi_486",
    description: "啟用黃光無塵室，使用水銀燈 G-line 光源進行接觸式曝光",
  },
};

export const NODE_PROGRESSION: string[] = [
  "hand_drawn_10um",
  "hand_drawn_5um",
  "yellow_room_g_line",
];

export interface ChipDef {
  id: string;
  name: string;
  baseValue: number;
  description: string;
}

export const CHIP_DEFS: Record<string, ChipDef> = {
  zixi_4004: {
    id: "zixi_4004",
    name: "子熙-4004",
    baseValue: 30,
    description: "4 位元中央處理器，2300 個電晶體，10μm 製程",
  },
  zixi_8086: {
    id: "zixi_8086",
    name: "子熙-8086",
    baseValue: 100,
    description: "16 位元微處理器，29000 個電晶體，5μm 製程",
  },
  zixi_486: {
    id: "zixi_486",
    name: "子熙-486",
    baseValue: 500,
    description: "32 位元微處理器，120 萬個電晶體，G-line 製程",
  },
};

export interface TechDef {
  id: string;
  name: string;
  maxLevel: number;
  costPerLevel: number;
  effect: (level: number) => Partial<{
    yieldBonus: number;
    wasteReduction: number;
    outputBonus: number;
  }>;
  description: string;
  requiredNode?: string;
}

export const TECH_TREE_DEFS: Record<string, TechDef> = {
  blade_quality: {
    id: "blade_quality",
    name: "優化鎢鋼刀片",
    maxLevel: 3,
    costPerLevel: 800,
    effect: (level) => ({ yieldBonus: 0.03 * level }),
    description: "換上更硬的工業級美工刀片，切割更精準",
  },
  air_filtration: {
    id: "air_filtration",
    name: "加裝排風扇",
    maxLevel: 1,
    costPerLevel: 1500,
    effect: (level) => ({ wasteReduction: 0.05 * level }),
    description: "減少工程師頭皮屑掉在膠膜上的悲劇",
  },
  camera_lens: {
    id: "camera_lens",
    name: "改進大相機鏡頭",
    maxLevel: 2,
    costPerLevel: 3000,
    effect: (level) => {
      if (level >= 2) return { yieldBonus: 0.02 };
      return {};
    },
    description: "訂購更高倍率的光學縮小顯微鏡頭",
  },
  exposure_accuracy: {
    id: "exposure_accuracy",
    name: "曝光對準精度",
    maxLevel: 2,
    costPerLevel: 2000,
    effect: (level) => ({ yieldBonus: 0.02 * level }),
    description: "改良光罩對準機構，減少套疊誤差",
    requiredNode: "yellow_room_g_line",
  },
};

export interface RoleDef {
  role: string;
  label: string;
  labelEn: string;
  baseSalary: number;
  description: string;
}

export const ROLE_DEFS: Record<string, RoleDef> = {
  fab_worker: {
    role: "fab_worker",
    label: "晶圓作業員",
    labelEn: "Fab Worker",
    baseSalary: 3,
    description: "操作曝光設備、搬運晶圓，直接縮短生產時間",
  },
  process_engineer: {
    role: "process_engineer",
    label: "製程工程師",
    labelEn: "Process Engineer",
    baseSalary: 5,
    description: "優化製程參數，提升生產良率",
  },
  chip_designer: {
    role: "chip_designer",
    label: "晶片設計師",
    labelEn: "Chip Designer",
    baseSalary: 6,
    description: "設計電路佈局，加速研發推進",
  },
  research_scientist: {
    role: "research_scientist",
    label: "研究科學家",
    labelEn: "Research Scientist",
    baseSalary: 8,
    description: "突破技術瓶頸，降低研發成本",
  },
};

export const NODE_BREAKTHROUGH_REQUIREMENTS: Record<string, {
  targetNode: string;
  chipRequirements: Record<string, number>;
  zixiCost: number;
  description: string;
}> = {
  hand_drawn_5um: {
    targetNode: "hand_drawn_5um",
    chipRequirements: { zixi_4004: 10 },
    zixiCost: 5000,
    description: "組裝初階計算機：消耗 10 片子熙-4004 與 5,000 ZXC，解鎖 5μm 製程",
  },
  yellow_room_g_line: {
    targetNode: "yellow_room_g_line",
    chipRequirements: { zixi_8086: 8 },
    zixiCost: 20000,
    description: "微處理器架構革新：消耗 8 片子熙-8086 與 20,000 ZXC，解鎖黃光室",
  },
};

export const FACTORY_TIER_NAMES: Record<number, string> = {
  0: "手工工作坊",
  1: "黃光無塵室",
};

export interface ComputerDef {
  id: string;
  name: string;
  chipRequirements: Record<string, number>;
  effects: {
    durationReduction: number;
    yieldBonus: number;
  };
  description: string;
}

export const COMPUTER_DEFS: Record<string, ComputerDef> = {
  basic_computer: {
    id: "basic_computer",
    name: "初階計算機",
    chipRequirements: { zixi_4004: 5 },
    effects: { durationReduction: 0.10, yieldBonus: 0 },
    description: "第一台能輔助計算的機器，稍微加快生產流程",
  },
  gen2_computer: {
    id: "gen2_computer",
    name: "第二代計算機",
    chipRequirements: { zixi_8086: 3 },
    effects: { durationReduction: 0.15, yieldBonus: 0.03 },
    description: "更快的計算輔助，同時提升曝光參數計算精度",
  },
  workstation: {
    id: "workstation",
    name: "工作站",
    chipRequirements: { zixi_486: 2 },
    effects: { durationReduction: 0.20, yieldBonus: 0.05 },
    description: "專業級工程工作站，大幅優化生產效率",
  },
};

export function getMaxRackSlots(factoryTier: number): number {
  return factoryTier * 3 + 1;
}
