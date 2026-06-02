import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { authRoutes } from "./routes/v1/auth.js";
import { walletRoutes } from "./routes/v1/wallet.js";
import { gameRoutes } from "./routes/v1/games.js";
import { marketRoutes } from "./routes/v1/market.js";
import { rewardRoutes } from "./routes/v1/rewards.js";
import { adminRoutes } from "./routes/v1/admin.js";
import { meRoutes } from "./routes/v1/me.js";
import { statsRoutes } from "./routes/v1/stats.js";
import { supportRoutes } from "./routes/v1/support.js";
import { profileRoutes } from "./routes/v1/profile.js";
import { announcementRoutes } from "./routes/v1/announcements.js";
import { transactionRoutes } from "./routes/v1/transactions.js";
import { dashboardRoutes } from "./routes/v1/dashboard/index.js";
import { legacyRoutes } from "./routes/legacy/index.js";
import { marketListingRoutes } from "./routes/v1/market-listings.js";
// Phase 3: New routes
import { leaderboardRoutes } from "./routes/v1/leaderboard.js";
import { vipRoutes } from "./routes/v1/vip.js";
// Phase 3: 12 Game routes
import { slotsRoutes } from "./routes/v1/games/slots.js";
import { coinflipRoutes } from "./routes/v1/games/coinflip.js";
import { rouletteRoutes } from "./routes/v1/games/roulette.js";
import { horseRoutes } from "./routes/v1/games/horse.js";
import { sicboRoutes } from "./routes/v1/games/sicbo.js";
import { bingoRoutes } from "./routes/v1/games/bingo.js";
import { duelRoutes } from "./routes/v1/games/duel.js";
import { blackjackRoutes } from "./routes/v1/games/blackjack.js";
import { crashRoutes } from "./routes/v1/games/crash.js";
import { pokerRoutes } from "./routes/v1/games/poker.js";
import { bluffdiceRoutes } from "./routes/v1/games/bluffdice.js";
import { shootDragonGateRoutes } from "./routes/v1/games/shoot-dragon-gate.js";
// v1.1.0: Company simulation (beta)
import { companyRoutes } from "./routes/v1/company.js";
// Phase 6: Chest / inventory routes
import { chestRoutes } from "./routes/v1/chests-simple.js";
import { inventoryRoutes } from "./routes/v1/inventory.js";
import { pawnRoutes } from "./routes/v1/pawn.js";
import { giftRoutes } from "./routes/v1/gift.js";
import { missionRoutes } from "./routes/v1/missions.js";
import postgres from "postgres";
import { registerCachePlugin } from "./plugins/cache.js";
import { SessionRepository, UserRepository } from "@repo/infrastructure";

const fastify = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

export const SERVER_STARTED_AT = Date.now();

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

