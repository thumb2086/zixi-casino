// packages/domain/src/levels/vip-manager.ts
import { eq, and } from "drizzle-orm";
import { LEVEL_TIERS, LevelTier, YJC_VIP_TIERS, YjcVipTier } from "@repo/shared";
import * as schema from "@repo/infrastructure/db/schema.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { ChainClient } from "@repo/infrastructure";
import { OnchainWalletManager } from "../wallet/onchain-wallet-manager.js";

export interface VipFullStatus {
  address: string;
  score: number;         // VIP score = weighted combination of total_bets + YJC holdings
  totalBetAll: number;   // Total site bets
  yjcBalance: number;    // YJC token balance
  level: LevelTier;
  nextLevel: LevelTier | null;
  progressPct: number;   // Progress to next level 0-100
  yjcVipTier: YjcVipTier; // YJC VIP tier (separate from level)
  privileges: {
    dailyBonusMultiplier: number;
    marketFeeDiscount: number;
    danmakuColor: string;
    danmakuPriority: number;
  };
}

export class VipManager {
  private onchainWallet = new OnchainWalletManager();

  // Helper to get DB connection lazily
  private async getDb() {
    return await requireDb();
  }

  private async resolveYjcBalance(db: any, address: string): Promise<number> {
    const addr = address.toLowerCase();
    const yjcRow = await db
      .select({ balance: schema.walletAccounts.balance })
      .from(schema.walletAccounts)
      .where(
        and(
          eq(schema.walletAccounts.address, addr),
          eq(schema.walletAccounts.token, "yjc")
        )
      )
      .limit(1);
    const dbBalance = Number(yjcRow[0]?.balance ?? 0);

    // Try on-chain balance; if available and differs from DB, sync DB
    try {
      const runtime = this.onchainWallet.getRuntimeConfig();
      const yjcRuntime = runtime.tokens.yjc;
      if (!runtime.rpcUrl || !runtime.adminPrivateKey || !yjcRuntime?.enabled) {
        return dbBalance;
      }

      const client = new ChainClient(runtime.rpcUrl, runtime.adminPrivateKey);
      const decimals = await client.getDecimals(yjcRuntime.contractAddress, 18);
      const raw = await client.getBalance(addr, yjcRuntime.contractAddress);
      const onchainBalance = Number(client.formatUnits(raw, decimals));
      if (!Number.isFinite(onchainBalance)) {
        return dbBalance;
      }

      // Sync on-chain balance to DB only if on-chain has real tokens (ignore 0 when DB has value)
      if (onchainBalance > 0 && onchainBalance !== dbBalance) {
        try {
          const userRow = await db
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.address, addr))
            .limit(1);
          if (userRow[0]?.id) {
            await db
              .insert(schema.walletAccounts)
              .values({
                userId: userRow[0].id,
                address: addr,
                token: "yjc",
                balance: String(onchainBalance),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [schema.walletAccounts.address, schema.walletAccounts.token],
                set: { balance: String(onchainBalance), updatedAt: new Date() },
              });
          }
        } catch {
          // DB sync failure is non-fatal
        }
      }

