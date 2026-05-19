import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { api } from "../../store/api";
import "./Crash.css";
import { extractGameError, unwrapGameEnvelope } from "./gameClient";

export const CrashView: React.FC = () => {
  const { session } = useAuth();
  const [betAmount, setBetAmount] = useState<string>("100");
  const [status, setStatus] = useState<"idle" | "running" | "crashed" | "cashed_out">("idle");
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [crashPoint, setCrashPoint] = useState<number>(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [targetCrashPoint, setTargetCrashPoint] = useState<number | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const settlingRef = useRef(false);
  const [rocketHeight, setRocketHeight] = useState(0);

  // Generate stars once
  const stars = useRef(Array.from({ length: 30 }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 2,
  })));

  const settleRound = async (cashout: boolean, elapsedSeconds: number, shownMultiplier: number) => {
    if (!session) return;
    if (settlingRef.current) return;
    settlingRef.current = true;

    try {
      setError("");
      const res = await api.post("/api/v1/games/crash/play", {
        sessionId: session.id,
        betAmount: Number(betAmount),
        elapsedSeconds,
        cashout,
        roundId: roundId || undefined,
      });

      const responseData = res.data;
      if (!res.status || responseData?.success === false) {
        throw new Error(extractGameError(responseData));
      }
      const payload = unwrapGameEnvelope<any>(responseData);
      setLastResult(payload);
      if (payload.roundId) setRoundId(payload.roundId);
      setCrashPoint(payload.crashPoint || shownMultiplier);
      setMultiplier(payload.crashPoint || shownMultiplier);
      setStatus(payload.crashed ? "crashed" : "cashed_out");
      setRoundId(null);
    } catch (e: any) {
      setError(extractGameError(e?.response?.data || e));
      setStatus("idle");
    } finally {
      settlingRef.current = false;
    }
  };

  const startRace = async () => {
    if (!session || status === "running") return;
    setError("");
    setLastResult(null);
    setCrashPoint(0);
    setRoundId(null);
    setStatus("running");
    setMultiplier(1.0);
    setRocketHeight(0);
    startTimeRef.current = Date.now();

    let nextCrash = 1.5;
    try {
      const startRes = await api.post("/api/v1/games/crash/play", {
        sessionId: session.id,
        betAmount: Number(betAmount),
        elapsedSeconds: 0,
        cashout: false,
      });
      const startResponseData = startRes.data;
      if (!startRes.status || startResponseData?.success === false) {
        throw new Error(extractGameError(startResponseData));
      }
      const startPayload = unwrapGameEnvelope<any>(startResponseData);
      nextCrash = Number(startPayload?.crashPoint || 1.5);
      setRoundId(startPayload?.roundId || null);
    } catch (e: any) {
      setError(extractGameError(e?.response?.data || e));
      setStatus("idle");
      return;
    }
    setTargetCrashPoint(nextCrash);

    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const current = Math.pow(Math.E, 0.08 * elapsed);
      setMultiplier(current);
      setRocketHeight(Math.min(100, ((current - 1) / 5) * 100)); // 1x=0%, 6x=100%

      if (current >= nextCrash) {
        if (timerRef.current) clearInterval(timerRef.current);
        setMultiplier(nextCrash);
        setRocketHeight(100);
        setStatus("crashed");
        void settleRound(false, elapsed, nextCrash);
      }
    }, 80);
  };

  const cashOut = async () => {
    if (status !== "running" || !session) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
    setStatus("cashed_out");
    void settleRound(true, elapsedSeconds, multiplier);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRoundId(null);
    };
  }, []);

  const isFlying = status === "running" || status === "cashed_out";

  return (
    <div className="crash-container">
      <div className="crash-display">
        <h1 className={status === "crashed" ? "crashed-text" : ""}>
          {status === "idle" ? "1.00" : multiplier.toFixed(2)}x
        </h1>
        {status === "crashed" && <div className="crash-msg">墜毀！</div>}
        {status === "cashed_out" && <div className="win-msg">已停利！</div>}
        {status === "running" && (
          <div className="text-xs text-emerald-400 absolute bottom-1.5">
            {((multiplier - 1) * Number(betAmount)).toFixed(2)} ZXC
          </div>
        )}
      </div>

      {/* Rocket stage */}
      <div className="rocket-stage">
        <div className="stars">
          {stars.current.map((s, i) => (
            <div key={i} className="star" style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }} />
          ))}
        </div>
        <div className="rocket-trail" style={{ height: `${isFlying ? rocketHeight : 5}%` }} />
        <div className={`rocket-body ${isFlying ? 'rising' : ''} ${status === 'crashed' ? 'crashed' : ''}`}
          style={{ bottom: `${10 + (isFlying ? rocketHeight * 1.5 : 0)}px` }}>
          {status === "crashed" ? "💥" : "🚀"}
        </div>
      </div>

      <div className="crash-controls">
        <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)}
          disabled={status === "running"} />
        {status === "running" ? (
          <button className="cashout-btn" onClick={cashOut}>🛸 停利</button>
        ) : (
          <button className="bet-btn" onClick={startRace}>🚀 發射</button>
        )}
      </div>

      {error && <div className="last-result">錯誤：{error}</div>}
      {lastResult && (
        <div className="last-result">
          上局：{lastResult.result === "win" ? "🏆 贏" : lastResult.result === "lose" ? "💥 輸" : "—"} ｜ 爆線點 {crashPoint.toFixed(2)}x
        </div>
      )}
      {status === "running" && targetCrashPoint && (
        <div className="last-result text-slate-500">倍率上升中… 隨時可停利</div>
      )}
    </div>
  );
};
