import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createApiEnvelope } from "@repo/shared";
import { kv } from "@repo/infrastructure";
import { SessionRepository, WalletRepository, OpsRepository } from "@repo/infrastructure";
import { getSessionContext } from "../../utils/auth.js";
import { gameSettlement } from "../../utils/game-settlement.js";
import { randomUUID } from "crypto";

const MISSIONS = [
  { id: 'daily_bet', name: '每日下注', desc: '累計下注 10,000 ZXC', target: 10000, reward: 5000 },
  { id: 'daily_win', name: '贏家日', desc: '贏得 5 局遊戲', target: 5, reward: 3000 },
  { id: 'daily_roulette', name: '輪盤手', desc: '玩 3 局輪盤', target: 3, reward: 2000 },
  { id: 'daily_streak', name: '簽到達人', desc: '連續簽到 3 天', target: 3, reward: 8000 },
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
    const [betRaw, winRaw, rouletteRaw, claimedRaw, streakRaw] = await Promise.all([
      kv.get<number>(`mission:bet:${addr}:${today}`),
      kv.get<number>(`mission:win:${addr}:${today}`),
      kv.get<number>(`mission:roulette:${addr}:${today}`),
      kv.get<string[]>(`mission:claimed:${addr}:${today}`),
      kv.get<number>(`checkin_streak:${addr}`),
    ]);

    const claimed = claimedRaw || [];
    const missions = MISSIONS.map(m => {
      let progress = 0;
      if (m.id === 'daily_bet') progress = Math.min(betRaw || 0, m.target);
      else if (m.id === 'daily_win') progress = Math.min(winRaw || 0, m.target);
      else if (m.id === 'daily_roulette') progress = Math.min(rouletteRaw || 0, m.target);
      else if (m.id === 'daily_streak') progress = Math.min(streakRaw || 0, m.target);
      return { ...m, progress, claimed: claimed.includes(m.id) };
    });

    return createApiEnvelope({ missions, date: today }, request.id);
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
