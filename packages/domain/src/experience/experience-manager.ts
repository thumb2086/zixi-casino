interface ActiveBuff {
  id: string;
  type: string;
  value: number;
  remaining?: number;
  expiresAt?: string | null;
  source?: string;
}

const XP_FOR_LEVEL: number[] = [
  0,                                 // index 0 unused
  0,                                 // Lv.1
  10_000,                            // Lv.2
  30_000,                            // Lv.3
  100_000,                           // Lv.4
  300_000,                           // Lv.5
  600_000,                           // Lv.6
  1_000_000,                         // Lv.7
  2_000_000,                         // Lv.8
  4_000_000,                         // Lv.9
  8_000_000,                         // Lv.10
  15_000_000,                        // Lv.11
  30_000_000,                        // Lv.12
  50_000_000,                        // Lv.13
  80_000_000,                        // Lv.14
  150_000_000,                       // Lv.15
  250_000_000,                       // Lv.16
  400_000_000,                       // Lv.17
  600_000_000,                       // Lv.18
  900_000_000,                       // Lv.19
  1_500_000_000,                     // Lv.20
  2_500_000_000,                     // Lv.21
  4_000_000_000,                     // Lv.22
  6_000_000_000,                     // Lv.23
  9_000_000_000,                     // Lv.24
  15_000_000_000,                    // Lv.25
  25_000_000_000,                    // Lv.26
  40_000_000_000,                    // Lv.27
  60_000_000_000,                    // Lv.28
  90_000_000_000,                    // Lv.29
  150_000_000_000,                   // Lv.30
  250_000_000_000,                   // Lv.31
  400_000_000_000,                   // Lv.32
  650_000_000_000,                   // Lv.33
  1_000_000_000_000,                 // Lv.34 神諭 (1兆)
  1_500_000_000_000,                 // Lv.35
  2_500_000_000_000,                 // Lv.36
  4_000_000_000_000,                 // Lv.37
  6_500_000_000_000,                 // Lv.38
  10_000_000_000_000,                // Lv.39
  16_000_000_000_000,                // Lv.40
  25_000_000_000_000,                // Lv.41
  40_000_000_000_000,                // Lv.42
  65_000_000_000_000,                // Lv.43
  100_000_000_000_000,               // Lv.44
  160_000_000_000_000,               // Lv.45
  250_000_000_000_000,               // Lv.46
  400_000_000_000_000,               // Lv.47
  650_000_000_000_000,               // Lv.48
  850_000_000_000_000,               // Lv.49
  1_000_000_000_000_000,             // Lv.50 神諭九階 (1000兆)
];

const MAX_LEVEL = XP_FOR_LEVEL.length - 1; // 50

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return Infinity;
  return XP_FOR_LEVEL[level];
}

export function levelForXp(totalXp: number): number {
  for (let lv = MAX_LEVEL; lv >= 1; lv--) {
    if (totalXp >= XP_FOR_LEVEL[lv]) return lv;
  }
  return 1;
}

export function getXpTierLabel(level: number): string {
  if (level <= 2) return '普通會員';
  if (level <= 4) return '青銅會員';
  if (level <= 7) return '白銀會員';
  if (level <= 10) return '黃金會員';
  if (level <= 13) return '白金會員';
  if (level <= 16) return '鑽石等級';
  if (level <= 19) return '黑鑽等級';
  if (level <= 21) return '菁英等級';
  if (level <= 23) return '宗師等級';
  if (level <= 25) return '王者等級';
  if (level <= 27) return '至尊等級';
  if (level <= 29) return '蒼穹等級';
  if (level <= 31) return '寰宇等級';
  if (level <= 33) return '星穹等級';
  if (level <= 34) return '神諭等級';
  if (level <= 36) return '神諭一階';
  if (level <= 38) return '神諭二階';
  if (level <= 40) return '神諭三階';
  if (level <= 42) return '神諭四階';
  if (level <= 44) return '神諭五階';
  if (level <= 46) return '神諭六階';
  if (level <= 48) return '神諭七階';
  if (level <= 49) return '神諭八階';
  return '神諭九階';
}

function getItemXpBonus(activeBuffs: ActiveBuff[]): number {
  const now = Date.now();
  let maxMult = 1;
  for (const buff of activeBuffs) {
    if (buff.type !== "xp_boost") continue;
    if (buff.expiresAt && new Date(buff.expiresAt).getTime() < now) continue;
    maxMult = Math.max(maxMult, buff.value);
  }
  return maxMult - 1;
}

export function getVipXpBonus(dailyBonusMultiplier: number): number {
  return dailyBonusMultiplier - 1;
}

export interface XpGrantResult {
  xpGained: number;
  multiplier: number;
  itemBonus: number;
  vipBonus: number;
  eventBonus: number;
  totalXp: number;
  newLevel: number;
  leveledUp: boolean;
}

export function grantXp(
  currentXp: number,
  currentLevel: number,
  betAmount: number,
  activeBuffs: ActiveBuff[],
  vipDailyBonusMult: number = 1,
  eventBonus: number = 0,
): XpGrantResult {
  const baseXp = Math.floor(betAmount);
  const itemBonus = getItemXpBonus(activeBuffs);
  const vipBonus = getVipXpBonus(vipDailyBonusMult);
  const multiplier = 1 + itemBonus + vipBonus + eventBonus;
  const xpGained = Math.floor(baseXp * multiplier);

  const totalXp = currentXp + xpGained;
  const newLevel = levelForXp(totalXp);
  const leveledUp = newLevel > currentLevel;

  return { xpGained, multiplier, itemBonus, vipBonus, eventBonus, totalXp, newLevel, leveledUp };
}
