import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { kv, requireDb } from "@repo/infrastructure";
import { SessionRepository, WalletRepository, OpsRepository } from "@repo/infrastructure";
import { getSessionContext } from "../../utils/auth.js";
import { gameSettlement } from "../../utils/game-settlement.js";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import * as schema from "@repo/infrastructure/db/schema.js";

async function getYjcVipLevel(address: string): Promise<number> {
  try {
    const db = await requireDb();
    const profile = await db
      .select({ activeBuffs: schema.userProfiles.activeBuffs })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.address, address.toLowerCase()))
      .limit(1);
    const buffs: any[] = (profile[0]?.activeBuffs as any[]) || [];
    if (buffs.some((b: any) => b.id === 'vip_2_permanent' || b.type === 'vip_tier' && b.value === 2)) return 2;
    if (buffs.some((b: any) => b.id === 'vip_1_permanent' || b.type === 'vip_tier' && b.value === 1)) return 1;
  } catch {}
  return 0;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const ALL_MISSIONS = [
  { id: 'bet_1k', name: '初試身手', desc: '累計下注 1,000 ZXC', target: 1000, reward: 500, vip: 0, track: 'bet' },
  { id: 'bet_10k', name: '小試牛刀', desc: '累計下注 10,000 ZXC', target: 10000, reward: 3000, vip: 0, track: 'bet' },
  { id: 'bet_100k', name: '大顯身手', desc: '累計下注 100,000 ZXC', target: 100000, reward: 15000, vip: 0, track: 'bet' },
  { id: 'bet_1m', name: '豪客登場', desc: '累計下注 1,000,000 ZXC', target: 1000000, reward: 80000, vip: 0, track: 'bet' },
  { id: 'win_1', name: '首勝', desc: '贏得 1 局遊戲', target: 1, reward: 500, vip: 0, track: 'win' },
  { id: 'win_5', name: '贏家日', desc: '贏得 5 局遊戲', target: 5, reward: 3000, vip: 0, track: 'win' },
  { id: 'win_20', name: '常勝軍', desc: '贏得 20 局遊戲', target: 20, reward: 12000, vip: 0, track: 'win' },
  { id: 'streak_1', name: '初次簽到', desc: '簽到 1 天', target: 1, reward: 1000, vip: 0, track: 'streak' },
  { id: 'streak_3', name: '簽到達人', desc: '連續簽到 3 天', target: 3, reward: 5000, vip: 0, track: 'streak' },
  { id: 'streak_7', name: '一週達人', desc: '連續簽到 7 天', target: 7, reward: 20000, vip: 0, track: 'streak' },
  { id: 'coinflip_3', name: '硬幣大師', desc: '玩 3 局擲硬幣', target: 3, reward: 1500, vip: 0, track: 'coinflip' },
  { id: 'coinflip_10', name: '硬幣收藏家', desc: '玩 10 局擲硬幣', target: 10, reward: 6000, vip: 0, track: 'coinflip' },
  { id: 'roulette_3', name: '輪盤手', desc: '玩 3 局輪盤', target: 3, reward: 2000, vip: 0, track: 'roulette' },
  { id: 'roulette_10', name: '輪盤老手', desc: '玩 10 局輪盤', target: 10, reward: 8000, vip: 0, track: 'roulette' },
  { id: 'slots_5', name: '拉霸初體驗', desc: '玩 5 局老虎機', target: 5, reward: 2000, vip: 0, track: 'slots' },
  { id: 'slots_20', name: '拉霸狂人', desc: '玩 20 局老虎機', target: 20, reward: 10000, vip: 0, track: 'slots' },
  { id: 'horse_3', name: '賽馬迷', desc: '玩 3 局賽馬', target: 3, reward: 2500, vip: 0, track: 'horse' },
  { id: 'sicbo_3', name: '骰寶愛好者', desc: '玩 3 局骰寶', target: 3, reward: 2000, vip: 0, track: 'sicbo' },
  { id: 'bingo_3', name: '賓果玩家', desc: '玩 3 局賓果', target: 3, reward: 2000, vip: 0, track: 'bingo' },
  { id: 'blackjack_5', name: '21 點新手', desc: '玩 5 局 21 點', target: 5, reward: 3000, vip: 0, track: 'blackjack' },
  { id: 'crash_3', name: '暴漲挑戰', desc: '玩 3 局暴漲', target: 3, reward: 2500, vip: 0, track: 'crash' },
  { id: 'vip_bet_1m', name: 'VIP 下注', desc: '累計下注 1,000,000 ZXC', target: 1000000, reward: 100000, vip: 1, track: 'bet' },
  { id: 'vip_bet_10m', name: 'VIP 大額下注', desc: '累計下注 10,000,000 ZXC', target: 10000000, reward: 500000, vip: 1, track: 'bet' },
  { id: 'vip_win_10', name: 'VIP 常勝', desc: '贏得 10 局遊戲', target: 10, reward: 50000, vip: 1, track: 'win' },
  { id: 'vip_slots_50', name: 'VIP 拉霸', desc: '玩 50 局老虎機', target: 50, reward: 40000, vip: 1, track: 'slots' },
  { id: 'vip_roulette_20', name: 'VIP 輪盤', desc: '玩 20 局輪盤', target: 20, reward: 30000, vip: 1, track: 'roulette' },
  { id: 'vip_blackjack_10', name: 'VIP 21 點', desc: '玩 10 局 21 點', target: 10, reward: 25000, vip: 1, track: 'blackjack' },
  { id: 'vip_poker_5', name: 'VIP 撲克', desc: '玩 5 局撲克', target: 5, reward: 20000, vip: 1, track: 'poker' },
  { id: 'vip_horse_10', name: 'VIP 賽馬', desc: '玩 10 局賽馬', target: 10, reward: 30000, vip: 1, track: 'horse' },
  { id: 'vip_crash_10', name: 'VIP 暴漲', desc: '玩 10 局暴漲', target: 10, reward: 35000, vip: 1, track: 'crash' },
  { id: 'vip_duel_5', name: 'VIP 對決', desc: '玩 5 局對決', target: 5, reward: 20000, vip: 1, track: 'duel' },
  { id: 'vip_dragon_5', name: 'VIP 射龍門', desc: '玩 5 局射龍門', target: 5, reward: 20000, vip: 1, track: 'dragon' },
  { id: 'vip_bluffdice_5', name: 'VIP 吹牛', desc: '玩 5 局吹牛骰', target: 5, reward: 20000, vip: 1, track: 'bluffdice' },
  { id: 'vip_streak_14', name: 'VIP 半月簽', desc: '連續簽到 14 天', target: 14, reward: 100000, vip: 1, track: 'streak' },
  { id: 'vip_streak_30', name: 'VIP 月簽王', desc: '連續簽到 30 天', target: 30, reward: 500000, vip: 1, track: 'streak' },
  { id: 'vip2_bet_100m', name: '至尊下注', desc: '累計下注 100,000,000 ZXC', target: 100000000, reward: 2000000, vip: 2, track: 'bet' },
  { id: 'vip2_bet_1b', name: '傳奇下注', desc: '累計下注 1,000,000,000 ZXC', target: 1000000000, reward: 10000000, vip: 2, track: 'bet' },
  { id: 'vip2_win_50', name: '至尊常勝', desc: '贏得 50 局遊戲', target: 50, reward: 1000000, vip: 2, track: 'win' },
  { id: 'vip2_all_games', name: '全能玩家', desc: '玩過全部 12 種遊戲', target: 12, reward: 500000, vip: 2, track: 'all_games' },
  { id: 'vip2_streak_60', name: '至尊簽到', desc: '連續簽到 60 天', target: 60, reward: 2000000, vip: 2, track: 'streak' },
];

