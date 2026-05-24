// packages/domain/src/rewards/reward-manager.ts

import { LEVEL_TIERS } from "@repo/shared";

export interface RewardTitle {
  id: string;
  label: string;
  description: string;
  requirement: string;
    rarity: "common" | "rare" | "epic" | "legendary" | "mythic" | "chaos" | "abyss" | "oracle";
}

const MEMBER_RARITY: Record<number, string> = {
  1: "common", 2: "common",
  3: "rare",
  4: "epic", 5: "epic", 6: "epic",
  7: "legendary", 8: "legendary", 9: "legendary", 10: "legendary",
  11: "legendary", 12: "legendary", 13: "legendary", 14: "legendary", 15: "legendary", 16: "legendary",
};

export const TITLES: RewardTitle[] = [
  { id: "title_newbie", label: "新手", description: "剛加入的新手", requirement: "註冊即可獲得", rarity: "common" },
  { id: "title_beginner", label: "初心者", description: "邁出第一步的初心者", requirement: "註冊即可獲得", rarity: "common" },
  { id: "title_gambler", label: "賭徒", description: "喜歡下注的賭徒", requirement: "首次下注", rarity: "rare" },
  { id: "title_highroller", label: "大戶", description: "下注額度極高的大戶", requirement: "單次下注 > 1M", rarity: "epic" },
  { id: "title_god", label: "賭神", description: "賭術已達神之領域", requirement: "總收益 > 100M", rarity: "mythic" },
];

// Add 32 member tier titles from LEVEL_TIERS
for (let i = 0; i < LEVEL_TIERS.length; i++) {
  const tier = LEVEL_TIERS[i];
  const level = i + 1;
  const rarity = MEMBER_RARITY[level] || "mythic";
  TITLES.push({
    id: `title_member_${level}`,
    label: tier.label,
    description: `累積押注達 ${tier.threshold.toLocaleString()} 子熙幣`,
    requirement: `totalBet >= ${tier.threshold}`,
    rarity: rarity as any,
  });
}

export class RewardManager {
  getAvailableTitles(): RewardTitle[] {
    return TITLES;
  }

  checkTitleUnlock(userId: string, stats: any, xpLevel?: number): string[] {
    const unlocked: string[] = [];
    if (stats.totalBet > 1000000) unlocked.push("title_highroller");
    if (stats.totalWin > 100000000) unlocked.push("title_god");

    // XP-level → LEVEL_TIERS index mapping (mirrors vip-manager.ts getLevelByXpLevel)
    const xpToTierIndex: number[] = [
      0, 0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
      9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
      16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 22, 23,
      24, 25, 26, 27, 28, 29, 30, 30,
    ];
    const tierIndex = xpLevel && xpLevel < xpToTierIndex.length ? xpToTierIndex[xpLevel] : -1;

    // Member tier titles: use XP-based tier if higher than totalBet-based
    for (let i = 0; i < LEVEL_TIERS.length; i++) {
      if (stats.totalBet >= LEVEL_TIERS[i].threshold || (tierIndex >= 0 && i <= tierIndex)) {
        unlocked.push(`title_member_${i + 1}`);
      }
    }

    return unlocked;
  }

  getAvailableAvatars(): any[] {
    return [];
  }

  openChest(chestType: string, seed: string): any {
    return { items: [], currency: "0" };
  }
}
