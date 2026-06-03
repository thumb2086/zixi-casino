import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api } from '../../store/api';
import { formatNumber } from '@repo/shared';
import { useAuth } from '../auth/useAuth';
import AppBottomNav from '../../components/AppBottomNav';

const SUIT_SYMBOLS: Record<string, string> = {
  'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠',
};

function CardView({ card, hidden }: { card?: any; hidden?: boolean }) {
  if (!card || hidden) {
    return <div className="flex h-16 w-12 items-center justify-center rounded-lg border-2 border-accent/40 bg-gradient-to-b from-accent/10 to-accent/5 text-accent font-black text-lg shadow-[0_0_10px_rgba(245,166,35,0.2)]">?</div>;
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div className="flex h-16 w-12 flex-col items-center justify-center rounded-lg border border-border bg-card text-sm font-black shadow-lg">
      <span className={isRed ? 'text-danger' : 'text-white'}>{SUIT_SYMBOLS[card.suit] || card.suit}</span>
      <span className={`text-xs ${isRed ? 'text-danger' : 'text-white'}`}>{card.rank}</span>
    </div>
  );
}

function PlayerSeat({ player, isMe, isTurn, communityCards, isDealer }: {
  player: any; isMe: boolean; isTurn: boolean; communityCards: any[]; isDealer: boolean;
}) {
  const bestHand = useMemo(() => {
    if (!player.hand || communityCards.length < 3) return null;
    try {
      const mgr = (window as any).__multiplayerManager;
      if (mgr?._evalBestHand) {
        return mgr._evalBestHand(player.hand, communityCards);
      }
    } catch {}
    return null;
  }, [player.hand, communityCards]);

  return (
    <div className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
      isTurn ? 'ring-2 ring-accent shadow-[0_0_20px_rgba(245,166,35,0.3)]' : ''
    } ${player.folded ? 'opacity-40' : ''}`}>
      {isDealer && <span className="text-[8px] font-bold text-accent uppercase tracking-widest">DEALER</span>}
      <div className="flex gap-1">
        {player.hand?.map((card: any, i: number) => (
          <CardView key={i} card={card} hidden={!isMe && !player.showCards} />
        ))}
      </div>
      <div className="text-center">
        <p className={`text-xs font-bold ${isMe ? 'text-accent' : 'text-white'} truncate max-w-20`}>
          {player.displayName} {isMe ? '(我)' : ''}
        </p>
        <p className="text-[9px] text-secondary">${player.stack}</p>
        {player.bet > 0 && <p className="text-[9px] text-accent font-black">${player.bet}</p>}
        {player.allIn && <p className="text-[9px] text-warning font-black">ALL IN</p>}
        {player.folded && <p className="text-[9px] text-muted">蓋牌</p>}
        {!player.folded && bestHand && (
          <p className="text-[8px] text-info font-bold">{bestHand.name}</p>
        )}
      </div>
    </div>
  );
}

export default function PokerRoomView() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const params = useParams();
  const roomId = (params as any).roomId || 'poker_vip';

  // Room state simulation for now
  const [gameState, setGameState] = useState<any>(null);
  const [betInput, setBetInput] = useState('40');

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => {
      const res = await api.get('/api/v1/games/rooms');
      return (res.data?.data?.rooms || []).find((r: any) => r.id === roomId);
    },
    refetchInterval: 5000,
  });

  const me = useMemo(() => ({
    userId: session?.id || 'local',
    displayName: '我',
    stack: 1000,
    isBot: false,
    hand: [
      { rank: 'A', suit: 'hearts' },
      { rank: 'K', suit: 'spades' },
    ],
    bet: 0, totalBet: 0, folded: false, allIn: false,
  }), [session]);

  const botPlayers = useMemo(() => [
    { userId: 'bot1', displayName: 'AI_王牌', stack: 800, isBot: true, hand: [{ rank: 'Q', suit: 'clubs' }, { rank: 'Q', suit: 'diamonds' }], bet: 0, totalBet: 0, folded: false, allIn: false },
    { userId: 'bot2', displayName: 'AI_鋼鐵', stack: 1200, isBot: true, hand: [{ rank: '10', suit: 'spades' }, { rank: 'J', suit: 'hearts' }], bet: 0, totalBet: 0, folded: false, allIn: false },
    { userId: 'bot3', displayName: 'AI_暗影', stack: 950, isBot: true, hand: [{ rank: '2', suit: 'clubs' }, { rank: '7', suit: 'diamonds' }], bet: 0, totalBet: 0, folded: false, allIn: false },
    { userId: 'bot4', displayName: 'AI_鳳凰', stack: 1100, isBot: true, hand: [{ rank: 'A', suit: 'diamonds' }, { rank: '3', suit: 'clubs' }], bet: 0, totalBet: 0, folded: false, allIn: false },
  ], []);

  const allPlayers = useMemo(() => [me, ...botPlayers], [me, botPlayers]);
  const [turnIdx, setTurnIdx] = useState(0);
  const [phase, setPhase] = useState<'preflop' | 'flop' | 'turn' | 'river' | 'showdown'>('preflop');
  const [pot, setPot] = useState(30);
  const [community, setCommunity] = useState<any[]>([]);
  const [dealerIdx, setDealerIdx] = useState(0);
  const [lastRaise, setLastRaise] = useState(20);
  const [winner, setWinner] = useState<string | null>(null);
  const [playerBets, setPlayerBets] = useState<number[]>(allPlayers.map(() => 0));

  const isMyTurn = turnIdx === 0;
  const currentPlayer = allPlayers[turnIdx];

  // Bot auto-play: when it's a bot's turn, auto-move after a delay
  const doActionRef = useRef(doAction);
  doActionRef.current = doAction;

  useEffect(() => {
    if (winner) return;
    const p = allPlayers[turnIdx];
    if (p?.isBot) {
      const timer = setTimeout(() => {
        const botAction = Math.random() > 0.3 ? 'call' : 'fold';
        doActionRef.current(botAction);
      }, 1200 + Math.random() * 800);
      return () => clearTimeout(timer);
    }
  }, [turnIdx, winner, allPlayers]);

  const doAction = useCallback((action: string, amount?: number) => {
    if (winner) return;
    const p = allPlayers[turnIdx];
    if (p.folded || p.allIn) return;

    if (action === 'fold') {
      const newPlayers = [...allPlayers];
      newPlayers[turnIdx] = { ...p, folded: true };
      const active = newPlayers.filter(x => !x.folded);
      if (active.length <= 1) {
        setWinner(active[0]?.userId || '');
        setPhase('showdown');
        return;
      }
    } else if (action === 'call') {
      const callAmt = lastRaise - (playerBets[turnIdx] || 0);
      const actual = Math.min(callAmt, p.stack);
      const newBets = [...playerBets];
      newBets[turnIdx] = (newBets[turnIdx] || 0) + actual;
      setPlayerBets(newBets);
      setPot(prev => prev + actual);
      allPlayers[turnIdx] = { ...p, stack: p.stack - actual, bet: (p.bet || 0) + actual, allIn: p.stack - actual <= 0 };
    } else if (action === 'raise' && amount) {
      const addAmt = amount - (playerBets[turnIdx] || 0);
      const actual = Math.min(addAmt, p.stack);
      const newBets = [...playerBets];
      newBets[turnIdx] = (newBets[turnIdx] || 0) + actual;
      setPlayerBets(newBets);
      setPot(prev => prev + actual);
      setLastRaise(amount);
      allPlayers[turnIdx] = { ...p, stack: p.stack - actual, bet: amount, allIn: p.stack - actual <= 0 };
    }
    // check, just advance
    advanceTurn();
  }, [turnIdx, allPlayers, playerBets, pot, lastRaise, winner]);

  const advanceTurn = useCallback(() => {
    let next = turnIdx;
    const active = allPlayers.filter(p => !p.folded && !p.allIn);
    if (active.length <= 1) {
      setWinner(active[0]?.userId || '');
      setPhase('showdown');
      return;
    }
    // Check if all bets equal
    const activeBets = active.map(p => (playerBets[allPlayers.indexOf(p)] || 0));
    if (activeBets.every(b => b === activeBets[0]) && activeBets[0] >= lastRaise) {
      advancePhase();
      return;
    }
    for (let i = 0; i < allPlayers.length; i++) {
      next = (next + 1) % allPlayers.length;
      const p = allPlayers[next];
      if (!p.folded && !p.allIn) {
        setTurnIdx(next);
        return;
      }
    }
    advancePhase();
  }, [turnIdx, allPlayers, playerBets, lastRaise]);

  const advancePhase = useCallback(() => {
    if (phase === 'preflop') {
      setPhase('flop');
      setCommunity([{ rank: 'J', suit: 'diamonds' }, { rank: '7', suit: 'clubs' }, { rank: '3', suit: 'spades' }]);
    } else if (phase === 'flop') {
      setPhase('turn');
      setCommunity(prev => [...prev, { rank: 'K', suit: 'hearts' }]);
    } else if (phase === 'turn') {
      setPhase('river');
      setCommunity(prev => [...prev, { rank: '5', suit: 'diamonds' }]);
    } else if (phase === 'river') {
      setWinner(allPlayers[0]?.userId || '');
      setPhase('showdown');
      return;
    }
    // Reset bets for new phase
    setPlayerBets(allPlayers.map(() => 0));
    setLastRaise(20);
    setTurnIdx((dealerIdx + 1) % allPlayers.length);
  }, [phase, dealerIdx, allPlayers]);

  return (
    <div className="min-h-screen pb-32 font-manrope-emoji" style={{ backgroundColor: '#050508' }}>
      <header className="fixed top-0 z-50 w-full border-b border-accent/20 bg-gradient-to-r from-[#0a0a0f] via-[#14141f] to-[#0a0a0f] backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="text-gradient-diamond text-sm font-black uppercase tracking-widest">👑 VIP</div>
            <span className="text-caption text-secondary">{roomId}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-secondary">底? ${pot}</span>
            <span className="text-xs text-secondary">{allPlayers.filter(p => !p.folded).length}/{allPlayers.length} </span>
          </div>
        </div>
      </header>

      <main className="pt-16 px-4">
        {/* Poker Table */}
        <div className="relative mx-auto max-w-3xl mt-8">
          {/* Table felt */}
          <div className="rounded-[3rem] border-4 border-[#2a1a0a] p-8 shadow-[0_0_60px_rgba(0,100,0,0.2)]" style={{ background: 'radial-gradient(ellipse at center, #1a4a1a 0%, #0d2d0d 50%, #081a08 100%)' }}>
            {/* Community cards */}
            <div className="flex justify-center gap-2 mb-8">
              {[0, 1, 2, 3, 4].map(i => (
                <CardView key={i} card={community[i]} />
              ))}
            </div>

            {/* Player seats */}
            <div className="flex flex-wrap justify-center gap-4">
              {allPlayers.map((p, i) => (
                <PlayerSeat
                  key={p.userId}
                  player={p}
                  isMe={i === 0}
                  isTurn={i === turnIdx && !winner}
                  communityCards={community}
                  isDealer={i === dealerIdx}
                />
              ))}
            </div>

            {winner && (
              <div className="mt-6 text-center">
                <span className="text-gradient-diamond text-sm font-black uppercase tracking-widest">
                  ?? {allPlayers.find(p => p.userId === winner)?.displayName || winner} 贏? ${pot}?
                </span>
              </div>
            )}
          </div>

          {/* Controls */}
          {isMyTurn && !winner && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => doAction('fold')}
                className="px-6 py-3 rounded-xl bg-danger/20 text-danger border border-danger/30 text-xs font-bold uppercase tracking-widest hover:bg-danger/30 transition-all">
                ×
              </button>
              <button onClick={() => doAction('check')}
                className="px-6 py-3 rounded-xl bg-accent/10 text-accent border border-accent/30 text-xs font-bold uppercase tracking-widest hover:bg-accent/20 transition-all">
                ×
              </button>
              <button onClick={() => doAction('call')}
                className="px-6 py-3 rounded-xl bg-accent text-black text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_20px_rgba(245,166,35,0.3)]">
                跟注 ${lastRaise}
              </button>
              <div className="flex items-center gap-2">
                <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
                  className="w-20 rounded-xl bg-surface border border-border px-3 py-2.5 text-xs font-bold text-white text-center" />
                <button onClick={() => doAction('raise', parseInt(betInput) || 40)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-warning text-black text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all">
                ?注 ${betInput}
                </button>
              </div>
            </div>
          )}

          {!isMyTurn && !winner && currentPlayer?.isBot && (
            <div className="mt-6 text-center text-xs text-secondary">
              ?? {currentPlayer?.displayName} ?考中...
            </div>
          )}
        </div>
      </main>

      <AppBottomNav current="casino" />
    </div>
  );
}


