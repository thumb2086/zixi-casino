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

      // Sync on-chain balance to DB if different
      if (onchainBalance !== dbBalance) {
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
          // DB sync failure is non-fatal, return on-chain balance anyway
        }
      }

      return onchainBalance;
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

  // Get VIP status for address
  async getVipStatus(address: string): Promise<VipFullStatus | null> {
    const addr = address.toLowerCase();
    const db = await this.getDb();

    // 1. Get total bets for 'all' period
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

    // 2. Get YJC token balance (prefer on-chain balance when available)
    const yjcBalance = await this.resolveYjcBalance(db, addr);

    // 3. VIP score = weighted combination: 70% total_bets + 30% YJC holdings
    const score = Math.floor(totalBetAll * 0.7 + yjcBalance * 0.3);

    // 4. Determine level (based on score/总投注)
    const level = this.getVipTierByScore(score);
    const nextLevel = this.getNextLevel(level);

    // 5. Determine YJC VIP tier (based on YJC balance + purchased buffs) - separate system!
    const yjcVipTier = await this.getYjcVipTier(yjcBalance, addr);

    // 6. Calculate progress to next level
    let progressPct = 100;
    if (nextLevel) {
      const span = nextLevel.threshold - level.threshold;
      const done = score - level.threshold;
      progressPct = Math.min(100, Math.floor((done / span) * 100));
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

  // Get YJC VIP tier based on YJC balance + purchased VIP buffs
  private async getYjcVipTier(yjcBalance: number, address?: string): Promise<YjcVipTier> {
    // Check for permanent VIP buffs purchased from shop
    if (address) {
      try {
        const db = await this.getDb();
        const profile = await db
          .select({ activeBuffs: schema.userProfiles.activeBuffs })
          .from(schema.userProfiles)
          .where(eq(schema.userProfiles.address, address.toLowerCase()))
          .limit(1);
        const buffs: any[] = (profile[0]?.activeBuffs as any[]) || [];
        const hasVip2 = buffs.some((b: any) => b.id === 'vip_2_permanent');
        const hasVip1 = buffs.some((b: any) => b.id === 'vip_1_permanent');
        if (hasVip2) return YJC_VIP_TIERS[2];
        if (hasVip1) return YJC_VIP_TIERS[1];
      } catch {
        // fall through to normal YJC balance check
      }
    }
    for (let i = YJC_VIP_TIERS.length - 1; i >= 0; i--) {
      if (yjcBalance >= YJC_VIP_TIERS[i].minBalance) {
        return YJC_VIP_TIERS[i];
      }
    }
    return YJC_VIP_TIERS[0]; // "none" tier
  }

  // Get YJC VIP tier by address (for game fee calculation)
  async getYjcVipTierByAddress(address: string): Promise<YjcVipTier> {
    const addr = address.toLowerCase();
    const db = await this.getDb();

    const yjcBalance = await this.resolveYjcBalance(db, addr);
    return this.getYjcVipTier(yjcBalance, addr);
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