function pickDailyMissions(today: string, addr: string, yjcVip: number) {
  const eligible = ALL_MISSIONS.filter(m => m.vip <= yjcVip);
  const seed = `mission:${today}:${addr}`;
  let h = fnv1a32(seed);
  const picked: typeof ALL_MISSIONS = [];
  const pool = [...eligible];
  const count = Math.min(4, pool.length);
  while (picked.length < count && pool.length > 0) {
    const idx = h % pool.length;
    picked.push(pool[idx]);
    pool.splice(idx, 1);
    h = Math.imul(h + 1, 0x01000193) >>> 0;
  }
  return picked;
}

function getProgress(m: typeof ALL_MISSIONS[0], betRaw: number, winRaw: number, streakRaw: number): number {
  if (m.track === 'bet') return Math.min(betRaw, m.target);
  if (m.track === 'win') return Math.min(winRaw, m.target);
  if (m.track === 'streak') return Math.min(streakRaw, m.target);
  return 0;
}

export async function missionRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const sessionRepo = new SessionRepository();
  const getContext = (req: any) => getSessionContext(req, sessionRepo);

  typedFastify.get("/", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

    const today = new Date().toISOString().slice(0, 10);
    const addr = ctx.address.toLowerCase();
    const [betRaw, winRaw, streakRaw, claimedRaw, yjcVip] = await Promise.all([
      kv.get<number>(`mission:bet:${addr}:${today}`),
      kv.get<number>(`mission:win:${addr}:${today}`),
      kv.get<number>(`checkin_streak:${addr}`),
      kv.get<string[]>(`mission:claimed:${addr}:${today}`),
      getYjcVipLevel(addr),
    ]);

    const claimed = claimedRaw || [];
    const dailyMissions = pickDailyMissions(today, addr, yjcVip);
    const missions = dailyMissions.map(m => {
      const claimed2 = claimed.includes(m.id);
      if (claimed2) return null; // hide claimed missions
      return {
        ...m,
        progress: getProgress(m, betRaw || 0, winRaw || 0, streakRaw || 0),
        claimed: false,
        locked: false,
      };
    }).filter(Boolean);

    return createApiEnvelope({ missions, date: today, vipLevel: yjcVip }, request.id);
  });

  typedFastify.post("/claim", {
    schema: { body: z.object({ sessionId: z.string(), missionId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

    const { missionId } = request.body;
    const mission = ALL_MISSIONS.find(m => m.id === missionId);
    if (!mission) return createApiEnvelope({ error: { message: "未知任務" } }, request.id);

    const today = new Date().toISOString().slice(0, 10);
    const addr = ctx.address.toLowerCase();

    const claimedRaw = await kv.get<string[]>(`mission:claimed:${addr}:${today}`);
    const claimed = claimedRaw || [];
    if (claimed.includes(missionId)) return createApiEnvelope({ error: { message: "已領取" } }, request.id);

    // Check progress
    let progress = 0;
    if (mission.track === 'bet') progress = await kv.get<number>(`mission:bet:${addr}:${today}`) || 0;
    else if (mission.track === 'win') progress = await kv.get<number>(`mission:win:${addr}:${today}`) || 0;
    else if (mission.track === 'streak') progress = await kv.get<number>(`checkin_streak:${addr}`) || 0;
    if (progress < mission.target) return createApiEnvelope({ error: { message: `進度不足 (${progress}/${mission.target})` } }, request.id);

    // Credit reward
    const prev = await gameSettlement.getBalance(addr, "zhixi");
    await gameSettlement.setBalance(addr, "zhixi", (parseFloat(prev || "0") + mission.reward).toString());

    // Mark claimed
    claimed.push(missionId);
    await kv.set(`mission:claimed:${addr}:${today}`, claimed);

    // Ledger entry
    const walletRepo = new WalletRepository();
    await walletRepo.saveLedgerEntry({
      id: randomUUID(), userId: ctx.userId, address: addr,
      token: "zhixi", type: "mission_reward", amount: String(mission.reward),
      balanceBefore: prev || "0", balanceAfter: (parseFloat(prev || "0") + mission.reward).toFixed(4),
      meta: { missionId, date: today }, createdAt: new Date(),
    });

    return createApiEnvelope({ success: true, reward: mission.reward, missionId }, request.id);
  });
}
