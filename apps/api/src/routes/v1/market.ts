import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { MarketManager, OnchainWalletManager, WalletManager } from "@repo/domain";
import { ChainClient, SessionRepository, UserRepository, MarketRepository, WalletRepository, kv } from "@repo/infrastructure";
import { gameSettlement } from "../../utils/game-settlement.js";
import { randomUUID } from "crypto";

export async function marketRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const marketManager = new MarketManager();
  const onchainManager = new OnchainWalletManager();
  const sessionRepo = new SessionRepository();
  const userRepo = new UserRepository();
  const marketRepo = new MarketRepository();
  const walletRepo = new WalletRepository();

  const loadCompatibleAccount = async (address: string, userId: string) => {
    const dbAccount = await marketRepo.getAccount(address);
    if (dbAccount) return dbAccount;

    const [legacyPrimary, legacyFallback] = await Promise.all([
      kv.get<any>(`market:${address}`),
      kv.get<any>(`market_sim:${address}`),
    ]);
    const legacy = legacyPrimary || legacyFallback;
    if (!legacy) return null;

    const normalized = marketManager.normalizeAccount(legacy);
    await marketRepo.saveAccount(address, userId, normalized);
    return normalized;
  };

  const isWalletBackedEmptyAccount = (account: any) => (
    Number(account?.bankBalance || 0) === 0 &&
    Number(account?.loanPrincipal || 0) === 0 &&
    Number(account?.bankInterestAccrued || 0) === 0 &&
    Number(account?.loanInterestAccrued || 0) === 0 &&
    Object.keys(account?.stockHoldings || {}).length === 0 &&
    (account?.futuresPositions?.length || 0) === 0 &&
    (account?.history?.length || 0) === 0
  );

  const getLiveWalletBalance = async (address: string) => {
    const [dbBalance, legacyBalance] = await Promise.all([
      walletRepo.getBalance(address, "zhixi"),
      kv.get<string | number>(`balance:${address}`),
    ]);

    const fallbackBalance = Number(dbBalance || 0) === 0 && legacyBalance !== null && legacyBalance !== undefined
      ? String(legacyBalance)
      : String(dbBalance || legacyBalance || "0");

    if (fallbackBalance !== String(dbBalance || "0") && Number(fallbackBalance || 0) > 0) {
      await walletRepo.updateBalance(address, fallbackBalance, "zhixi");
    }

    try {
      const runtime = onchainManager.getRuntimeConfig();
      const tokenRuntime = runtime.tokens.zhixi;
      if (!runtime.rpcUrl || !runtime.adminPrivateKey || !tokenRuntime.enabled) {
        return fallbackBalance;
      }

      const client = new ChainClient(runtime.rpcUrl, runtime.adminPrivateKey);
      const decimals = await client.getDecimals(tokenRuntime.contractAddress, 18);
      const balance = client.formatUnits(
        await client.getBalance(address, tokenRuntime.contractAddress),
        decimals
      );
      await walletRepo.updateBalance(address, balance, "zhixi");
      return balance;
    } catch {
      return fallbackBalance;
    }
  };

  const hydrateAccount = async (address: string, userId: string, nowTs = Date.now()) => {
    const [storedAccount, liveWalletBalance] = await Promise.all([
      loadCompatibleAccount(address, userId),
      getLiveWalletBalance(address),
    ]);

    if (!storedAccount) {
      return marketManager.createDefaultAccount(nowTs, Number(liveWalletBalance || 0));
    }

    const normalized = marketManager.normalizeAccount(storedAccount, nowTs);
    // Only set initial cash from wallet for brand-new empty accounts
    if (normalized.cash === 0 && Number(liveWalletBalance || 0) > 0) {
      normalized.cash = Number(liveWalletBalance || 0);
    }
    normalized.updatedAt = new Date(nowTs).toISOString();
    return normalized;
  };

  const getContext = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) return null;
    const session = await sessionRepo.getSessionById(sessionId as string);
    if (!session || session.status !== "authorized") return null;
    const user = await userRepo.getUserById(session.userId);
    return { session, user };
  };

  typedFastify.get("/snapshot", async (request) => {
    const snapshot = marketManager.buildSnapshot();
    await marketRepo.saveMarketSnapshot(snapshot);
    return createApiEnvelope({ snapshot }, request.id);
  });

  typedFastify.get("/me", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const nowTs = Date.now();
    const snapshot = marketManager.buildSnapshot(nowTs);
    const normalized = await hydrateAccount(ctx.session.address, ctx.user.id, nowTs);
    marketManager.settleLiquidations(normalized, snapshot);
    await marketRepo.saveAccount(ctx.session.address, ctx.user.id, normalized);
    return createApiEnvelope({ account: marketManager.buildAccountSummary(normalized, snapshot) }, request.id);
  });

  typedFastify.post("/action", {
    schema: {
      body: z.object({
        sessionId: z.string(),
        type: z.enum(["stock_buy", "stock_sell", "bank_deposit", "bank_withdraw", "loan_borrow", "loan_repay", "futures_open", "futures_close"]),
        symbol: z.string().optional(),
        amount: z.string().optional(),
        quantity: z.string().optional(),
        side: z.enum(["long", "short"]).optional(),
        leverage: z.string().optional(),
        positionId: z.string().optional(),
      }),
    },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);
    const { type, symbol, amount, quantity, side, leverage, positionId } = request.body;
    const nowTs = Date.now();
    const snapshot = marketManager.buildSnapshot(nowTs);
    const account = await hydrateAccount(ctx.session.address, ctx.user.id, nowTs);
    marketManager.settleLiquidations(account, snapshot);
    const address = ctx.session.address.toLowerCase();
    const userId = ctx.user.id;

    // Helper to resolve amount
    const resolveAmt = (v: any): number => {
      const n = v === "all" ? account.cash : Number(v ?? 0);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    };

    // Pre-check wallet balance for cost actions
    const isCostAction = ["stock_buy", "bank_deposit", "futures_open", "loan_repay"].includes(type);
    if (isCostAction) {
      const estCost = type === "stock_buy"
        ? resolveAmt(quantity) * (snapshot.symbols?.[symbol || ""]?.price || 0) * (1 + 0.001) // incl fee
        : resolveAmt(amount);
      const currentBalance = parseFloat(await gameSettlement.getBalance(address, "zhixi"));
      if (currentBalance < estCost) {
        return createApiEnvelope({ error: { code: "INSUFFICIENT_BALANCE", message: `錢包餘額不足，需要 ${Math.ceil(estCost).toLocaleString()} ZXC，目前 ${Math.floor(currentBalance).toLocaleString()} ZXC` } }, request.id);
      }
    }

    let result: any;
    try {
      if (type === "stock_buy") result = marketManager.buyStock(account, snapshot, symbol, quantity);
      else if (type === "stock_sell") result = marketManager.sellStock(account, snapshot, symbol, quantity);
      else if (type === "bank_deposit") result = marketManager.bankDeposit(account, amount);
      else if (type === "bank_withdraw") result = marketManager.bankWithdraw(account, amount);
      else if (type === "loan_borrow") result = marketManager.borrowLoan(account, snapshot, amount);
      else if (type === "loan_repay") result = marketManager.repayLoan(account, amount);
      else if (type === "futures_open") result = marketManager.openFutures(account, snapshot, { symbol, side, margin: amount, leverage });
      else if (type === "futures_close" && positionId) result = marketManager.closeFutures(account, snapshot, positionId);
      else throw new Error("Unsupported market action payload");

      // Deduct/credit real wallet balance based on actual result
      const walletAction = new WalletManager();
      const walletDeduction = Math.abs(result?.total || result?.net || result?.amount || result?.margin || result?.refund || 0);
      if (isCostAction && walletDeduction > 0) {
        const currentBalance = parseFloat(await gameSettlement.getBalance(address, "zhixi"));
        const newBalance = Math.max(0, currentBalance - walletDeduction);
        await gameSettlement.setBalance(address, "zhixi", newBalance.toString());
        const intent = walletAction.createTxIntent(userId, "ZXC", "admin_debit", walletDeduction.toString());
        intent.address = address;
        intent.meta = { source: "market", action: type, symbol: symbol || null };
        await walletRepo.saveTxIntent(intent);
      }
      const isReturnAction = ["stock_sell", "bank_withdraw", "futures_close", "loan_borrow"].includes(type);
      if (isReturnAction && walletDeduction > 0) {
        const currentBalance = parseFloat(await gameSettlement.getBalance(address, "zhixi"));
        const newBalance = currentBalance + walletDeduction;
        await gameSettlement.setBalance(address, "zhixi", newBalance.toString());
        const intent = walletAction.createTxIntent(userId, "ZXC", "admin_credit", walletDeduction.toString());
        intent.address = address;
        intent.meta = { source: "market", action: type, symbol: symbol || null };
        await walletRepo.saveTxIntent(intent);
      }

      await marketRepo.saveAccount(address, userId, account);
      await marketRepo.saveTrade({
        id: randomUUID(),
        userId,
        address,
        type,
        symbol: result?.symbol || symbol || null,
        quantity: result?.quantity ?? null,
        price: result?.price ?? result?.entryPrice ?? result?.closePrice ?? null,
        amount: result?.total ?? result?.net ?? result?.amount ?? result?.margin ?? result?.refund ?? null,
        fee: result?.fee ?? null,
        pnl: result?.realizedPnl ?? null,
        meta: result,
        createdAt: new Date(),
      });
      return createApiEnvelope({ success: true, result, account: marketManager.buildAccountSummary(account, snapshot) }, request.id);
    } catch (e: any) {
      return createApiEnvelope(null, request.id, false, e.message);
    }
  });
}
