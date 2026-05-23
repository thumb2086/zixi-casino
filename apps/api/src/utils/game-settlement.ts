// apps/api/src/utils/game-settlement.ts
// Unified game settlement wrapper for on-chain integration

import { randomUUID } from "crypto";
import {
  WalletManager,
  SettlementManager,
  OnchainWalletManager,
  OnchainSettlementManager,
  tokenSymbolToOnchainKey,
  VipManager,
  IdentityManager,
  RewardManager,
} from "@repo/domain";
import {
  WalletRepository,
  OpsRepository,
  GameRepository,
  SessionRepository,
  UserRepository,
  ChainClient,
  kv,
} from "@repo/infrastructure";
import { consumePreventLossBuff, restorePreventLossBuff, grantBundleToUser, loadInventoryState, ALL_ITEMS } from "./inventory.js";
import { getOnChainConfig, SettlementServiceImpl, ViemRepository, VipBetLevelService, BetPayoutService } from "@repo/on-chain";
import type { Game, TokenSymbol } from "@repo/shared";
import type { TxIntent } from "@repo/shared";
import { sql } from "drizzle-orm";

export interface SettlementContext {
  userId: string;
  address: string;
  game: Game;
  token: TokenSymbol;
  betAmount: string;
  payoutAmount: string;
  roundId: string;
  requestId: string;
}

export interface SettlementResult {
  success: boolean;
  finalPayout: number;
  feeAmount: number;
  isWin: boolean;
  betTxHash?: string;
  payoutTxHash?: string;
  balanceBefore: string;
  balanceAfter: string;
  status?: "pending" | "settled";
  /** True when a "prevent_loss" buff converted a losing round into a refund. */
  preventLossApplied?: boolean;
  error?: { code: string; message: string };
}

export class GameSettlementWrapper {
  private readonly FIXED_TREASURY_ADDRESS = getOnChainConfig().treasuryAddress;
  private readonly levelFeeService = new VipBetLevelService();
  private walletManager: WalletManager;
  private settlementManager: SettlementManager;
  private onchainWallet: OnchainWalletManager;
  private onchainSettlement: OnchainSettlementManager;
  private vipManager: VipManager;
  private identityManager: IdentityManager;
  private walletRepo: WalletRepository;
  private opsRepo: OpsRepository;
  private gameRepo: GameRepository;
  private sessionRepo: SessionRepository;
  private userRepo: UserRepository;

  constructor() {
    this.walletManager = new WalletManager();
    this.settlementManager = new SettlementManager(this.walletManager);
    this.onchainWallet = new OnchainWalletManager();
    this.vipManager = new VipManager();
    this.identityManager = new IdentityManager();
    this.walletRepo = new WalletRepository();
    this.opsRepo = new OpsRepository();
    this.gameRepo = new GameRepository();
    this.sessionRepo = new SessionRepository();
    this.userRepo = new UserRepository();

    this.onchainSettlement = new OnchainSettlementManager(
      this.settlementManager,
      this.walletManager,
      this.onchainWallet,
      this.vipManager,
      this.walletRepo
    );
  }

  private isAsyncSettlementEnabled(): boolean {
    const raw = String(process.env.GAME_SETTLEMENT_ASYNC ?? "true").toLowerCase();
    return raw !== "false" && raw !== "0";
  }

