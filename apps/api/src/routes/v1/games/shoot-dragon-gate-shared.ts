import { requestTokenToSymbol, type RequestTokenKey } from "@repo/domain";
import { GameManager } from "@repo/domain/games/game-manager.js";
import { GameSessionManager } from "@repo/domain/games/game-session-manager.js";
import { requireDb } from "@repo/infrastructure/db/index.js";
import { gameSettlement } from "../../../utils/game-settlement.js";

export type DragonGateCard = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type DragonGateOpenCards = { left: DragonGateCard; right: DragonGateCard };

const gameManager = new GameManager();

export async function playShootDragonGateRound(params: {
  userId: string;
  address: string;
  betAmount: number;
  token: RequestTokenKey;
  requestId: string;
  openCards?: DragonGateOpenCards;
  seed?: string;
  bias?: number;
}) {
  const { userId, address, betAmount, token, requestId, openCards, seed, bias } = params;
  const amountStr = betAmount.toString();
  const roundId = seed || `dragon_${crypto.randomUUID().slice(0, 8)}`;

  const validation = await gameSettlement.validateAndDeductBalance(
    address, token, amountStr, `total_bet:${address}`
  );
  if (!validation.success) {
    return { ok: false as const, error: validation.error?.message || "Validation failed" };
  }

  try {
    let left: DragonGateCard, right: DragonGateCard;
    let winMultiplier = 2;
    if (openCards) {
      left = openCards.left;
      right = openCards.right;
    } else {
      const gateResult = gameManager.resolveDragonTiger('gate', {}, roundId, bias || 0);
      left = gateResult.gate.left.rank as DragonGateCard;
      right = gateResult.gate.right.rank as DragonGateCard;
      winMultiplier = Math.max(1, gateResult.multiplier);
    }
    const rankIndex = (r: string) => ["A","2","3","4","5","6","7","8","9","10","J","Q","K"].indexOf(r);
    const lv = rankIndex(left) + 1;
    const rv = rankIndex(right) + 1;
    const lo = Math.min(lv, rv);
    const hi = Math.max(lv, rv);
    const isGate = lo === hi;

    const shotResult = gameManager.resolveDragonTiger('shoot', { gate: { left: { rank: left }, right: { rank: right } } }, roundId, bias || 0);
    const mid = shotResult.shot.rank as DragonGateCard;
    const mv = rankIndex(mid) + 1;

    let result: "win" | "lose" | "draw";
    let payout: number;
    if (isGate) {
      result = "draw";
      payout = betAmount;
    } else if (mv > lo && mv < hi) {
      result = "win";
      payout = betAmount * winMultiplier;
    } else {
      result = "lose";
      payout = 0;
    }

    const settlement = await gameSettlement.executeSettlement({
      userId, address, game: "shoot_dragon_gate",
      token: requestTokenToSymbol(token),
      betAmount: amountStr, payoutAmount: payout.toString(), roundId, requestId,
    });

    if (!settlement.success) {
      await gameSettlement.rollbackBalance(address, token, validation.balanceBefore);
      return { ok: false as const, error: settlement.error?.message || "Settlement failed" };
    }

    const finalBalance = await gameSettlement.creditPayout(
      address, token, validation.balanceAfter, settlement.finalPayout,
      'shoot_dragon_gate', userId, betAmount
    );

    await gameSettlement.updateTotalBet(address, betAmount, undefined, userId);

    const db = await requireDb();
    const sessionManager = new GameSessionManager(db);
    await sessionManager.recordGame({
      userId, address, game: "shoot_dragon_gate", betAmount,
      gameResult: {
        result, payout: settlement.finalPayout,
        meta: { left, right, mid, lo, hi, betTxHash: settlement.betTxHash, payoutTxHash: settlement.payoutTxHash, fee: settlement.feeAmount },
      },
    });

    await gameSettlement.logGameEvent({
      game: "shoot_dragon_gate", userId, address, amount: amountStr,
      payout: settlement.finalPayout.toString(), fee: settlement.feeAmount.toString(),
      isWin: result === "win", multiplier: winMultiplier,
      betTxHash: settlement.betTxHash, payoutTxHash: settlement.payoutTxHash, roundId,
    });

    await gameSettlement.saveRound("shoot_dragon_gate", roundId, { left, right, mid, lo, hi, result });

    return {
      ok: true as const,
      data: {
        roundId, cards: { left, right, mid }, left, right, mid, lo, hi,
        result, payout: settlement.finalPayout, betAmount,
        fee: settlement.feeAmount, balance: finalBalance,
        betTxHash: settlement.betTxHash, payoutTxHash: settlement.payoutTxHash,
      },
    };
  } catch (err: any) {
    await gameSettlement.rollbackBalance(address, token, validation.balanceBefore);
    return { ok: false as const, error: err?.message || "Unexpected error" };
  }
}
