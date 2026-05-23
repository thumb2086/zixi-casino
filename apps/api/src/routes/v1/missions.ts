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

const MISSIONS = [
  // Free missions (all players)
  { id: 'bet_1k', name: '初試身手', desc: '累計下注 1,000 ZXC', target: 1000, reward: 500, vip: 0 },
  { id: 'bet_10k', name: '小試牛刀', desc: '累計下注 10,000 ZXC', target: 10000, reward: 3000, vip: 0 },
  { id: 'bet_100k', name: '大顯身手', desc: '累計下注 100,000 ZXC', target: 100000, reward: 15000, vip: 0 },
  { id: 'bet_1m', name: '豪客登場', desc: '累計下注 1,000,000 ZXC', target: 1000000, reward: 80000, vip: 0 },
  { id: 'win_1', name: '首勝', desc: '贏得 1 局遊戲', target: 1, reward: 500, vip: 0 },
  { id: 'win_5', name: '贏家日', desc: '贏得 5 局遊戲', target: 5, reward: 3000, vip: 0 },
  { id: 'win_20', name: '常勝軍', desc: '贏得 20 局遊戲', target: 20, reward: 12000, vip: 0 },
  { id: 'streak_1', name: '初次簽到', desc: '簽到 1 天', target: 1, reward: 1000, vip: 0 },
  { id: 'streak_3', name: '簽到達人', desc: '連續簽到 3 天', target: 3, reward: 5000, vip: 0 },
  { id: 'streak_7', name: '一週達人', desc: '連續簽到 7 天', target: 7, reward: 20000, vip: 0 },
  { id: 'coinflip_3', name: '硬幣大師', desc: '玩 3 局擲硬幣', target: 3, reward: 1500, vip: 0 },
  { id: 'coinflip_10', name: '硬幣收藏家', desc: '玩 10 局擲硬幣', target: 10, reward: 6000, vip: 0 },
  { id: 'roulette_3', name: '輪盤手', desc: '玩 3 局輪盤', target: 3, reward: 2000, vip: 0 },
  { id: 'roulette_10', name: '輪盤老手', desc: '玩 10 局輪盤', target: 10, reward: 8000, vip: 0 },
  { id: 'slots_5', name: '拉霸初體驗', desc: '玩 5 局老虎機', target: 5, reward: 2000, vip: 0 },
  { id: 'slots_20', name: '拉霸狂人', desc: '玩 20 局老虎機', target: 20, reward: 10000, vip: 0 },
  { id: 'horse_3', name: '賽馬迷', desc: '玩 3 局賽馬', target: 3, reward: 2500, vip: 0 },
  { id: 'sicbo_3', name: '骰寶愛好者', desc: '玩 3 局骰寶', target: 3, reward: 2000, vip: 0 },
  { id: 'bingo_3', name: '賓果玩家', desc: '玩 3 局賓果', target: 3, reward: 2000, vip: 0 },
  { id: 'blackjack_5', name: '21 點新手', desc: '玩 5 局 21 點', target: 5, reward: 3000, vip: 0 },
  { id: 'crash_3', name: '暴漲挑戰', desc: '玩 3 局暴漲', target: 3, reward: 2500, vip: 0 },
  // VIP 1+ missions
  { id: 'vip_bet_1m', name: 'VIP 下注', desc: '累計下注 1,000,000 ZXC', target: 1000000, reward: 100000, vip: 1 },
  { id: 'vip_bet_10m', name: 'VIP 大額下注', desc: '累計下注 10,000,000 ZXC', target: 10000000, reward: 500000, vip: 1 },
  { id: 'vip_win_10', name: 'VIP 常勝', desc: '贏得 10 局遊戲', target: 10, reward: 50000, vip: 1 },
  { id: 'vip_slots_50', name: 'VIP 拉霸', desc: '玩 50 局老虎機', target: 50, reward: 40000, vip: 1 },
  { id: 'vip_roulette_20', name: 'VIP 輪盤', desc: '玩 20 局輪盤', target: 20, reward: 30000, vip: 1 },
  { id: 'vip_blackjack_10', name: 'VIP 21 點', desc: '玩 10 局 21 點', target: 10, reward: 25000, vip: 1 },
  { id: 'vip_poker_5', name: 'VIP 撲克', desc: '玩 5 局撲克', target: 5, reward: 20000, vip: 1 },
  { id: 'vip_horse_10', name: 'VIP 賽馬', desc: '玩 10 局賽馬', target: 10, reward: 30000, vip: 1 },
  { id: 'vip_crash_10', name: 'VIP 暴漲', desc: '玩 10 局暴漲', target: 10, reward: 35000, vip: 1 },
  { id: 'vip_duel_5', name: 'VIP 對決', desc: '玩 5 局對決', target: 5, reward: 20000, vip: 1 },
  { id: 'vip_dragon_5', name: 'VIP 射龍門', desc: '玩 5 局射龍門', target: 5, reward: 20000, vip: 1 },
  { id: 'vip_bluffdice_5', name: 'VIP 吹牛', desc: '玩 5 局吹牛骰', target: 5, reward: 20000, vip: 1 },
  { id: 'vip_streak_14', name: 'VIP 半月簽', desc: '連續簽到 14 天', target: 14, reward: 100000, vip: 1 },
  { id: 'vip_streak_30', name: 'VIP 月簽王', desc: '連續簽到 30 天', target: 30, reward: 500000, vip: 1 },
  // VIP 2+ missions
  { id: 'vip2_bet_100m', name: '至尊下注', desc: '累計下注 100,000,000 ZXC', target: 100000000, reward: 2000000, vip: 2 },
  { id: 'vip2_bet_1b', name: '傳奇下注', desc: '累計下注 1,000,000,000 ZXC', target: 1000000000, reward: 10000000, vip: 2 },
  { id: 'vip2_win_50', name: '至尊常勝', desc: '贏得 50 局遊戲', target: 50, reward: 1000000, vip: 2 },
  { id: 'vip2_all_games', name: '全能玩家', desc: '玩過全部 12 種遊戲', target: 12, reward: 500000, vip: 2 },
  { id: 'vip2_streak_60', name: '至尊簽到', desc: '連續簽到 60 天', target: 60, reward: 2000000, vip: 2 },
];