  /**
   * Persist balance to DB wallet_accounts (source of truth). KV no longer used.
   */
  async setBalance(address: string, token: "zhixi" | "yjc", balance: string): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    await this.walletRepo.updateBalance(normalizedAddress, balance, token);
  }

  /**
   * Read balance from DB (primary source). On-chain is synced in background.
   * This ensures market operations / game settlements are reflected immediately.
   */
  async getBalance(address: string, token: "zhixi" | "yjc"): Promise<string> {
    const normalizedAddress = address.toLowerCase();
    return (await this.walletRepo.getBalance(normalizedAddress, token)) || "0";
  }

  /**
   * Sync on-chain balance to DB. Called periodically or explicitly.
   */
  async syncOnchainBalance(address: string, token: "zhixi" | "yjc"): Promise<string> {
    const normalizedAddress = address.toLowerCase();
    try {
      const runtime = this.onchainWallet.getRuntimeConfig();
      const tokenRuntime = runtime.tokens[token];
      if (!tokenRuntime?.enabled || !runtime.rpcUrl || !runtime.adminPrivateKey) return "0";
      const client = new ChainClient(runtime.rpcUrl, runtime.adminPrivateKey);
      const decimals = await client.getDecimals(tokenRuntime.contractAddress, 18);
      const rawBalance = await client.getBalance(normalizedAddress, tokenRuntime.contractAddress);
      const balance = client.formatUnits(rawBalance, decimals);
      await this.walletRepo.updateBalance(normalizedAddress, balance, token);
      return balance;
    } catch {
      return (await this.walletRepo.getBalance(normalizedAddress, token)) || "0";
    }
  }

  /**
   * Validate bet and deduct balance from KV
   */
  async validateAndDeductBalance(
    address: string,
    token: "zhixi" | "yjc",
    betAmount: string,
    totalBetKey?: string
  ): Promise<{ success: boolean; balanceBefore: string; balanceAfter: string; error?: { code: string; message: string } }> {
    const amountNum = parseFloat(betAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return {
        success: false,
        balanceBefore: "0",
        balanceAfter: "0",
        error: { code: "INVALID_AMOUNT", message: "Invalid bet amount" }
      };
    }

    // VIP & Bet Limit Check (use unified VipManager tier, not legacy KV total_bet mirror)
    if (totalBetKey) {
      try {
        const vipLevel = await this.vipManager.getVipLevel(address);
        if (amountNum > Number(vipLevel.maxBet || 0)) {
          return {
            success: false,
            balanceBefore: "0",
            balanceAfter: "0",
            error: {
              code: "LIMIT_EXCEEDED",
              message: `目前 ${vipLevel.label} 單注上限為 ${Number(vipLevel.maxBet || 0).toLocaleString()} 子熙幣`,
            },
          };
        }
      } catch (e: any) {
        return {
          success: false,
          balanceBefore: "0",
          balanceAfter: "0",
          error: { code: "LIMIT_EXCEEDED", message: e?.message || "VIP limit validation failed" }
        };
      }
    }

    // Balance Check
    const balanceBefore = await this.getBalance(address, token);
    const currentBalance = parseFloat(balanceBefore);

    if (currentBalance < amountNum) {
      return {
        success: false,
        balanceBefore,
        balanceAfter: balanceBefore,
        error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance" }
      };
    }

    // Deduct Bet
    const balanceAfter = (currentBalance - amountNum).toString();
    await this.setBalance(address, token, balanceAfter);

    return { success: true, balanceBefore, balanceAfter };
  }

  /**
   * Execute on-chain settlement
   */
  async executeSettlement(ctx: SettlementContext): Promise<SettlementResult> {
    // Idempotency guard: check if settlement already processed for this roundId
    const existingIntents = await this.walletRepo.getTxIntentsByRoundId(ctx.roundId);
    if (existingIntents && existingIntents.length > 0) {
      // Settlement already exists, return cached result
      const betIntent = existingIntents.find((i: any) => i.type === "bet");
      const payoutIntent = existingIntents.find((i: any) => i.type === "payout");
      const isConfirmed = betIntent?.status === "confirmed";
      
      if (isConfirmed) {
        return {
          success: true,
          finalPayout: parseFloat(ctx.payoutAmount),
          feeAmount: 0,
          isWin: parseFloat(ctx.payoutAmount) > parseFloat(ctx.betAmount),
          betTxHash: betIntent?.txHash,
          payoutTxHash: payoutIntent?.txHash,
          balanceBefore: "0",
          balanceAfter: "0",
          status: payoutIntent?.status === "confirmed" ? "settled" : "pending",
        };
      }
    }

    // Prevent-loss buff: refund losing bets if the user has an active buff.
    // Only runs on first settlement attempt (after idempotency check) so buff
    // is not consumed twice for the same round.
    let preventLossApplied = false;
    const betValue = parseFloat(ctx.betAmount);
    const payoutValue = parseFloat(ctx.payoutAmount);
    if (Number.isFinite(betValue) && Number.isFinite(payoutValue) && payoutValue < betValue && ctx.userId) {
      try {
        const buff = await consumePreventLossBuff(ctx.userId);
        if (buff.consumed) {
          ctx = { ...ctx, payoutAmount: ctx.betAmount };
          preventLossApplied = true;
          await this.opsRepo.logEvent({
            channel: "game",
            severity: "info",
            source: ctx.game,
            kind: "prevent_loss_applied",
            userId: ctx.userId,
            address: ctx.address,
            game: ctx.game,
            roundId: ctx.roundId,
            message: `Prevent-loss buff refunded losing bet`,
            meta: { remaining: buff.remaining, originalPayout: payoutValue, refundedTo: betValue },
          });
        }
      } catch (error: any) {
        // Fail-open: if buff lookup fails, proceed with normal settlement.
        await this.opsRepo.logEvent({
          channel: "game",
          severity: "warn",
          source: ctx.game,
          kind: "prevent_loss_lookup_failed",
          userId: ctx.userId,
          address: ctx.address,
          game: ctx.game,
          roundId: ctx.roundId,
          message: `Prevent-loss buff lookup failed: ${error?.message || "unknown"}`,
        });
      }
    }

    const rollbackPreventLoss = async (reason: string): Promise<void> => {
      if (!preventLossApplied || !ctx.userId) return;
      try {
        await restorePreventLossBuff(ctx.userId);
      } catch (err: any) {
        await this.opsRepo.logEvent({
          channel: "game",
          severity: "error",
          source: ctx.game,
          kind: "prevent_loss_rollback_failed",
          userId: ctx.userId,
          address: ctx.address,
          game: ctx.game,
          roundId: ctx.roundId,
          message: `Failed to restore prevent-loss buff after ${reason}: ${err?.message || "unknown"}`,
        });
        return;
      }
      await this.opsRepo.logEvent({
        channel: "game",
        severity: "info",
        source: ctx.game,
        kind: "prevent_loss_rollback",
        userId: ctx.userId,
        address: ctx.address,
        game: ctx.game,
        roundId: ctx.roundId,
        message: `Restored prevent-loss buff after ${reason}`,
      });
    };

    if (this.isAsyncSettlementEnabled()) {
      try {
        const runtime = this.onchainWallet.getRuntimeConfig();
        const tokenKey = ctx.token === "YJC" ? "yjc" : "zhixi";
        const tokenRuntime = runtime.tokens[tokenKey];
        if (!runtime.rpcUrl || !runtime.adminPrivateKey || !tokenRuntime?.enabled || !tokenRuntime.contractAddress) {
          await rollbackPreventLoss("onchain_config_missing");
          return {
            success: false,
            finalPayout: 0,
            feeAmount: 0,
            isWin: false,
            balanceBefore: "0",
            balanceAfter: "0",
            error: { code: "ONCHAIN_CONFIG_MISSING", message: `On-chain config missing for token ${ctx.token}` },
          };
        }

        const levelDiscountRate = await this.vipManager.getMarketFeeDiscount(ctx.address);
        // The prevent-loss buff promises a full refund ("下注將全額退回"). If
        // the buff fired, bypass the per-round fee entirely so the user
        // actually receives `betAmount`, not `betAmount - fee`.
        const feeAmount = preventLossApplied
          ? 0
          : this.levelFeeService.calculateFee(ctx.betAmount, levelDiscountRate);
        const requestedPayout = parseFloat(ctx.payoutAmount);
        const finalPayout = Math.max(0, requestedPayout - feeAmount);

        const settlement = this.settlementManager.createSettlement(
          ctx.roundId,
          ctx.userId,
          ctx.address,
          ctx.game,
          ctx.token,
          ctx.betAmount,
          finalPayout.toString(),
          ctx.requestId
        );

        const { betIntent, payoutIntent } = this.walletManager.createSettlementIntent(
          ctx.userId,
          ctx.token,
          ctx.betAmount,
          finalPayout.toString(),
          ctx.game,
          ctx.roundId,
          ctx.requestId
        );

        await this.walletRepo.saveTxIntent({
          ...betIntent,
          address: ctx.address.toLowerCase(),
          meta: { settlementId: settlement.id, async: true },
        });

        if (payoutIntent) {
          await this.walletRepo.saveTxIntent({
            ...payoutIntent,
            address: ctx.address.toLowerCase(),
            meta: { settlementId: settlement.id, async: true },
          });
        }

        const queuedIntents: TxIntent[] = payoutIntent ? [betIntent, payoutIntent] : [betIntent];
        void this.processQueuedIntents(queuedIntents, ctx.address.toLowerCase(), ctx.game, ctx.roundId, settlement.id, ctx.userId)
          .catch(async (error) => {
            await this.opsRepo.logEvent({
              channel: "game",
              severity: "error",
              source: ctx.game,
              kind: "settlement_queue_runtime_error",
              userId: ctx.userId,
              address: ctx.address,
              game: ctx.game,
              roundId: ctx.roundId,
              settlementId: settlement.id,
              message: `Async queue runtime failed: ${error?.message || "unknown error"}`,
            });
            // If the background chain processing fails after we've already
            // credited the prevent-loss refund, restore the buff charge so the
            // user is not charged for a refund that never landed on-chain.
            await rollbackPreventLoss("async_queue_runtime_error");
          });

        await this.opsRepo.logEvent({
          channel: "game",
          severity: "info",
          source: ctx.game,
          kind: "settlement_queued",
          userId: ctx.userId,
          address: ctx.address,
          game: ctx.game,
          roundId: ctx.roundId,
          settlementId: settlement.id,
          message: `Queued async settlement for ${ctx.game} round ${ctx.roundId}`,
          meta: {
            requestId: ctx.requestId,
            payoutIntentId: payoutIntent?.id,
            betIntentId: betIntent.id,
            feeAmount,
            finalPayout,
          },
        });

        return {
          success: true,
          finalPayout,
          feeAmount,
          isWin: settlement.isWin,
          balanceBefore: "0",
          balanceAfter: "0",
          status: "pending",
          preventLossApplied,
        };
      } catch (error: any) {
        await rollbackPreventLoss("settlement_queue_error");
        return {
          success: false,
          finalPayout: 0,
          feeAmount: 0,
          isWin: false,
          balanceBefore: "0",
          balanceAfter: "0",
          error: { code: "SETTLEMENT_QUEUE_ERROR", message: error.message },
        };
      }
    }

    try {
      // Sync path delegates fee handling to onchainSettlement, which deducts
      // feeAmount from payoutAmount. When prevent-loss is applied we want the
      // user to actually receive `betAmount` as a full refund, so gross up
      // payoutAmount by the expected fee. onchainSettlement then subtracts the
      // same fee and the user ends up with exactly betAmount.
      let syncPayoutAmount = ctx.payoutAmount;
      if (preventLossApplied) {
        const levelDiscountRate = await this.vipManager.getMarketFeeDiscount(ctx.address);
        const expectedFee = this.levelFeeService.calculateFee(ctx.betAmount, levelDiscountRate);
        const betValueNumeric = parseFloat(ctx.betAmount) || 0;
        syncPayoutAmount = (betValueNumeric + expectedFee).toString();
      }

      const result = await this.onchainSettlement.settleGame({
        userId: ctx.userId,
        address: ctx.address,
        game: ctx.game,
        token: ctx.token,
        betAmount: ctx.betAmount,
        payoutAmount: syncPayoutAmount,
        roundId: ctx.roundId,
        requestId: ctx.requestId,
      });

      return {
        success: true,
        finalPayout: result.finalPayout,
        feeAmount: result.feeAmount,
        isWin: result.settlement.isWin,
        betTxHash: result.betTxHash,
        payoutTxHash: result.payoutTxHash,
        balanceBefore: "0", // Will be set by caller
        balanceAfter: "0",  // Will be set by caller
        status: "settled",
        preventLossApplied,
      };
    } catch (error: any) {
      await rollbackPreventLoss("settlement_error");
      return {
        success: false,
        finalPayout: 0,
        feeAmount: 0,
        isWin: false,
        balanceBefore: "0",
        balanceAfter: "0",
        error: { code: "SETTLEMENT_ERROR", message: error.message }
      };
    }
  }

  private async processQueuedIntents(
    intents: TxIntent[],
    userAddress: string,
    game: string,
    roundId: string,
    settlementId: string,
    userId: string
  ): Promise<void> {
    const runtime = this.onchainWallet.getRuntimeConfig();
    if (!runtime.rpcUrl || !runtime.adminPrivateKey) {
      throw new Error("ONCHAIN_RUNTIME_NOT_CONFIGURED");
    }

    const repo = new ViemRepository(runtime.rpcUrl, runtime.adminPrivateKey);
    const betPayoutService = new BetPayoutService(repo, this.FIXED_TREASURY_ADDRESS);

    const failures: Array<{ intent: TxIntent; error: string }> = [];

    for (const intent of intents) {
      try {
        await this.walletRepo.saveTxIntent(this.walletManager.processTxIntent(intent, "broadcasted"));

        const tokenKey = tokenSymbolToOnchainKey(intent.token);
        const tokenRuntime = runtime.tokens[tokenKey];
        if (!tokenRuntime?.contractAddress) {
          throw new Error(`ONCHAIN_TOKEN_CONFIG_MISSING: ${intent.token}`);
        }

        let txResult;
        if (intent.type === "bet") {
          txResult = await betPayoutService.processBet({
            from: userAddress,
            amount: String(intent.amount || "0"),
            tokenAddress: tokenRuntime.contractAddress,
            roundId,
            settlementId,
            gameType: game,
            tokenSymbol: intent.token,
          });
        } else if (intent.type === "payout") {
          txResult = await betPayoutService.processPayout({
            to: userAddress,
            amount: String(intent.amount || "0"),
            tokenAddress: tokenRuntime.contractAddress,
            roundId,
            settlementId,
            gameType: game,
            tokenSymbol: intent.token,
          });
        } else {
          throw new Error(`Unknown intent type: ${intent.type}`);
        }

        await this.walletRepo.saveTxIntent(this.walletManager.processTxIntent(intent, "confirmed", txResult.txHash));
        await this.opsRepo.logEvent({
          channel: "game",
          severity: "info",
          source: game,
          kind: "settlement_tx_confirmed",
          userId,
          address: userAddress,
          game,
          roundId,
          settlementId,
          txIntentId: intent.id,
          txHash: txResult.txHash,
          message: `Settlement tx confirmed: ${intent.type} ${txResult.txHash}`,
        });
      } catch (error: any) {
        await this.walletRepo.saveTxIntent(
          this.walletManager.processTxIntent(intent, "failed", undefined, error?.message || "Settlement tx failed")
        );
        await this.opsRepo.logEvent({
          channel: "game",
          severity: "error",
          source: game,
          kind: "settlement_tx_failed",
          userId,
          address: userAddress,
          game,
          roundId,
          settlementId,
          txIntentId: intent.id,
          errorCode: "TX_BROADCAST_ERROR",
          message: `Settlement tx failed: ${intent.type} ${error?.message || "unknown error"}`,
        });
        failures.push({ intent, error: error?.message || "Settlement tx failed" });
      }
    }

    // Surface any per-intent failure so the caller's `.catch()` runs — in
    // particular so the prevent-loss buff rollback fires when a payout never
    // lands on-chain. Without this re-throw, individual tx failures would be
    // swallowed here (each intent is caught) and the async queue would appear
    // to have completed successfully.
    if (failures.length > 0) {
      const summary = failures.map((f) => `${f.intent.type}:${f.error}`).join("; ");
      const err = new Error(`Settlement intent failures: ${summary}`);
      (err as any).intentFailures = failures;
      throw err;
    }
  }

  /**
   * Credit payout to KV balance
   */
  async creditPayout(
    address: string,
    token: "zhixi" | "yjc",
    currentBalance: string,
    payout: number,
    game?: string,
    userId?: string,
    betAmount?: number
  ): Promise<string> {
    const finalBalance = (parseFloat(currentBalance) + payout).toString();
    await this.setBalance(address, token, finalBalance);

    // Save ledger entry for bet (debit)
    if (userId && betAmount && betAmount > 0) {
      this.walletRepo.saveLedgerEntry({
        id: randomUUID(),
        userId,
        address: address.toLowerCase(),
        token,
        type: 'bet',
        amount: `-${betAmount}`,
        balanceBefore: currentBalance,
        balanceAfter: finalBalance,
        game: game || null,
        createdAt: new Date(),
      }).catch((err: any) => console.error('Failed to save bet ledger entry:', err));
    }

    // Save ledger entry for payout (credit)
    if (userId) {
      this.walletRepo.saveLedgerEntry({
        id: randomUUID(),
        userId,
        address: address.toLowerCase(),
        token,
        type: 'payout',
        amount: payout.toString(),
        balanceBefore: currentBalance,
        balanceAfter: finalBalance,
        game: game || null,
        createdAt: new Date(),
      }).catch((err: any) => console.error('Failed to save payout ledger entry:', err));
    }

    // Broadcast win notification to global chat
    if (game && userId && payout > 0) {
      this.broadcastWin(address, game, payout, userId);
    }

    return finalBalance;
  }

  private async broadcastWin(address: string, game: string, payout: number, userId: string): Promise<void> {
    try {
      const user = await this.userRepo.getUserById(userId);
      const displayName = user?.displayName || address.toLowerCase().slice(0, 6);
      const isBig = payout >= 100000;
      const msg = {
        id: crypto.randomUUID(),
        address: "",
        displayName: isBig ? "🎉 大獎" : "💫 系統",
        text: isBig
          ? `🔥 ${displayName} 在 ${game} 中大獎 ${payout.toLocaleString()} ZXC！`
          : `${displayName} 在 ${game} 贏得 ${payout.toLocaleString()} ZXC`,
        createdAt: Date.now(),
      };
      await kv.lpush("chat:global:messages", msg);
      await kv.ltrim("chat:global:messages", 0, 49);
      kv.del("api:GET:/api/v1/support/chat/messages:").catch(() => {});
    } catch (err) {
      console.error('broadcastWin error:', err);
    }
  }

  /**
   * Update total bet tracking
   */
  async updateTotalBet(address: string, betAmount: number, winAmount?: number, userId?: string): Promise<void> {
    const { requireDb } = await import("@repo/infrastructure/db/index.js");
    const db = await requireDb();
    const addr = address.toLowerCase();

    await db.execute(sql`
      INSERT INTO total_bets (period_type, period_id, address, amount)
      VALUES ('all', '', ${addr}, ${betAmount})
      ON CONFLICT (period_type, period_id, address)
      DO UPDATE SET amount = total_bets.amount + ${betAmount}
    `);
    if (winAmount && winAmount > 0) {
      await db.execute(sql`
        UPDATE total_bets SET total_win = COALESCE(total_win, 0) + ${winAmount}
        WHERE period_type = 'all' AND period_id = '' AND address = ${addr}
      `);
    }
    if (userId) {
      await this.checkAndUnlockTitles(userId, address);
      // Grant XP based on bet amount
      await this.grantGameXp(userId, betAmount, address).catch(() => {});
      // Track mission progress (fire-and-forget)
      // Track mission progress (fire-and-forget) — pass game from metadata
      const gameName = betAmount > 0 ? 'unknown' : '';
      this.trackMission(address, betAmount, winAmount || 0).catch(() => {});
    }
  }

  private async trackMission(address: string, betAmount: number, winAmount: number): Promise<void> {
    const { kv } = await import("@repo/infrastructure");
    const today = new Date().toISOString().slice(0, 10);
    const addr = address.toLowerCase();
    const prevBet = await kv.get<number>(`mission:bet:${addr}:${today}`);
    await kv.set(`mission:bet:${addr}:${today}`, (prevBet || 0) + betAmount);
    const prevPlay = await kv.get<number>(`mission:play:${addr}:${today}`);
    await kv.set(`mission:play:${addr}:${today}`, (prevPlay || 0) + 1);
    if (winAmount > 0) {
      const prevWin = await kv.get<number>(`mission:win:${addr}:${today}`);
      await kv.set(`mission:win:${addr}:${today}`, (prevWin || 0) + 1);
    }
  }

  private async grantGameXp(userId: string, betAmount: number, address?: string): Promise<void> {
    const { requireDb } = await import("@repo/infrastructure/db/index.js");
    const db = await requireDb();
    const { grantXp } = await import("@repo/domain");
    const { loadInventoryState } = await import("./inventory.js");

    const state = await loadInventoryState(userId);
    const [profile] = await db.execute(sql`
      SELECT COALESCE(xp, 0) as xp, COALESCE(level, 1) as level FROM user_profiles WHERE user_id = ${userId}
    `);
    const currentXp = Number(profile?.xp || 0);
    const currentLevel = Number(profile?.level || 1);

    // Get VIP daily bonus multiplier
    let vipDailyBonusMult = 1;
    if (address) {
      try {
        const vipLevelTier = await this.vipManager.getVipLevel(address);
        vipDailyBonusMult = vipLevelTier.dailyBonusMultiplier ?? 1;
      } catch {}
    }

    const result = grantXp(currentXp, currentLevel, betAmount, state.activeBuffs, vipDailyBonusMult);

    await db.execute(sql`
      UPDATE user_profiles SET xp = ${result.totalXp}, level = ${result.newLevel}, updated_at = NOW() WHERE user_id = ${userId}
    `);
  }

  async updateTotalWin(address: string, winAmount: number): Promise<void> {
    await this.updateTotalBet(address, 0, winAmount);
  }

  async checkAndUnlockTitles(userId: string, address: string): Promise<void> {
    try {
      const db = await (await import("@repo/infrastructure/db/index.js")).requireDb();
      const addr = address.toLowerCase();
      const [row] = await db.execute(sql`
        SELECT COALESCE(amount, 0) as total_bet, COALESCE(total_win, 0) as total_win
        FROM total_bets WHERE period_type = 'all' AND period_id = '' AND address = ${addr}
      `);
      const stats = {
        totalBet: Number(row?.totalBet || row?.total_bet || 0),
        totalWin: Number(row?.totalWin || row?.total_win || 0),
      };
      const rewardManager = new RewardManager();
      const unlocked = rewardManager.checkTitleUnlock(userId, stats);
      if (unlocked.length === 0) return;

      const state = await loadInventoryState(userId);
      const newTitles = unlocked.filter((t) => !state.ownedTitles.includes(t));
      if (newTitles.length === 0) return;

      await grantBundleToUser(userId, { titles: newTitles }, address);

      // Send global notification
      try {
        const titleLabels = newTitles.map((t: string) => {
          const def = ALL_ITEMS[t];
          return def?.name || t;
        });
        const msg = {
          id: crypto.randomUUID(),
          userId: "system",
          address: "",
          displayName: "🎉 系統",
          text: `玩家獲得稱號：${titleLabels.join("、")}！`,
          createdAt: Date.now(),
        };
        await kv.lpush("chat:global:messages", msg);
        await kv.ltrim("chat:global:messages", 0, 49);
      } catch (err) {
        console.error("Failed to send title unlock notification:", err);
      }

      await this.opsRepo.logEvent({
        channel: "rewards",
        severity: "info",
        source: "title_unlock",
        kind: "title_auto_unlocked",
        userId,
        address,
        message: `Auto-unlocked titles: ${newTitles.join(", ")}`,
        meta: { newTitles },
      });
    } catch (err) {
      console.error("checkAndUnlockTitles error:", err);
    }
  }

  /**
   * Rollback balance on error
   */
  async rollbackBalance(
    address: string,
    token: "zhixi" | "yjc",
    originalBalance: string
  ): Promise<void> {
    await this.setBalance(address, token, originalBalance);
  }

  /**
   * Log game event
   */
  async logGameEvent(params: {
    game: string;
    userId: string;
    address: string;
    amount: string;
    payout: string;
    fee: string;
    isWin: boolean;
    multiplier: number;
    betTxHash?: string;
    payoutTxHash?: string;
    roundId: string;
    settlementId?: string;
  }): Promise<void> {
    await this.opsRepo.logEvent({
      channel: "game",
      severity: "info",
      source: params.game,
      kind: "play_completed",
      userId: params.userId,
      address: params.address,
      game: params.game,
      amount: params.amount,
      payout: params.payout,
      fee: params.fee,
      isWin: params.isWin,
      settlementId: params.settlementId,
      message: `User played ${params.game}: bet ${params.amount}, payout ${params.payout} (${params.multiplier}x), fee ${params.fee}`,
      meta: {
        roundId: params.roundId,
        betTxHash: params.betTxHash,
        payoutTxHash: params.payoutTxHash,
      },
    });
  }

  /**
   * Save round to game repository
   */
  async saveRound(game: string, roundId: string, result: any): Promise<void> {
    const now = new Date();
    await this.gameRepo.saveRound({
      id: randomUUID(),
      game,
      externalRoundId: roundId,
      status: "settled",
      result,
      opensAt: now,
      closesAt: now,
      bettingClosesAt: now,
      settledAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// Singleton instance
export const gameSettlement = new GameSettlementWrapper();
