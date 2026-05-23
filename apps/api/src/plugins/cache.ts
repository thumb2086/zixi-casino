import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { kv } from "@repo/infrastructure";

type CacheConfig = {
  ttl: number;
  keyFn?: (req: FastifyRequest) => string;
};

const routeCacheConfig: Record<string, CacheConfig> = {
  // Stats & Health
  "GET:/api/v1/stats/health": { ttl: 60 },
  "GET:/api/v1/stats/leaderboard": { ttl: 300, keyFn: (req) => `lb:${String((req.query as any)?.type || "total_bet")}` },
  "GET:/api/v1/stats/recent-txs": { ttl: 30 },

  // Leaderboard
  "GET:/api/v1/leaderboard": { ttl: 300, keyFn: (req) => `lb:${String((req.query as any)?.type || "total_bet")}` },

  // Chests & Inventory
  "GET:/api/v1/chests": { ttl: 60 },
  "GET:/api/v1/chests/items": { ttl: 300 },
  "GET:/api/v1/chests/status": { ttl: 30, keyFn: (req) => `cs:${String((req.query as any)?.sessionId || "")}` },
  "GET:/api/v1/inventory": { ttl: 30, keyFn: (req) => `inv:${String((req.query as any)?.sessionId || "")}` },

  // Market
  "GET:/api/v1/market-listings": { ttl: 30 },
  "GET:/api/v1/market-listings/mine": { ttl: 30, keyFn: (req) => `mlm:${String((req.query as any)?.sessionId || "")}` },
  "GET:/api/v1/market/me": { ttl: 30, keyFn: (req) => `mm:${String((req.query as any)?.sessionId || "")}` },
  "GET:/api/v1/market/snapshot": { ttl: 30 },

  // Dashboard
  "GET:/api/v1/dashboard/transactions": { ttl: 30, keyFn: (req) => `tx:${String((req.query as any)?.page || 1)}` },
  "GET:/api/v1/dashboard/summary": { ttl: 30 },

  // Auth & Profile
  "GET:/api/v1/auth/me": { ttl: 30, keyFn: (req) => `auth:${String((req.query as any)?.sessionId || (req.headers as any)["x-session-id"] || "")}` },
  "GET:/api/v1/auth/status": { ttl: 5 },
  "GET:/api/v1/me/profile": { ttl: 30, keyFn: (req) => `prof:${String((req.query as any)?.sessionId || "")}` },
  "GET:/api/v1/profile/prefs": { ttl: 120, keyFn: (req) => `prefs:${String((req.query as any)?.sessionId || "")}` },

  // Wallet
  "GET:/api/v1/wallet/summary": { ttl: 30, keyFn: (req) => `ws:${String((req.query as any)?.sessionId || "")}` },

  // Company
  "GET:/api/v1/company": { ttl: 15, keyFn: (req) => `company:${String((req.query as any)?.sessionId || "")}` },
  "GET:/api/v1/company/investable": { ttl: 60 },
  "GET:/api/v1/company/hire-preview": { ttl: 300 },

  // Rewards
  "GET:/api/v1/rewards/catalog": { ttl: 120 },
  "GET:/api/v1/rewards/campaigns": { ttl: 60 },
  "GET:/api/v1/rewards/avatars/catalog": { ttl: 300 },
  "GET:/api/v1/rewards/titles/catalog": { ttl: 300 },
  "GET:/api/v1/rewards/submissions/me": { ttl: 30, keyFn: (req) => `rsub:${String((req.query as any)?.sessionId || "")}` },
  "GET:/api/v1/rewards/summary": { ttl: 60, keyFn: (req) => `rsum:${String((req.query as any)?.sessionId || "")}` },

  // Support & Chat
  "GET:/api/v1/support/announcements": { ttl: 120 },
  "GET:/api/v1/announcements": { ttl: 120 },

  // VIP
  "GET:/api/v1/vip/me": { ttl: 60, keyFn: (req) => `vip:${String((req.query as any)?.sessionId || "")}` },

  // Games
  "GET:/api/v1/games/rooms": { ttl: 15 },
  "GET:/api/v1/games/coinflip/round": { ttl: 5 },
  "GET:/api/v1/games/horse/round": { ttl: 5 },
  "GET:/api/v1/games/roulette/round": { ttl: 5 },
  "GET:/api/v1/games/sicbo/round": { ttl: 5 },
  "GET:/api/v1/games/bingo/round": { ttl: 5 },

  // Gift
  "GET:/api/v1/gift/recipients": { ttl: 30 },

  // Admin (public, non-sensitive)
  "GET:/api/v1/admin/ops/health": { ttl: 30 },
  "GET:/api/v1/admin/ops/events": { ttl: 15 },
  "GET:/api/v1/admin/announcements": { ttl: 60 },
  "GET:/api/v1/admin/reward-catalog": { ttl: 120 },
  "GET:/api/v1/admin/submissions": { ttl: 30 },
  "GET:/api/v1/admin/campaigns": { ttl: 60 },
  "GET:/api/v1/admin/users": { ttl: 15 },
  "GET:/api/v1/admin/tickets": { ttl: 30 },
  "GET:/api/v1/admin/blacklist": { ttl: 30 },

  // Health ping
  "GET:/health": { ttl: 60 },
};

function getConfig(method: string, url: string): CacheConfig | undefined {
  const path = url.split("?")[0];
  // Try exact match first, then parameterized match
  const exact = `${method}:${path}`;
  if (routeCacheConfig[exact]) return routeCacheConfig[exact];
  // Try parent paths for dynamic routes
  const parts = path.split("/");
  for (let i = parts.length - 1; i >= 3; i--) {
    const parent = parts.slice(0, i).join("/");
    if (routeCacheConfig[`${method}:${parent}`]) return routeCacheConfig[`${method}:${parent}`];
  }
  return undefined;
}

function getCacheKey(method: string, url: string, config: CacheConfig, req: FastifyRequest): string {
  const path = url.split("?")[0];
  const suffix = config.keyFn ? config.keyFn(req) : "";
  return `api:${method}:${path}:${suffix}`;
}

export async function registerCachePlugin(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      if (req.method !== "GET") return;
      const config = getConfig("GET", req.url);
      if (!config) return;

      const cacheKey = getCacheKey("GET", req.url, config, req);
      const cached = await kv.get<string>(cacheKey);
      if (cached !== null) {
        reply.header("x-cache", "HIT");
        return reply.type("application/json").send(JSON.parse(cached));
      }
    } catch {
      // Cache miss or error - continue to route handler
    }
  });

  fastify.addHook("onSend", async (req: FastifyRequest, reply: FastifyReply, payload: any) => {
    try {
      if (req.method !== "GET") return;
      if (reply.statusCode >= 400) return;
      const config = getConfig("GET", req.url);
      if (!config || typeof payload !== "string") return;

      const cacheKey = getCacheKey("GET", req.url, config, req);
      await kv.set(cacheKey, payload, { ex: config.ttl });
      reply.header("x-cache", "MISS");
    } catch {
      // Cache write failure - non-critical
    }
  });
}

export async function invalidateCache(namespace: string): Promise<void> {
  const prefixes = Object.keys(routeCacheConfig)
    .filter((key) => key.includes(namespace))
    .map((key) => `api:GET:${key.split(":")[1]}:`);
  for (const prefix of prefixes) {
    await kv.set(`cache:inv:${prefix}`, Date.now()).catch(() => {});
  }
}