      return onchainBalance > 0 ? onchainBalance : dbBalance;
    } catch {
      return dbBalance;
    }
  }

  // Get VIP tier by total bet amount
  private getVipTierByScore(score: number): LevelTier {
    // Find from highest to lowest threshold
    for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
      if (score >= LEVEL_TIERS[i].threshold) {
        return LEVEL_TIERS[i];
      }
    }
    return LEVEL_TIERS[0];
  }

  private getLevelByTotalBet(totalBetAll: number): LevelTier {
    for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
      if (totalBetAll >= LEVEL_TIERS[i].threshold) {
        return LEVEL_TIERS[i];
      }
    }
    return LEVEL_TIERS[0];
  }

  // Get next level
  private getNextLevel(currentLevel: LevelTier): LevelTier | null {
    const currentIndex = LEVEL_TIERS.findIndex((t) => t.label === currentLevel.label);
    return LEVEL_TIERS[currentIndex + 1] ?? null;
  }

  // Map XP level → LEVEL_TIERS index (merge XP system with membership)
  private getLevelByXpLevel(xpLevel: number): LevelTier {
    const map: number[] = [
      0, 0,  // Lv.1-2  → 普通會員
      1,     // Lv.3    → 青銅會員
      2,     // Lv.4    → 白銀會員
      3,     // Lv.5    → 黃金會員
      4,     // Lv.6    → 白金會員
      5, 5,  // Lv.7-8  → 鑽石等級
      6, 6,  // Lv.9-10 → 黑鑽等級
      7, 7,  // Lv.11-12→ 菁英等級
      8, 8,  // Lv.13-14→ 宗師等級
      9, 9,  // Lv.15-16→ 王者等級
      10, 10,// Lv.17-18→ 至尊等級
      11, 11,// Lv.19-20→ 蒼穹等級
      12, 12,// Lv.21-22→ 寰宇等級
      13, 13,// Lv.23-24→ 星穹等級
      14, 14,// Lv.25-26→ 萬界等級
      15, 15,// Lv.27-28→ 創世等級
      16, 16,// Lv.29-30→ 永恆等級
      17, 17,// Lv.31-32→ 深淵等級
      18, 18,// Lv.33-34→ 神諭等級
      19, 19,// Lv.35-36→ 神諭一階
      20, 20,// Lv.37-38→ 神諭二階
      21,    // Lv.39   → 神諭三階
      22,    // Lv.40   → 神諭四階
      23,    // Lv.41   → 神諭五階
      24,    // Lv.42   → 神諭六階
      25,    // Lv.43   → 神諭七階
      26,    // Lv.44   → 神諭八階
      27,    // Lv.45   → 神諭九階
      28,    // Lv.46   → 神諭十階
      29,    // Lv.47   → 神諭十一階
      30,    // Lv.48   → 神諭十二階
      30,    // Lv.49+  → 神諭十二階 (cap)
    ];
    const idx = Math.min(map[xpLevel] ?? 0, LEVEL_TIERS.length - 1);
    return LEVEL_TIERS[idx];
  }

  // Get VIP status for address (merged: based on XP level)
  async getVipStatus(address: string): Promise<VipFullStatus | null> {
    const addr = address.toLowerCase();
    const db = await this.getDb();

    // 1. Get XP level from user_profiles
    const profileRows = await db
      .select({ xp: schema.userProfiles.xp, level: schema.userProfiles.level })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.address, addr))
      .limit(1);
    const xpLevel = Number(profileRows[0]?.level ?? 1);
    const xpAmt = Number(profileRows[0]?.xp ?? 0);

    // 2. Determine level from XP level (merged system)
    const level = this.getLevelByXpLevel(xpLevel);
    const nextLevel = this.getNextLevel(level);

    // 3. Get total bets + YJC (for display/reference only)
    const betRow = await db
      .select({ amount: schema.totalBets.amount })
      .from(schema.totalBets)
      .where(
        and(
          eq(schema.totalBets.periodType, "all"),
          eq(schema.totalBets.periodId, ""),
          eq(schema.totalBets.address, addr)
        )
      )
      .limit(1);
    const totalBetAll = Number(betRow[0]?.amount ?? 0);
    const yjcBalance = await this.resolveYjcBalance(db, addr);
    const score = Math.floor(totalBetAll * 0.7 + yjcBalance * 0.3);

    // 4. Determine YJC VIP tier (based on purchased VIP pass buffs)
    const yjcVipTier = await this.getYjcVipTier(addr);

    // 5. Calculate progress to next level (based on XP)
    let progressPct = 100;
    if (nextLevel) {
      const { xpForLevel } = await import("../experience/experience-manager.js");
      const nextLevelXp = xpForLevel(xpLevel + 1);
      const currentLevelXp = xpForLevel(xpLevel);
      const span = nextLevelXp - currentLevelXp;
      const done = xpAmt - currentLevelXp;
      progressPct = span > 0 ? Math.min(100, Math.floor((done / span) * 100)) : 100;
    }

    return {
      address: addr,
      score,
      totalBetAll,
      yjcBalance,
      level,
      nextLevel,
      progressPct,
      yjcVipTier,
      privileges: {
        dailyBonusMultiplier: level.dailyBonusMultiplier ?? 1.0,
        marketFeeDiscount: level.marketFeeDiscount ?? 0.0,
        danmakuColor: level.danmakuColor ?? "#a0a0a0",
        danmakuPriority: level.danmakuPriority ?? 0,
      },
    };
  }

  // Get YJC VIP tier based on purchased VIP pass buffs (no YJC balance fallback)
  private async getYjcVipTier(address?: string): Promise<YjcVipTier> {
    if (!address) return YJC_VIP_TIERS[0];
    try {
      const db = await this.getDb();
      const profile = await db
        .select({ activeBuffs: schema.userProfiles.activeBuffs })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.address, address.toLowerCase()))
        .limit(1);
      const rawBuffs: any = profile[0]?.activeBuffs;
      const buffs: any[] = typeof rawBuffs === 'string' ? JSON.parse(rawBuffs) : (Array.isArray(rawBuffs) ? rawBuffs : []);
      if (buffs.some((b: any) => b.id === 'vip_2_permanent' || (b.type === 'vip_tier' && b.value === 2))) return YJC_VIP_TIERS[2];
      if (buffs.some((b: any) => b.id === 'vip_1_permanent' || (b.type === 'vip_tier' && b.value === 1))) return YJC_VIP_TIERS[1];
    } catch {
      // ignore
    }
    return YJC_VIP_TIERS[0]; // "none" tier
  }

  // Get YJC VIP tier by address (for game fee calculation)
  async getYjcVipTierByAddress(address: string): Promise<YjcVipTier> {
    return this.getYjcVipTier(address.toLowerCase());
  }

  // Check if user has VIP2 (for zero game fees)
  async hasVip2(address: string): Promise<boolean> {
    const tier = await this.getYjcVipTierByAddress(address);
    return tier.key === "vip2";
  }

  // Quick level lookup (for other managers)
  async getVipLevel(address: string): Promise<LevelTier> {
    const status = await this.getVipStatus(address);
    return status?.level ?? LEVEL_TIERS[0];
  }

  // Get market fee discount (for MarketManager)
  async getMarketFeeDiscount(address: string): Promise<number> {
    const level = await this.getVipLevel(address);
    return level.marketFeeDiscount ?? 0.0;
  }

  // Get daily bonus multiplier (for WalletManager)
  async getDailyBonusMultiplier(address: string): Promise<number> {
    const level = await this.getVipLevel(address);
    return level.dailyBonusMultiplier ?? 1.0;
  }

  // Bet-amount level only (ignores YJC VIP holdings)
  async getBetLevel(address: string): Promise<LevelTier> {
    const addr = address.toLowerCase();
    const db = await this.getDb();
    const betRow = await db
      .select({ amount: schema.totalBets.amount })
      .from(schema.totalBets)
      .where(
        and(
          eq(schema.totalBets.periodType, "all"),
          eq(schema.totalBets.periodId, ""),
          eq(schema.totalBets.address, addr)
        )
      )
      .limit(1);
    const totalBetAll = Number(betRow[0]?.amount ?? 0);
    return this.getLevelByTotalBet(totalBetAll);
  }

  async getBetLevelFeeDiscount(address: string): Promise<number> {
    const level = await this.getBetLevel(address);

    // Game fee policy (統一版本):
    // fee = betAmount × 2% × (1 - levelDiscountRate)
    // 普通 0%、白銀 10%、黃金 20%、鑽石 50%、創世以上 100%
    if (level.threshold >= 100_000_000_000) return 1.0; // 創世等級以上
    if (level.threshold >= 50_000_000) return 0.5; // 鑽石等級
    if (level.threshold >= 1_000_000) return 0.2; // 黃金會員
    if (level.threshold >= 100_000) return 0.1; // 白銀會員
    return 0.0; // 普通/青銅
  }
}
