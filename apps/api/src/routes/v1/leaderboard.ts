// apps/api/src/routes/v1/leaderboard.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { createApiEnvelope, ITEM_DROP_TABLES, LEVEL_TIERS } from "@repo/shared";
import { LeaderboardManager } from "@repo/domain/leaderboard/leaderboard-manager.js";
import { OnchainWalletManager } from "@repo/domain";
import * as schema from "@repo/infrastructure/db/schema.js";
import { requireDb, WalletRepository } from "@repo/infrastructure/db/index.js";
import { ChainClient, kv, RewardCatalogRepository } from "@repo/infrastructure";
import { TITLES } from "@repo/domain";

const ASSET_LB_SYNC_KEY = "leaderboard:asset:last_onchain_sync_at";
const ASSET_LB_SYNC_INTERVAL_MS = 60 * 60 * 1000;

export async function leaderboardRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const walletRepo = new WalletRepository();
  const onchainWallet = new OnchainWalletManager();
  const rewardCatalogRepo = new RewardCatalogRepository();

  // Attach each leaderboard entry's equipped avatar + title (emoji + label)
  const enrichEntriesWithCosmetics = async (entries: Array<any>) => {
    if (!entries?.length) return;
    const db = await requireDb();
    const addresses = entries.map((e) => String(e?.address || "").toLowerCase()).filter(Boolean);

    // Batch fetch all profiles at once
    const profiles: Array<{ address: string; selectedAvatarId: string | null; selectedTitleId: string | null }> = [];
    if (addresses.length > 0) {
      try {
        const rows = await db.select({
          address: schema.userProfiles.address,
          selectedAvatarId: schema.userProfiles.selectedAvatarId,
          selectedTitleId: schema.userProfiles.selectedTitleId,
        }).from(schema.userProfiles).where(sql`${schema.userProfiles.address} = ANY(${addresses})`);
        profiles.push(...rows as any);
      } catch {}
    }
    const profileMap = new Map(profiles.map((p) => [p.address.toLowerCase(), p]));

    const customItems = await rewardCatalogRepo.listItems({}).catch(() => [] as any[]);
    const avatarMap = new Map<string, { id: string; icon?: string; label?: string }>();
    const titleMap = new Map<string, { id: string; label?: string }>();
    for (const t of TITLES) titleMap.set(t.id, { id: t.id, label: t.label });
    for (const row of customItems as any[]) {
      if (row.type === "avatar") avatarMap.set(row.itemId, { id: row.itemId, icon: row.icon, label: row.name });
      if (row.type === "title") titleMap.set(row.itemId, { id: row.itemId, label: row.name });
    }
    for (const rarity of Object.keys(ITEM_DROP_TABLES) as (keyof typeof ITEM_DROP_TABLES)[]) {
      for (const item of ITEM_DROP_TABLES[rarity]) {
        if (item.type === "avatar" && !avatarMap.has(item.id)) avatarMap.set(item.id, { id: item.id, icon: item.icon, label: item.name });
        if (item.type === "title" && !titleMap.has(item.id)) titleMap.set(item.id, { id: item.id, label: item.name });
      }
    }

    for (const entry of entries) {
      const addr = String(entry?.address || "").toLowerCase();
      if (!addr) continue;
      const profile = profileMap.get(addr);
      const avId = profile?.selectedAvatarId || "classic_chip";
      const tiId = profile?.selectedTitleId || "title_newbie";
      const av = avatarMap.get(avId) || avatarMap.get("classic_chip");
      const ti = titleMap.get(tiId) || titleMap.get("title_newbie") || titleMap.get("newbie");
      entry.activeAvatarId = av?.id ?? null;
      entry.activeAvatarIcon = av?.icon ?? null;
      entry.activeTitleId = ti?.id ?? null;
      entry.activeTitleLabel = ti?.label ?? null;

      entry.vipLevel = entry.tierLabel || LEVEL_TIERS[0]?.label || "普通會員";
    }
  };

  // Helper to get context and address
  const getAddressFromRequest = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) return undefined;
    
    const db = await requireDb();
    const session = await db.query.sessions.findFirst({
      where: (sessions: any, { eq }: any) => eq(sessions.id, sessionId)
    });
    
    if (!session || session.status !== "authorized") return undefined;
    return session.address;
  };

  // GET /api/v1/leaderboard?type=xp&limit=50
  typedFastify.get("/", {
    schema: {
      querystring: z.object({
        type: z.enum(["xp", "asset", "all", "week", "month", "season", "kings"]).default("xp"),
        limit: z.coerce.number().min(1).max(100).default(50),
        sync: z.enum(["auto", "force", "off"]).default("auto"),
        sessionId: z.string().optional(),
      }),
    },
  }, async (request) => {
    const { type, limit, sync } = request.query as {
      type: string;
      limit: number;
      sync: string;
    };
    // Map legacy types to xp
    const mappedType = (["all", "week", "month", "season", "kings"].includes(type)) ? "xp" : type;
    
    const selfAddress = await getAddressFromRequest(request);

    try {
      const db = await requireDb();
      const manager = new LeaderboardManager(db);

      if (mappedType === "asset") {
        const syncEnabled = String(process.env.ASSET_LEADERBOARD_SYNC_ONCHAIN_ON_READ ?? "true").toLowerCase() !== "false";
        if (syncEnabled && sync !== "off") {
          const now = Date.now();
          const lastSyncAt = Number(await kv.get<number>(ASSET_LB_SYNC_KEY) || 0);
          const syncEveryRead = String(process.env.ASSET_LEADERBOARD_SYNC_EVERY_READ ?? "false").toLowerCase() !== "false";
          const shouldSync = sync === "force"
            || syncEveryRead
            || (!syncEveryRead && (now - lastSyncAt >= ASSET_LB_SYNC_INTERVAL_MS));

          if (shouldSync) {
            try {
              const runtime = onchainWallet.getRuntimeConfig();
              const tokens = [
                { key: "zhixi" as const, config: runtime.tokens?.zhixi },
                { key: "yjc" as const, config: runtime.tokens?.yjc },
              ].filter((t) => t.config?.enabled && t.config?.contractAddress);

              if (runtime.rpcUrl && runtime.adminPrivateKey && tokens.length > 0) {
                const client = new ChainClient(runtime.rpcUrl, runtime.adminPrivateKey);
                const tokenMeta = await Promise.all(tokens.map(async (t) => ({
                  key: t.key,
                  contractAddress: t.config!.contractAddress,
                  decimals: await client.getDecimals(t.config!.contractAddress, 18),
                })));

                const userAddresses: Array<{ address: string }> = await db
                  .selectDistinct({ address: schema.users.address })
                  .from(schema.users);
                const sessionAddresses: Array<{ address: string | null }> = await db
                  .selectDistinct({ address: schema.sessions.address })
                  .from(schema.sessions)
                  .where(sql`${schema.sessions.address} IS NOT NULL`);
                const walletAddresses: Array<{ address: string }> = await db
                  .selectDistinct({ address: schema.walletAccounts.address })
                  .from(schema.walletAccounts);

                const addresses = Array.from(new Set([
                  ...userAddresses.map((r) => r.address),
                  ...sessionAddresses.map((r) => String(r.address || "").toLowerCase()).filter(Boolean),
                  ...walletAddresses.map((r) => r.address),
                ]));

                // Batch sync with concurrency limit to avoid RPC flood
                const BATCH_SIZE = 10;
                const normalizedAddrs = addresses.map((a) => a.toLowerCase());
                for (let i = 0; i < normalizedAddrs.length; i += BATCH_SIZE) {
                  const batch = normalizedAddrs.slice(i, i + BATCH_SIZE);
                  await Promise.all(batch.map(async (addr) => {
                    await Promise.all(tokenMeta.map(async (token) => {
                      try {
                        const raw = await client.getBalance(addr, token.contractAddress);
                        const balance = client.formatUnits(raw, token.decimals);
                        await walletRepo.updateBalance(addr, balance, token.key);
                      } catch {}
                    }));
                  }));
                }
                await kv.set(ASSET_LB_SYNC_KEY, now);
              }
            } catch (error) {
              request.log.warn({ error }, "asset leaderboard on-chain sync failed");
            }
          }
        }

        const includeMarketAssets = process.env.ASSET_LEADERBOARD_INCLUDE_MARKET === "true";
        const result = await manager.getAssetLeaderboard(selfAddress, limit, includeMarketAssets);
        await enrichEntriesWithCosmetics(result.entries);
        if (result.selfRank) await enrichEntriesWithCosmetics([result.selfRank]);
        return createApiEnvelope({ success: true, data: result }, request.id);
      }

      const result = await manager.getXpLeaderboard(selfAddress, limit);
      await enrichEntriesWithCosmetics(result.entries);
      if (result.selfRank) await enrichEntriesWithCosmetics([result.selfRank]);
      return createApiEnvelope({ success: true, data: result }, request.id);
    } catch (err: any) {
      console.error("[leaderboard] error:", err);
      return createApiEnvelope(
        { success: false, error: { code: "INTERNAL_ERROR", message: err.message } },
        request.id
      );
    }
  });
}
