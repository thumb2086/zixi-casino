import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { StatsRepository, WalletRepository, kv, OpsRepository } from "@repo/infrastructure";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { sql } from "drizzle-orm";
import { SERVER_STARTED_AT } from "../../index.js";

export async function statsRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const statsRepo = new StatsRepository();

  typedFastify.get("/leaderboard", {
    schema: {
      querystring: z.object({ type: z.enum(["total_bet", "balance"]).optional().default("total_bet") }),
    },
  }, async (request) => {
    const { type } = request.query;
    try {
      const cacheKey = `stats:leaderboard:${type}`;
      const cached = await kv.get<any[]>(cacheKey);
      if (cached) return createApiEnvelope({ leaderboard: cached }, request.id);
      const leaderboard = await statsRepo.getLeaderboard(type);
      await kv.set(cacheKey, leaderboard, { ex: 300 });
      return createApiEnvelope({ leaderboard }, request.id);
    } catch (e: any) {
      return createApiEnvelope(null, request.id, false, e.message);
    }
  });

  typedFastify.get("/health", async (request) => {
    try {
      const opsRepo = new OpsRepository();
      const events: any[] = await opsRepo.listEvents({ limit: 1000 });
      
      // Filter events from last 24 hours
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const last24h = events.filter((e) => {
        const eventTime = new Date(e.createdAt).getTime();
        return now - eventTime < oneDayMs;
      });
      
      // Aggregate statistics
      const total = last24h.length;
      const errors = last24h.filter((e) => e.severity === 'error' || e.severity === 'fatal').length;
      const successRate = total > 0 ? ((total - errors) / total * 100).toFixed(2) : null;
      
      // Generate hourly data for the chart (last 24 hours)
      const hourly = Array.from({ length: 24 }, (_, i) => {
        const hourStart = new Date(now - (23 - i) * 60 * 60 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
        
        const hourEvents = last24h.filter((e) => {
          const eventTime = new Date(e.createdAt);
          return eventTime >= hourStart && eventTime < hourEnd;
        });
        
        return {
          success: hourEvents.filter((e) => e.severity !== 'error' && e.severity !== 'fatal').length,
          failure: hourEvents.filter((e) => e.severity === 'error' || e.severity === 'fatal').length
        };
      });
      
      // Count active game sessions (unique addresses in last hour)
      const lastHour = events.filter((e) => {
        const eventTime = new Date(e.createdAt).getTime();
        return now - eventTime < 60 * 60 * 1000;
      });
      const uniqueAddresses = new Set(lastHour.map((e) => e.address).filter(Boolean));
      const activeNodes = uniqueAddresses.size;
      
      const uptimeSeconds = Math.floor((now - SERVER_STARTED_AT) / 1000);
      const uptimeMinutes = Math.floor(uptimeSeconds / 60);
      
      const recentLogs = events.slice(0, 40).map((e) => ({
        id: e.id,
        channel: e.channel,
        severity: e.severity,
        source: e.source,
        kind: e.kind,
        message: e.message,
        address: e.address,
        game: e.game,
        token: e.token,
        roundId: e.roundId,
        txHash: e.txHash,
        errorCode: e.errorCode,
        errorStage: e.errorStage,
        meta: e.meta,
        createdAt: e.createdAt,
      }));

      const stats = {
        uptime: successRate ? `${successRate}%` : null,
        failureRate: total > 0 ? `${(errors / total * 100).toFixed(2)}%` : null,
        nodes: activeNodes > 0 ? `${activeNodes} ACTIVE` : null,
        secureLayer: 'AES-256',
        startedAt: SERVER_STARTED_AT,
        serverUptime: uptimeSeconds,
        serverUptimeLabel: uptimeMinutes >= 60
          ? `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}m`
          : uptimeMinutes > 0 ? `${uptimeMinutes}m` : '< 1m',
        last24h: {
          success: hourly.map((h) => h.success),
          failure: hourly.map((h) => h.failure)
        }
      };

      return createApiEnvelope({ stats, logs: recentLogs }, request.id);
    } catch (e: any) {
      return createApiEnvelope(null, request.id, false, e.message);
    }
  });

  typedFastify.get("/performance", async (request) => {
    try {
      const db = await requireDb();
      const now = Date.now();
      const uptimeSec = Math.floor((now - SERVER_STARTED_AT) / 1000);

      // Count recent transactions (last 24h)
      const dayAgo = new Date(now - 86400000).toISOString();
      const [recentTxRow] = await db.select({ count: sql<number>`count(*)::int` }).from(
        (await import("@repo/infrastructure/db/schema.js")).walletLedgerEntries as any
      ).where(
        (await import("drizzle-orm")).sql`created_at >= ${dayAgo}::timestamp`
      );
      const recentTxCount = recentTxRow?.count ?? 0;

      // Count total users
      const [userRow] = await db.select({ count: sql<number>`count(*)::int` }).from(
        (await import("@repo/infrastructure/db/schema.js")).users as any
      );
      const userCount = userRow?.count ?? 0;

      // Count total sessions
      const [sessionRow] = await db.select({ count: sql<number>`count(*)::int` }).from(
        (await import("@repo/infrastructure/db/schema.js")).sessions as any
      );
      const sessionCount = sessionRow?.count ?? 0;

      return createApiEnvelope({
        uptime: uptimeSec,
        uptimeLabel: uptimeSec >= 3600
          ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
          : `${Math.floor(uptimeSec / 60)}m`,
        serverStartedAt: SERVER_STARTED_AT,
        users: userCount,
        activeSessions: sessionCount,
        tx24h: recentTxCount,
        timestamp: now,
      }, request.id);
    } catch (e: any) {
      return createApiEnvelope(null, request.id, false, e.message);
    }
  });

  typedFastify.get("/recent-txs", async (request) => {
    try {
      const walletRepo = new WalletRepository();
      const ledger = await walletRepo.listLedgerEntries({ limit: 50 });
      const events = ledger.map((entry: any) => ({
        id: entry.id,
        type: entry.type,
        amount: entry.amount,
        token: entry.token || "ZXC",
        address: entry.address,
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter,
        createdAt: entry.createdAt,
      }));
      return createApiEnvelope({ events }, request.id);
    } catch (e: any) {
      return createApiEnvelope({ events: [] }, request.id);
    }
  });
}
