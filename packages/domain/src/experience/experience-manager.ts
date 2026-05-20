interface ActiveBuff {
  id: string;
  type: string;
  value: number;
  remaining?: number;
  expiresAt?: string | null;
  source?: string;
}

const XP_PER_ZXC = 1;
const LEVEL_BASE_XP = 1000;
const LEVEL_SCALE = 1.5;

export interface XpGrantResult {
  xpGained: number;
  multiplier: number;
  totalXp: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Calculate XP required for a given level.
 * Level 1: 0 XP. Level 2: 1000 XP. Level 3: 2500 XP. etc.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(LEVEL_BASE_XP * Math.pow(LEVEL_SCALE, i - 1));
  }
  return total;
}

/**
 * Calculate the effective XP multiplier from active xp_boost buffs.
 * Returns the highest active multiplier (e.g. 2 for 2x).
 */
export function getActiveXpMultiplier(activeBuffs: ActiveBuff[]): number {
  const now = Date.now();
  let maxMult = 1;
  for (const buff of activeBuffs) {
    if (buff.type !== "xp_boost") continue;
    if (buff.expiresAt && new Date(buff.expiresAt).getTime() < now) continue;
    maxMult = Math.max(maxMult, buff.value);
  }
  return maxMult;
}

/**
 * Grant XP based on bet amount, applying active buff multipliers.
 * Returns the full result including any level-up.
 */
export function grantXp(
  currentXp: number,
  currentLevel: number,
  betAmount: number,
  activeBuffs: ActiveBuff[],
): XpGrantResult {
  const baseXp = Math.floor(betAmount * XP_PER_ZXC);
  const multiplier = getActiveXpMultiplier(activeBuffs);
  const xpGained = Math.floor(baseXp * multiplier);

  let totalXp = currentXp + xpGained;
  let newLevel = currentLevel;
  let leveledUp = false;

  while (totalXp >= xpForLevel(newLevel + 1)) {
    newLevel++;
    leveledUp = true;
  }

  return { xpGained, multiplier, totalXp, newLevel, leveledUp };
}