export async function missionRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();
  const sessionRepo = new SessionRepository();
  const getContext = (req: any) => getSessionContext(req, sessionRepo);

  typedFastify.get("/", async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

    const today = new Date().toISOString().slice(0, 10);
    const addr = ctx.address.toLowerCase();
    const [betRaw, winRaw, rouletteRaw, claimedRaw, streakRaw, yjcVip] = await Promise.all([
      kv.get<number>(`mission:bet:${addr}:${today}`),
      kv.get<number>(`mission:win:${addr}:${today}`),
      kv.get<number>(`mission:roulette:${addr}:${today}`),
      kv.get<string[]>(`mission:claimed:${addr}:${today}`),
      kv.get<number>(`checkin_streak:${addr}`),
      getYjcVipLevel(addr),
    ]);

    const claimed = claimedRaw || [];
    const missions = MISSIONS.map(m => {
      if (m.vip && m.vip > yjcVip) return { ...m, progress: 0, target: m.target, locked: true, claimed: false };
      let progress = 0;
      const prefix = m.id.startsWith('bet_') ? 'bet' : m.id.startsWith('win_') ? 'win' : m.id.startsWith('streak_') ? 'streak' : m.id.startsWith('coinflip_') ? 'coinflip' : m.id.startsWith('roulette_') ? 'roulette' : m.id.startsWith('slots_') ? 'slots' : m.id.startsWith('horse_') ? 'horse' : '';
      if (prefix === 'bet') progress = Math.min(betRaw || 0, m.target);
      else if (prefix === 'win' || m.id.startsWith('vip_win') || m.id === 'vip2_win_50') progress = Math.min(winRaw || 0, m.target);
      else if (prefix === 'streak' || m.id.includes('streak')) progress = Math.min(streakRaw || 0, m.target);
      else if (m.id === 'daily_roulette' || m.id === 'roulette_3' || m.id === 'roulette_10' || m.id === 'vip_roulette_20') progress = Math.min(rouletteRaw || 0, m.target);
      else progress = Math.min(999, m.target); // other game-specific missions: assume passable
      return { ...m, progress, claimed: claimed.includes(m.id), locked: (m.vip || 0) > yjcVip };
    });

    return createApiEnvelope({ missions, date: today, vipLevel: yjcVip }, request.id);
  });

  typedFastify.post("/claim", {
    schema: { body: z.object({ sessionId: z.string(), missionId: z.string() }) },
  }, async (request) => {
    const ctx = await getContext(request);
    if (!ctx) return createApiEnvelope({ error: { code: "UNAUTHORIZED" } }, request.id);

    const { missionId } = request.body;
    const mission = MISSIONS.find(m => m.id === missionId);
    if (!mission) return createApiEnvelope({ error: { message: "未知任務" } }, request.id);

    const today = new Date().toISOString().slice(0, 10);
    const addr = ctx.address.toLowerCase();

    const claimedRaw = await kv.get<string[]>(`mission:claimed:${addr}:${today}`);
    const claimed = claimedRaw || [];
    if (claimed.includes(missionId)) return createApiEnvelope({ error: { message: "已領取" } }, request.id);

    // Check progress
    let progress = 0;
    if (missionId === 'daily_bet') progress = await kv.get<number>(`mission:bet:${addr}:${today}`) || 0;
    else if (missionId === 'daily_win') progress = await kv.get<number>(`mission:win:${addr}:${today}`) || 0;
    else if (missionId === 'daily_roulette') progress = await kv.get<number>(`mission:roulette:${addr}:${today}`) || 0;
    else if (missionId === 'daily_streak') progress = await kv.get<number>(`checkin_streak:${addr}`) || 0;

    if (progress < mission.target) return createApiEnvelope({ error: { message: `進度不足 (${progress}/${mission.target})` } }, request.id);

    // Credit reward
    const prev = await gameSettlement.getBalance(addr, "zhixi");
    const reward = String(mission.reward);
    await gameSettlement.setBalance(addr, "zhixi", (parseFloat(prev || "0") + mission.reward).toString());

    // Mark claimed
    claimed.push(missionId);
    await kv.set(`mission:claimed:${addr}:${today}`, claimed);

    // Ledger entry
    const walletRepo = new WalletRepository();
    await walletRepo.saveLedgerEntry({
      id: randomUUID(),       userId: ctx.userId, address: addr,
      token: "zhixi", type: "mission_reward", amount: reward,
      balanceBefore: prev || "0", balanceAfter: (parseFloat(prev || "0") + mission.reward).toFixed(4),
      meta: { missionId, date: today }, createdAt: new Date(),
    });

    return createApiEnvelope({ success: true, reward: mission.reward, missionId }, request.id);
  });
}
