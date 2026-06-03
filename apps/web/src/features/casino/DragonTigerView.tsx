import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useAuth } from "../auth/useAuth";
import { api } from "../../store/api";
import "./DragonTiger.css";
import { extractGameError, unwrapGameEnvelope } from "./gameClient";

interface Card {
  rank: string;
  suit: string;
}

interface DragonResult {
  left: string;
  right: string;
  mid: string;
  lo: number;
  hi: number;
  result: "win" | "lose" | "draw";
  payout: number;
}

interface OpenGateData {
  gateId: string;
  left: string;
  right: string;
  lo: number;
  hi: number;
  multiplier: number;
}

const SUIT = "♦";

export const DragonTigerView: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [betAmount, setBetAmount] = useState<string>("100");
  const [openGate, setOpenGate] = useState<OpenGateData | null>(null);
  const [result, setResult] = useState<DragonResult | null>(null);
  const [error, setError] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const renderCard = (card?: Card) => (
    <div className="card">
      {card ? (
        <>
          <span className="rank">{card.rank}</span>
          <span className="suit">{card.suit}</span>
        </>
      ) : ("?")}
    </div>
  );

  const handleOpenGate = async () => {
    if (!session) return;
    try {
      setError("");
      setResult(null);
      setOpenGate(null);
      setIsOpening(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await api.post("/api/v1/games/shoot-dragon-gate/open", {
        sessionId: session.id
      }, { signal: controller.signal });
      clearTimeout(timeoutId);
      const payload = res.data;
      if (!res.status || payload?.success === false) {
        throw new Error(extractGameError(payload));
      }
      const opened = unwrapGameEnvelope<OpenGateData>(payload);
      setOpenGate(opened);
    } catch (e: any) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
        setError("請求超時，請檢查連線後重試");
      } else {
        setError(extractGameError(e?.response?.data || e));
      }
    } finally {
      setIsOpening(false);
    }
  };

  const handlePlay = async () => {
    if (!session || !openGate) return;
    try {
      setError("");
      setIsPlaying(true);
      const res = await api.post("/api/v1/games/shoot-dragon-gate/play", {
        sessionId: session.id,
        betAmount: Number(betAmount),
        gateId: openGate.gateId,
        token: "zhixi",
      });
      const payload = res.data;
      if (!res.status || payload?.success === false) {
        throw new Error(extractGameError(payload));
      }
      setResult(unwrapGameEnvelope<DragonResult>(payload));
      setOpenGate(null);
    } catch (e: any) {
      setError(extractGameError(e?.response?.data || e));
    } finally {
      setIsPlaying(false);
    }
  };

  const leftCard = openGate ? { rank: openGate.left, suit: SUIT } : result ? { rank: result.left, suit: SUIT } : undefined;
  const rightCard = openGate ? { rank: openGate.right, suit: SUIT } : result ? { rank: result.right, suit: SUIT } : undefined;
  const midCard = result ? { rank: result.mid, suit: SUIT } : undefined;

  return (
    <div className="dragon-tiger-container">
      <div className="gate-area">
        <div className="gate-side left">
          <h3>{t('casino_game.dragon_gate_left')}</h3>
          {leftCard ? renderCard(leftCard) : <div className="card-slot">?</div>}
        </div>
        <div className="gate-multiplier">
          {openGate ? (
            <>
              <span className="text-yellow-400 font-bold">{openGate.multiplier}x</span>
              <span className="text-xs text-gray-400 mt-1">{t('casino_game.dragon_range', { lo: openGate.lo, hi: openGate.hi })}</span>
            </>
          ) : result ? (
            <span className="text-yellow-400 font-bold">2x</span>
          ) : (
            <span>?</span>
          )}
        </div>
        <div className="gate-side right">
          <h3>{t('casino_game.dragon_gate_right')}</h3>
          {rightCard ? renderCard(rightCard) : <div className="card-slot">?</div>}
        </div>
      </div>

      <div className="shot-area">
        <h3>{t('casino_game.dragon_your_card')}</h3>
        {midCard ? renderCard(midCard) : <div className="card-slot highlight">?</div>}
      </div>

      <div className="controls">
        {!openGate && !result && (
          <button className="gate-btn" onClick={handleOpenGate} disabled={isOpening}>
            {isOpening ? t('casino_game.dragon_opening') : t('casino_game.dragon_open')}
          </button>
        )}

        {openGate && !result && (
          <>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={isPlaying}
              placeholder={t('casino_game.dragon_bet_amount')}
            />
            <button className="gate-btn" onClick={handlePlay} disabled={isPlaying}>
              {isPlaying ? t('casino_game.dragon_settling') : t('casino_game.dragon_shoot')}
            </button>
            <button className="text-sm text-gray-400 hover:text-white" onClick={() => setOpenGate(null)} disabled={isPlaying}>
              {t('casino_game.dragon_reopen')}
            </button>
          </>
        )}
      </div>

      {!openGate && !result && !error && (
        <div className="text-center text-sm text-gray-300">{t('casino_game.dragon_instruction')}</div>
      )}

      {error && <div className="result-banner lose"><h2>{error}</h2></div>}

      {result && !error && (
        <>
          <div className={`result-banner ${result.result === "win" ? "win" : result.result === "draw" ? "pillar" : "lose"}`}>
            <h2>{result.result === "win" ? t('casino_game.dragon_win') : result.result === "draw" ? t('casino_game.dragon_push') : t('casino_game.dragon_lose')}</h2>
          </div>
          <div className="text-center mt-4">
            <button className="gate-btn" onClick={() => { setResult(null); setOpenGate(null); }}>
              {t('casino_game.dragon_play_again')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
