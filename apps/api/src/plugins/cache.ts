import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { kv } from "@repo/infrastructure";

type CacheConfig = {
  ttl: number;
  keyFn?: (req: FastifyRequest) => string;
  skip?: (req: FastifyRequest) => boolean;
};

const routeCacheConfig: Record<string, CacheConfig> = {
  "GET:/api/v1/stats/health": { ttl: 60 },
  "GET:/api/v1/stats/leaderboard": { ttl: 300, keyFn: (req) => `lb:${String((req.query as any)?.type || "total_bet")}` },
  "GET:/api/v1/stats/recent-txs": { ttl: 30 },
  "GET:/api/v1/leaderboard": { ttl: 300, keyFn: (req) => `lb:${String((req.query as any)?.type || "total_bet")}` },
  "GET:/api/v1/chests": { ttl: 60 },
  "GET:/api/v1/market-listings": { ttl: 30 },
  "GET:/api/v1/dashboard/transactions": { ttl: 30, keyFn: (req) => `tx:${String((req.query as any)?.page || 1)}` },
  "GET:/api/v1/dashboard/summary": { ttl: 30 },
  "GET:/api/v1/announcements": { ttl: 120 },
  "GET:/api/v1/support/chat/messages": { ttl: 10 },
  "GET:/api/v1/company": { ttl: 15, keyFn: (req) => `company:${String((req.query as any)?.sessionId || "")}` },
  "GET:/api/v1/company/investable": { ttl: 60 },
  "GET:/api/v1/company/hire-preview": { ttl: 300 },
  "GET:/api/v1/gift/recipients": { ttl: 30 },
};

function getConfig(method: string, url: string): CacheConfig | undefined {
  const path = url.split("?")[0];
  return routeCacheConfig[`${method}:${path}`];
}

function getCacheKey(method: string, url: string, config: CacheConfig, req: FastifyRequest): string {
  const path = url.split("?")[0];
  const suffix = config.keyFn ? config.keyFn(req) : "";
  return `api:${method}:${path}:${suffix}`;
}

export async function registerCachePlugin(fastify: FastifyInstance) {
  // onRequest: check cache for GET requests
  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== "GET") return;

    const config = getConfig("GET", req.url);
    if (!config) return;

    const cacheKey = getCacheKey("GET", req.url, config, req);
    const cached = await kv.get<string>(cacheKey);
    if (cached !== null) {
      reply.header("x-cache", "HIT");
      reply.type("application/json").send(JSON.parse(cached));
      // Prevent the route handler from running
      (reply as any).handled = true;
      return;
    }
  });

  // onSend: store responses in cache
  fastify.addHook("onSend", async (req: FastifyRequest, reply: FastifyReply, payload: any) => {
    if (req.method !== "GET") return;
    if ((reply as any).handled) return;
    if (reply.statusCode >= 400) return;

    const config = getConfig("GET", req.url);
    if (!config || typeof payload !== "string") return;

    const cacheKey = getCacheKey("GET", req.url, config, req);
    await kv.set(cacheKey, payload, { ex: config.ttl });
    reply.header("x-cache", "MISS");
  });
}

/**
 * Invalidate all cached responses for routes matching a namespace prefix.
 */
export async function invalidateCache(namespace: string): Promise<void> {
  // Delete by common prefixes
  const prefixes = Object.keys(routeCacheConfig)
    .filter((key) => key.includes(namespace))
    .map((key) => {
      const [, path] = key.split(":");
      return `api:GET:${path}:`;
    });

  for (const prefix of prefixes) {
    // Store a version counter so cached entries are effectively invalidated
    await kv.set(`cache:inv:${prefix}`, Date.now());
  }
}