fastify.register(cors, {
  origin: [
    "https://zixi-casino.vercel.app",
    "https://zixi-casino-beta.vercel.app",
    "https://device-linker-api.vercel.app",
    "http://localhost:5173",
    "https://zixi-casino-api.onrender.com",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-session-id"],
});

fastify.register(compress, { global: true, threshold: 1024 });

// Global Error Handler
fastify.setErrorHandler((error, request, reply) => {
  console.error("Global Error Handler:", {
    message: error?.message,
    stack: error?.stack,
    name: error?.name,
    cause: error?.cause ? String(error.cause) : undefined,
  });
  if (error.validation) {
    reply.status(400).send({
        success: false,
        error: "VALIDATION_ERROR",
        message: error.message,
    });
    return;
  }
  reply.status(500).send({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: error.message,
  });
});

// Global preHandler: resolve session context for all routes
const _sessionRepo = new SessionRepository();
const _userRepo = new UserRepository();
fastify.addHook('preHandler', async (request: any) => {
  const sessionId = request.headers?.["x-session-id"] || request.query?.sessionId || request.body?.sessionId;
  if (!sessionId) return;
  const session = await _sessionRepo.getSessionById(String(sessionId));
  if (!session || session.status !== "authorized") return;
  const user = await _userRepo.getUserById(session.userId);
  if (!user) return;
  request.ctx = { session, user };
});

// Internal health check (limited info, no auth required)
fastify.get("/api/diag", async (request) => {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    let dbStatus = "unknown";

    if (connectionString) {
        try {
            const sql = postgres(connectionString, { ssl: 'require', connect_timeout: 5 });
            await sql`SELECT 1`;
            dbStatus = "connected";
            await sql.end();
        } catch (e: any) {
            dbStatus = `error: ${e.message}`;
        }
    } else {
        dbStatus = "missing_env";
    }

    return {
        status: "ok",
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        db: {
            status: dbStatus,
        }
    };
});

fastify.get("/api/diag-thumb", async () => {
    return {
        status: "ok",
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    };
});

// API 快取
registerCachePlugin(fastify).catch(console.error);

// 註冊路由
fastify.register(legacyRoutes, { prefix: "/api" });
fastify.register(authRoutes, { prefix: "/api/v1/auth" });
fastify.register(walletRoutes, { prefix: "/api/v1/wallet" });
fastify.register(gameRoutes, { prefix: "/api/v1/games" });
fastify.register(marketRoutes, { prefix: "/api/v1/market" });
fastify.register(rewardRoutes, { prefix: "/api/v1/rewards" });
fastify.register(meRoutes, { prefix: "/api/v1/me" });
fastify.register(statsRoutes, { prefix: "/api/v1/stats" });
fastify.register(adminRoutes, { prefix: "/api/v1/admin" });
fastify.register(supportRoutes, { prefix: "/api/v1/support" });
fastify.register(profileRoutes, { prefix: "/api/v1/profile" });
fastify.register(announcementRoutes, { prefix: "/api/v1/announcements" });
fastify.register(transactionRoutes, { prefix: "/api/v1/transactions" });
fastify.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
// Phase 3: New routes
fastify.register(leaderboardRoutes, { prefix: "/api/v1/leaderboard" });
fastify.register(vipRoutes, { prefix: "/api/v1/vip" });
fastify.register(marketListingRoutes, { prefix: "/api/v1/market-listings" });
// Phase 3: 12 Individual Game routes - now with on-chain settlement
fastify.register(slotsRoutes, { prefix: "/api/v1/games/slots" });
fastify.register(coinflipRoutes, { prefix: "/api/v1/games/coinflip" });
fastify.register(rouletteRoutes, { prefix: "/api/v1/games/roulette" });
fastify.register(horseRoutes, { prefix: "/api/v1/games/horse" });
fastify.register(sicboRoutes, { prefix: "/api/v1/games/sicbo" });
fastify.register(bingoRoutes, { prefix: "/api/v1/games/bingo" });
fastify.register(duelRoutes, { prefix: "/api/v1/games/duel" });
fastify.register(blackjackRoutes, { prefix: "/api/v1/games/blackjack" });
fastify.register(crashRoutes, { prefix: "/api/v1/games/crash" });
fastify.register(pokerRoutes, { prefix: "/api/v1/games/poker" });
fastify.register(bluffdiceRoutes, { prefix: "/api/v1/games/bluffdice" });
fastify.register(shootDragonGateRoutes, { prefix: "/api/v1/games/shoot-dragon-gate" });
// v1.1.0: Company simulation (beta)
fastify.register(companyRoutes, { prefix: "/api/v1/company" });
// Phase 6: Chest / inventory
fastify.register(chestRoutes, { prefix: "/api/v1/chests" });
fastify.register(inventoryRoutes, { prefix: "/api/v1/inventory" });
fastify.register(pawnRoutes, { prefix: "/api/v1/pawn" });
fastify.register(giftRoutes, { prefix: "/api/v1/gift" });
fastify.register(missionRoutes, { prefix: "/api/v1/missions" });

fastify.get("/health", async () => {
  return { status: "ok", env: process.env.NODE_ENV };
});

// Vercel 部署使用的 Handler
export default async (req: any, res: any) => {
  await fastify.ready();
  fastify.server.emit('request', req, res);
};

// Global error handlers to prevent silent crashes
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT_EXCEPTION:", err?.message, err?.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED_REJECTION:", reason, promise);
});

// Always start the server (Render doesn't set VERCEL, but be defensive)
const port = Number(process.env.PORT) || 3000;
const start = async () => {
  try {
    console.log("Starting server...");

    // Background: session cleanup every hour
    const cleanupInterval = setInterval(async () => {
      try {
        const { lte } = await import("drizzle-orm");
        const { sessions } = await import("@repo/infrastructure/db/schema.js");
        const { requireDb } = await import("@repo/infrastructure");
        const db = await requireDb();
        await db.delete(sessions).where(lte(sessions.expiresAt, new Date())).catch(() => {});
      } catch {}
    }, 60 * 60 * 1000);
    cleanupInterval.unref();

    // Background: process pending on-chain tx intents (worker emulation).
    // For full intents processing, deploy `apps/worker` as a Render worker service.
    const WORKER_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS) || 0;
    if (WORKER_INTERVAL_MS > 0) {
      const workerTimer = setInterval(async () => {
        try {
          const { WalletRepository } = await import("@repo/infrastructure");
          const [pending, failed] = await Promise.all([
            new WalletRepository().getPendingIntents(),
            new WalletRepository().getFailedIntents(),
          ]);
          if (pending.length > 0 || failed.length > 0) {
            console.log(`[worker] ${pending.length} pending, ${failed.length} failed intents`);
          }
        } catch {}
      }, WORKER_INTERVAL_MS);
      workerTimer.unref();
    }

    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server ready at http://localhost:${port}`);
  } catch (err: any) {
    console.error("SERVER_START_ERROR:", err?.message || err, err?.stack || "");
    process.exit(1);
  }
};

console.log("Node version:", process.version);
console.log("Calling start()...");
start().catch((err) => {
  console.error("start() promise rejected:", err?.message || err);
  process.exit(1);
});
