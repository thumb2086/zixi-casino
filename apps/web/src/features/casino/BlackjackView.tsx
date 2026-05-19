import React, { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { api } from "../../store/api";
import "./Blackjack.css";
import "./CasinoCommon.css";
import { extractGameError, unwrapGameEnvelope } from "./gameClient";
import { BetQuickActions } from "./BetQuickActions";

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
  const { session } = useAuth();
  const [betAmount, setBetAmount] = useState<string>("100");
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [error, setError] = useState<string>("");
  const [isAnimating, setIsAnimating] = useState(false);

  const handleAction = async (action: "start" | "hit" | "stand") => {
    if (!session) return;

    try {
      setError("");
      const res = await api.post("/api/v1/games/blackjack/play", {
        sessionId: session.id,
        betAmount: Number(betAmount),
        action,
        state: gameState.status === "idle" ? undefined : gameState,
      });

      const responseData = res.data;
      if (!res.status || responseData?.success === false) {
        throw new Error(extractGameError(responseData));
      }
      const payload = unwrapGameEnvelope<any>(responseData);

      if (action === "stand" && payload.dealerCards?.length > 0) {
        setIsAnimating(true);
        const allDealerCards = payload.dealerCards as Card[];
        const firstPassCards = allDealerCards.map((c: Card) => c.hidden ? { ...c, hidden: true } : c);
        setGameState(prev => ({
          ...prev,
          playerCards: payload.playerCards || prev.playerCards,
          dealerCards: firstPassCards,
          status: "in_progress",
        }));
        // Reveal hidden cards one by one
        for (let i = 0; i < allDealerCards.length; i++) {
          await new Promise(r => setTimeout(r, 600));
          setGameState(prev => ({
            ...prev,
            dealerCards: allDealerCards.slice(0, i + 1).concat(
              allDealerCards.slice(i + 1).map((c: Card) => c.hidden ? { ...c, hidden: true } : c)
            ),
            dealerTotal: i + 1 === allDealerCards.length ? (payload.dealerTotal || 0) : prev.dealerTotal,
          }));
        }
        await new Promise(r => setTimeout(r, 400));
        setGameState(prev => ({
          ...prev,
          dealerCards: allDealerCards,
          dealerTotal: payload.dealerTotal || 0,
          playerTotal: payload.playerTotal || prev.playerTotal,
          status: "settled",
          isWin: Boolean(payload.isWin || payload.result === "win"),
          isPush: Boolean(payload.isPush || payload.result === "draw"),
          multiplier: payload.multiplier || 0,
          reason: payload.reason,
        }));
        setIsAnimating(false);
        return;
      }

      setGameState({
        playerCards: payload.playerCards || [],
        dealerCards: payload.dealerCards || [],
        playerTotal: payload.playerTotal || 0,
        dealerTotal: payload.dealerTotal || 0,
        status: payload.status || (payload.result ? "settled" : "idle"),
        isWin: Boolean(payload.isWin || payload.result === "win"),
        isPush: Boolean(payload.isPush || payload.result === "draw"),
        multiplier: payload.multiplier || 0,
        reason: payload.reason,
      });
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
        <h3>莊家（{gameState.status === "in_progress" ? "?" : gameState.dealerTotal}）</h3>
        <div className="hand">{gameState.dealerCards.map(renderCard)}</div>
      </div>

      <div className="player-area">
        <h3>玩家（{gameState.playerTotal}）</h3>
        <div className="hand">{gameState.playerCards.map(renderCard)}</div>
      </div>

      <div className="controls">
        {gameState.status === "idle" || gameState.status === "settled" ? (
          <>
            <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={isAnimating} />
            <BetQuickActions amount={betAmount} onChange={setBetAmount} disabled={isAnimating} />
            <button className="start-btn" onClick={() => handleAction("start")} disabled={isAnimating}>發牌</button>
          </>
        ) : (
          <>
            <button className="hit-btn" onClick={() => handleAction("hit")} disabled={isAnimating}>要牌</button>
            <button className="stand-btn" onClick={() => handleAction("stand")} disabled={isAnimating}>停牌</button>
          </>
        )}
      </div>

      {error && <div className="result-overlay lose"><h2>{error}</h2></div>}

      {gameState.status === "settled" && !error && (
        <div className={`result-overlay ${gameState.isWin ? "win" : gameState.isPush ? "push" : "lose"}`}>
          <h2>{gameState.isWin ? "你贏了！" : gameState.isPush ? "和局" : gameState.reason || "本局失利"}</h2>
          {gameState.isWin && <p>派彩：{parseFloat(betAmount) * gameState.multiplier}</p>}
        </div>
      )}
    </div>
  );
};
