import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { formatNumber } from '@repo/shared';
import AppBottomNav from '../../components/AppBottomNav';

const DICE_ICONS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function DiceIcon({ value }: { value: number }) {
  return <span className="text-2xl">{DICE_ICONS[value - 1] || '⚀'}</span>;
}

export default function BluffDiceRoomView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const params = useParams();
  const roomId = (params as any).roomId || 'bluffdice_vip';

  const [phase, setPhase] = useState<'betting' | 'rolling' | 'result'>('betting');
  const [myBet, setMyBet] = useState({ quantity: 1, value: 2 });
  const [bets, setBets] = useState<{ userId: string; displayName: string; quantity: number; value: number }[]>([]);
  const [dice, setDice] = useState<number[]>([1, 1, 1, 1, 1]);
  const [winner, setWinner] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [lastCall, setLastCall] = useState('');

  const botPlayers = useMemo(() => [
    { userId: 'bot_b1', displayName: 'AI_詐欺師', avatar: '🃏' },
    { userId: 'bot_b2', displayName: 'AI_機器人', avatar: '🤖' },
    { userId: 'bot_b3', displayName: 'AI_賭徒', avatar: '🎲' },
  ], []);

  const allPlayers = useMemo(() => [
    { userId: session?.id || 'me', displayName: '我', isMe: true },
    ...botPlayers,
  ], [session, botPlayers]);

  const rollDice = () => {
    const results = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
    setDice(results);
    return results;
  };

  const startRound = () => {
    setPhase('betting');
    setBets([]);
    setWinner(null);
    setCurrentTurn(0);
    setLastCall('');
    rollDice();
  };

  const placeBet = () => {
    const newBet = { userId: allPlayers[currentTurn].userId, displayName: allPlayers[currentTurn].displayName, quantity: myBet.quantity, value: myBet.value };
    setBets(prev => [...prev, newBet]);
    setLastCall(`${myBet.quantity} 個 ${myBet.value}`);
    const nextTurn = (currentTurn + 1) % allPlayers.length;
    setCurrentTurn(nextTurn);
  };

  const callBluff = () => {
    setPhase('rolling');
    const results = rollDice();
    if (bets.length === 0) {
      setWinner(allPlayers[0].userId);
      setPhase('result');
      return;
    }
    const lastBet = bets[bets.length - 1];
    const actualCount = results.filter(d => d === lastBet.value).length;
    const isBluff = actualCount < lastBet.quantity;
    if (isBluff) {
      setWinner(lastBet.userId);
    } else {
      const caller = allPlayers[currentTurn];
      setWinner(caller?.userId || allPlayers[0].userId);
    }
    setPhase('result');
  };

  return (
    <div className="min-h-screen pb-32 font-manrope-emoji" style={{ backgroundColor: '#080810' }}>
      <header className="fixed top-0 z-50 w-full border-b border-accent/20 bg-gradient-to-r from-[#0a0a0f] via-[#14141f] to-[#0a0a0f] backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="text-gradient-diamond text-sm font-black uppercase tracking-widest">? VIP </span>
            <span className="text-caption text-secondary">{roomId}</span>
          </div>
          <button onClick={startRound} className="text-xs font-bold bg-accent text-black px-4 py-2 rounded-xl hover:brightness-110 transition-all">
            {phase === 'result' ? '結局' : '遊戲'}
          </button>
        </div>
      </header>

      <main className="pt-20 px-4 ">
        {/* Dice display */}
        <section className="card-accent bg-card p-8 mb-6 border border-border/10 text-center">
          <div className="flex justify-center gap-3 mb-4">
            {dice.map((d, i) => (
              <div key={i} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-border/20 shadow-inner">
                <DiceIcon value={d} />
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary">總計{dice.reduce((a, b) => a + b, 0)}</p>
        </section>

        {/* Betting area */}
        {phase === 'betting' && (
          <section className="card-accent bg-card p-6 mb-6 border border-border/10">
            <p className="text-xs text-secondary mb-3">
              {allPlayers[currentTurn]?.isMe ? '輪到你叫骰' : `等待 ${allPlayers[currentTurn]?.displayName} 思考中...`}
            </p>

            {bets.length > 0 && (
              <div className="mb-4 space-y-1">
                {bets.map((b, i) => (
                  <div key={i} className="text-xs text-secondary">
                    <span className="font-bold text-accent">{b.displayName}</span> 叫 <span className="font-bold text-white">{b.quantity} 個 {b.value}</span>
                  </div>
                ))}
              </div>
            )}

            {allPlayers[currentTurn]?.isMe ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary">數量</span>
                  <input type="range" min={1} max={10} value={myBet.quantity}
                    onChange={e => setMyBet(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="flex-1 accent-accent" />
                  <span className="text-sm font-bold text-white w-6 text-right">{myBet.quantity}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary">點數</span>
                  <input type="range" min={1} max={6} value={myBet.value}
                    onChange={e => setMyBet(prev => ({ ...prev, value: Number(e.target.value) }))}
                    className="flex-1 accent-accent" />
                  <span className="text-sm font-bold text-white w-6 text-right">{myBet.value}</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={placeBet} className="flex-1 bg-accent text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all">
                    叫骰
                  </button>
                  <button onClick={callBluff} className="flex-1 bg-danger/20 text-danger border border-danger/30 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-danger/30 transition-all">
                    ×
                  </button>
                </div>
                <p className="text-xs text-center text-secondary mt-2">上次叫骰?{lastCall || '×}</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <span className="text-xs text-secondary animate-pulse">等待 {allPlayers[currentTurn]?.displayName} 叫骰...</span>
              </div>
            )}
          </section>
        )}

        {/* Result */}
        {phase === 'result' && (
          <section className="card-accent bg-card p-6 mb-6 border border-border/10 text-center">
            <p className="text-gradient-diamond text-lg font-black mb-2">
              ?? {allPlayers.find(p => p.userId === winner)?.displayName || winner} 贏×
            </p>
            <p className="text-xs text-secondary">
              骰?：{dice.join(', ')} ×後叫骰?{lastCall}
            </p>
          </section>
        )}

        {/* Players */}
        <section className="card-accent bg-card p-4 border border-border/10">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-3">玩家</p>
          <div className="space-y-2">
            {allPlayers.map((p, i) => (
              <div key={p.userId} className={`flex items-center justify-between p-2 rounded-xl ${i === currentTurn ? 'bg-accent/10 ring-1 ring-accent' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.isMe ? '?' : '遊戲'}</span>
                  <span className={`text-xs font-bold ${p.isMe ? 'text-accent' : 'text-white'}`}>{p.displayName}</span>
                </div>
                {i === currentTurn && <span className="text-[9px] text-accent font-black">輪到</span>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <AppBottomNav current="casino" />
    </div>
  );
}

