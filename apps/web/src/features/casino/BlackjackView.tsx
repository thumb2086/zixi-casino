import React, { useState, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "../auth/useAuth";
import { api } from "../../store/api";
import "./Blackjack.css";
import "./CasinoCommon.css";
import { extractGameError, unwrapGameEnvelope } from "./gameClient";
import { BetQuickActions } from "./BetQuickActions";

// Deterministic card draw (same FNV-1a as the server)
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function drawCard(seed: string, index: number) {
  const hash = fnv1a32(`${seed}:${index}`) >>> 0;
  return { rank: RANKS[hash % RANKS.length], suit: SUITS[Math.floor(hash / RANKS.length) % SUITS.length] };
}

function calcTotal(cards: { rank: string; hidden?: boolean }[]) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.hidden) continue;
    if (card.rank === 'A') { total += 11; aces++; }
    else if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
    else total += parseInt(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

interface Card {
  rank: string;
  suit: string;
  hidden?: boolean;
}

interface GameState {
  playerCards: Card[];
  dealerCards: Card[];
  playerTotal: number;
  dealerTotal: number;
  status: "idle" | "in_progress" | "settled";
  isWin: boolean;
  isPush?: boolean;
  multiplier: number;
  reason?: string;
}

const INITIAL_STATE: GameState = {
  playerCards: [],
  dealerCards: [],
  playerTotal: 0,
  dealerTotal: 0,
  status: "idle",
  isWin: false,
  isPush: false,
  multiplier: 0,
};

export const BlackjackView: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const seedRef = useRef<string>("");

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as { maxBet?: number } | undefined;
    },
    staleTime: 60000,
  });
  const maxBet = profile?.maxBet ?? 1_000_000;
  const [betAmount, setBetAmount] = useState<string>("100");
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [error, setError] = useState<string>("");
  const [isAnimating, setIsAnimating] = useState(false);
  const hitCountRef = useRef(0);

  const handleAction = async (action: "start" | "hit" | "stand") => {
    if (!session) return;

    try {
      setError("");

      if (action === "start") {
        // One API call to get initial deal + deterministic seed
        const res = await api.post("/api/v1/games/blackjack/play", {
          sessionId: session.id,
          betAmount: Number(betAmount),
          action: "start",
        });
        const responseData = res.data;
        if (!res.status || responseData?.success === false) {
          throw new Error(extractGameError(responseData));
        }
        const payload = unwrapGameEnvelope<any>(responseData);
        seedRef.current = payload.roundId || `bj_${crypto.randomUUID().slice(0, 8)}`;
        hitCountRef.current = 0;
        setGameState({
          playerCards: payload.playerCards || [],
          dealerCards: payload.dealerCards || [],
          playerTotal: payload.playerTotal || 0,
          dealerTotal: payload.dealerTotal || 0,
          status: payload.status || "in_progress",
          isWin: Boolean(payload.isWin),
          isPush: Boolean(payload.isPush),
          multiplier: payload.multiplier || 0,
          reason: payload.reason,
        });
        queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        return;
      }

      if (action === "hit") {
        // Compute locally — no API call needed (deterministic draw)
        if (gameState.status !== "in_progress") return;
        hitCountRef.current++;
        const newCard = drawCard(seedRef.current, gameState.playerCards.length + 2);
        const playerCards = [...gameState.playerCards, newCard];
        const playerTotal = calcTotal(playerCards);
        const isBust = playerTotal > 21;
        setGameState(prev => ({
          ...prev,
          playerCards,
          playerTotal,
          status: isBust ? "settled" : "in_progress",
          isWin: false,
          isPush: false,
          multiplier: 0,
          reason: isBust ? "Bust" : undefined,
        }));
        // If bust, auto-settle with API
        if (isBust) {
          setIsAnimating(true);
          const res = await api.post("/api/v1/games/blackjack/play", {
            sessionId: session.id,
            betAmount: Number(betAmount),
            action: "stand",
            state: { ...gameState, playerCards, playerTotal },
          });
          const payload = unwrapGameEnvelope<any>(res.data.data);
          if (payload.dealerCards) {
            setGameState(prev => ({
              ...prev,
              dealerCards: payload.dealerCards.map((c: Card) => ({ ...c, hidden: false })),
              dealerTotal: payload.dealerTotal || 0,
              status: "settled",
              isWin: false,
              reason: "Bust",
            }));
          }
          setIsAnimating(false);
          queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        }
        return;
      }

      if (action === "stand") {
        // Send accumulated state to API for settlement
        setIsAnimating(true);
        const res = await api.post("/api/v1/games/blackjack/play", {
          sessionId: session.id,
          betAmount: Number(betAmount),
          action: "stand",
          state: gameState,
        });
        const responseData = res.data;
        if (!res.status || responseData?.success === false) {
          throw new Error(extractGameError(responseData));
        }
        const payload = unwrapGameEnvelope<any>(responseData);

        const allDealerCards = (payload.dealerCards || []) as Card[];
        if (allDealerCards.length > 0) {
          // Reveal hidden cards one by one
          setGameState(prev => ({
            ...prev,
            dealerCards: allDealerCards.map((c: Card) => c.hidden ? { ...c, hidden: true } : c),
            status: "in_progress",
          }));
          for (let i = 0; i < allDealerCards.length; i++) {
            await new Promise(r => setTimeout(r, 200));
            setGameState(prev => ({
              ...prev,
              dealerCards: allDealerCards.slice(0, i + 1).concat(
                allDealerCards.slice(i + 1).map((c: Card) => c.hidden ? { ...c, hidden: true } : c)
              ),
              dealerTotal: i + 1 === allDealerCards.length ? (payload.dealerTotal || 0) : prev.dealerTotal,
            }));
          }
          await new Promise(r => setTimeout(r, 400));
        }

        setGameState(prev => ({
          ...prev,
          playerCards: payload.playerCards || prev.playerCards,
          dealerCards: allDealerCards.map((c: Card) => ({ ...c, hidden: false })),
          dealerTotal: payload.dealerTotal || 0,
          playerTotal: payload.playerTotal || prev.playerTotal,
          status: "settled",
          isWin: Boolean(payload.isWin || payload.result === "win"),
          isPush: Boolean(payload.isPush || payload.result === "draw"),
          multiplier: payload.multiplier || 0,
          reason: payload.reason,
        }));
        setIsAnimating(false);
        queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        return;
      }
    } catch (e: any) {
      setError(extractGameError(e?.response?.data || e));
    }
  };

  const renderCard = (card: Card, index: number) => (
    <div key={index} className={`card ${card.hidden ? "hidden-card" : ""}`}>
      {!card.hidden && (
        <>
          <span className="rank">{card.rank}</span>
          <span className="suit">{card.suit}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="blackjack-container">
      <div className="dealer-area">
        <h3>{t('casino_game.blackjack_dealer_with_total', { total: gameState.status === "in_progress" ? "?" : gameState.dealerTotal })}</h3>
        <div className="hand">{gameState.dealerCards.map(renderCard)}</div>
      </div>

      <div className="player-area">
        <h3>{t('casino_game.blackjack_player_with_total', { total: gameState.playerTotal })}</h3>
        <div className="hand">{gameState.playerCards.map(renderCard)}</div>
      </div>

      <div className="controls">
        {gameState.status === "idle" || gameState.status === "settled" ? (
          <>
            <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={isAnimating} />
            <BetQuickActions amount={betAmount} onChange={setBetAmount} disabled={isAnimating} maxBet={maxBet} />
            <button className="start-btn" onClick={() => handleAction("start")} disabled={isAnimating}>{t('casino_game.blackjack_deal')}</button>
          </>
        ) : (
          <>
            <button className="hit-btn" onClick={() => handleAction("hit")} disabled={isAnimating}>{t('casino_game.blackjack_hit')}</button>
            <button className="stand-btn" onClick={() => handleAction("stand")} disabled={isAnimating}>{t('casino_game.blackjack_stand')}</button>
          </>
        )}
      </div>

      {error && <div className="result-overlay lose"><h2>{error}</h2></div>}

      {gameState.status === "settled" && !error && (
        <div className={`result-overlay ${gameState.isWin ? "win" : gameState.isPush ? "push" : "lose"}`}>
          <h2>{gameState.isWin ? t('casino_game.blackjack_you_win') : gameState.isPush ? t('casino_game.blackjack_push_label') : gameState.reason || t('casino_game.blackjack_lose_label')}</h2>
          {gameState.isWin && <p>{t('casino_game.blackjack_payout', { amount: parseFloat(betAmount) * gameState.multiplier })}</p>}
        </div>
      )}
    </div>
  );
};
