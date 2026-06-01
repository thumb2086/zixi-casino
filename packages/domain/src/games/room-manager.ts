import { GameRound, GameAction } from "@repo/shared";
import { kv } from "@repo/infrastructure";

export interface RoomState {
    id: string;
    game: string;
    vipLevel: number;
    players: { userId: string; displayName: string; avatar: string; isBot: boolean }[];
    maxPlayers: number;
    currentRoundId?: string;
}

const DEFAULT_ROOMS: RoomState[] = [
    { id: "poker_01", game: "poker", vipLevel: 0, players: [], maxPlayers: 8 },
    { id: "poker_vip", game: "poker", vipLevel: 1, players: [], maxPlayers: 8 },
    { id: "dice_01", game: "dice", vipLevel: 0, players: [], maxPlayers: 6 },
    { id: "bluffdice_vip", game: "bluffdice", vipLevel: 1, players: [], maxPlayers: 6 },
];

export class RoomManager {
    async getRoom(id: string): Promise<RoomState | null> {
        const room = await kv.get(`room:${id}`) as RoomState | null;
        if (!room) {
            const defaultRoom = DEFAULT_ROOMS.find(r => r.id === id);
            return defaultRoom || null;
        }
        return room;
    }

    private async saveRoom(room: RoomState) {
        await kv.set(`room:${room.id}`, room);
    }

    async getRooms(game?: string): Promise<RoomState[]> {
        const rooms: RoomState[] = [];
        for (const dr of DEFAULT_ROOMS) {
            const room = await this.getRoom(dr.id);
            if (room && (!game || room.game === game)) {
                rooms.push(room);
            }
        }
        return rooms;
    }

    async joinRoom(roomId: string, user: { userId: string; displayName: string; avatar: string; vipLevel: number }) {
        const room = await this.getRoom(roomId);
        if (!room) throw new Error("Room not found");
        if (user.vipLevel < room.vipLevel) throw new Error("VIP level insufficient");

        if (room.players.length >= room.maxPlayers) {
            const botIdx = room.players.findIndex(p => p.isBot);
            if (botIdx !== -1) {
                room.players.splice(botIdx, 1);
            } else {
                throw new Error("Room is full");
            }
        }

        if (!room.players.find(p => p.userId === user.userId)) {
            room.players.push({ ...user, isBot: false });
            await this.saveRoom(room);
        }
        return room;
    }

    async leaveRoom(roomId: string, userId: string) {
        const room = await this.getRoom(roomId);
        if (room) {
            room.players = room.players.filter(p => p.userId !== userId);
            await this.saveRoom(room);
        }
    }

    async fillWithBots(roomId: string) {
        const room = await this.getRoom(roomId);
        if (!room) return;
        const targetCount = Math.floor(room.maxPlayers * 0.7);
        let changed = false;
        while (room.players.length < targetCount) {
            room.players.push({
                userId: `bot_${Math.random().toString(36).slice(2, 7)}`,
                displayName: `Player_${Math.floor(Math.random() * 9999)}`,
                avatar: "🤖",
                isBot: true
            });
            changed = true;
        }
        if (changed) await this.saveRoom(room);
    }
}

export type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerPlayer {
    userId: string;
    displayName: string;
    hand: any[];
    stack: number;
    bet: number;
    totalBet: number;
    folded: boolean;
    allIn: boolean;
    isBot: boolean;
}

export interface PokerState {
    status: PokerPhase;
    pot: number;
    currentTurnIdx: number;
    dealerIdx: number;
    communityCards: any[];
    players: PokerPlayer[];
    deck: any[];
    lastRaise: number;
    minBet: number;
    roundEnd: boolean;
    winnerId?: string;
    winRank?: string;
}

export class MultiplayerGameManager {
    private suites = ['♠', '♥', '♦', '♣'];
    private ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    private createDeck(seed: string): any[] {
        const deck: any[] = [];
        let h = this._fnv1a32(seed) >>> 0;
        for (const suit of this.suites) {
            for (const rank of this.ranks) {
                deck.push({ rank, suit });
            }
        }
        // Fisher-Yates shuffle using FNV hash
        for (let i = deck.length - 1; i > 0; i--) {
            h = (Math.imul(h, 0x5deece66d) + 0xb) >>> 0;
            const j = h % (i + 1);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    private _evalBestHand(hole: any[], community: any[]): { rank: number; name: string; kickers: number[]; bestFive: any[] } {
        const allCards = [...hole, ...community];
        if (allCards.length < 5) {
            const basic = this._evalHand(allCards.slice(0, 5));
            return { ...basic, bestFive: allCards.slice(0, 5) };
        }
        let best: any = null;
        // Try all C(n,5) combinations
        for (let a = 0; a < allCards.length; a++) {
            for (let b = a + 1; b < allCards.length; b++) {
                for (let c = b + 1; c < allCards.length; c++) {
                    for (let d = c + 1; d < allCards.length; d++) {
                        for (let e = d + 1; e < allCards.length; e++) {
                            const five = [allCards[a], allCards[b], allCards[c], allCards[d], allCards[e]];
                            const ev = this._evalHand(five);
                            if (!best || ev.rank > best.rank || (ev.rank === best.rank && this._compareKickers(ev.kickers, best.kickers) > 0)) {
                                best = { ...ev, bestFive: five };
                            }
                        }
                    }
                }
            }
        }
        return best || this._evalHand(allCards.slice(0, 5));
    }

    private _evalHand(cards: any[]): { rank: number; name: string; kickers: number[] } {
        const rankCounts: Record<string, number> = {};
        const suitCounts: Record<string, number> = {};
        cards.forEach(c => {
            rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
            suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
        });
        const counts = Object.values(rankCounts);
        const uniqueRanks = Object.keys(rankCounts).map(r => this.ranks.indexOf(r)).sort((a, b) => a - b);
        const isFlush = Object.values(suitCounts).some(c => c >= 5);
        let isStraight = false;
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
            if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) { isStraight = true; break; }
        }
        if (uniqueRanks.includes(12) && uniqueRanks.includes(0) && uniqueRanks.includes(1) && uniqueRanks.includes(2) && uniqueRanks.includes(3)) isStraight = true;
        const kickers = Object.entries(rankCounts).sort((a, b) => b[1] - a[1] || this.ranks.indexOf(b[0]) - this.ranks.indexOf(a[0])).map(e => this.ranks.indexOf(e[0]));

        if (isFlush && isStraight && cards.some(c => c.rank === 'A')) return { rank: 10, name: 'Royal Flush', kickers };
        if (isFlush && isStraight) return { rank: 9, name: 'Straight Flush', kickers };
        if (counts.includes(4)) return { rank: 8, name: 'Four of a Kind', kickers };
        if (counts.includes(3) && counts.includes(2)) return { rank: 7, name: 'Full House', kickers };
        if (isFlush) return { rank: 6, name: 'Flush', kickers };
        if (isStraight) return { rank: 5, name: 'Straight', kickers };
        if (counts.includes(3)) return { rank: 4, name: 'Three of a Kind', kickers };
        if (counts.filter(c => c === 2).length === 2) return { rank: 3, name: 'Two Pair', kickers };
        if (counts.includes(2)) return { rank: 2, name: 'One Pair', kickers };
        return { rank: 1, name: 'High Card', kickers };
    }

    private _compareKickers(a: number[], b: number[]): number {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] > b[i]) return 1;
            if (a[i] < b[i]) return -1;
        }
        return 0;
    }

    initPoker(players: { userId: string; displayName: string; stack: number; isBot: boolean }[]): PokerState {
        const dealerIdx = Math.floor(Math.random() * players.length);
        const deck = this.createDeck(Date.now().toString());
        let deckIdx = 0;
        const deal = () => deck[deckIdx++];

        // Deal 2 cards each
        const pokerPlayers = players.map(p => ({
            ...p,
            hand: [deal(), deal()],
            bet: 0,
            totalBet: 0,
            folded: false,
            allIn: false,
        }));

        // Blinds
        const sbIdx = (dealerIdx + 1) % players.length;
        const bbIdx = (dealerIdx + 2) % players.length;
        pokerPlayers[sbIdx].bet = 10;
        pokerPlayers[sbIdx].stack -= 10;
        pokerPlayers[bbIdx].bet = 20;
        pokerPlayers[bbIdx].stack -= 20;

        return {
            status: 'preflop',
            pot: 30,
            currentTurnIdx: (bbIdx + 1) % players.length,
            dealerIdx,
            communityCards: [],
            players: pokerPlayers,
            deck,
            lastRaise: 20,
            minBet: 20,
            roundEnd: false,
        };
    }

    advancePoker(state: PokerState, action?: { type: string; userId: string; amount?: number }): PokerState {
        if (action?.type === 'fold') {
            const p = state.players.find(x => x.userId === action.userId);
            if (p) p.folded = true;
            const active = state.players.filter(x => !x.folded);
            if (active.length <= 1) {
                state.status = 'showdown';
                state.winnerId = active[0]?.userId;
                state.winRank = 'Fold';
                state.roundEnd = true;
                return { ...state };
            }
            this._nextTurn(state);
            return { ...state };
        }

        if (action?.type === 'call') {
            const p = state.players[state.currentTurnIdx];
            const callAmt = state.lastRaise - p.bet;
            const actual = Math.min(callAmt, p.stack);
            p.bet += actual;
            p.stack -= actual;
            p.totalBet += actual;
            state.pot += actual;
            if (p.stack <= 0) p.allIn = true;
            this._nextTurn(state);
            return { ...state };
        }

        if (action?.type === 'raise' && action.amount) {
            const p = state.players[state.currentTurnIdx];
            const totalBet = action.amount;
            const addAmt = totalBet - p.bet;
            const actual = Math.min(addAmt, p.stack);
            p.bet += actual;
            p.stack -= actual;
            p.totalBet += actual;
            state.pot += actual;
            state.lastRaise = p.bet;
            if (p.stack <= 0) p.allIn = true;
            this._nextTurn(state);
            return { ...state };
        }

        if (action?.type === 'check') {
            this._nextTurn(state);
            return { ...state };
        }

        // Auto-advance dealing phase
        if (!action && state.status !== 'waiting') {
            this._advancePhase(state);
            return { ...state };
        }

        return state;
    }

    private _nextTurn(state: PokerState) {
        const active = state.players.filter(p => !p.folded && !p.allIn);
        if (active.length <= 1) {
            state.roundEnd = true;
            return;
        }
        // Check if all active players have equal bets
        const bets = active.map(p => p.bet);
        const allEqual = bets.every(b => b === bets[0]);
        if (allEqual && bets[0] >= state.lastRaise) {
            this._advancePhase(state);
            return;
        }
        // Find next active player
        let next = state.currentTurnIdx;
        for (let i = 0; i < state.players.length; i++) {
            next = (next + 1) % state.players.length;
            const p = state.players[next];
            if (!p.folded && !p.allIn && p.bet < state.lastRaise) {
                state.currentTurnIdx = next;
                return;
            }
        }
        // Everyone matched or all-in
        this._advancePhase(state);
    }

    private _advancePhase(state: PokerState) {
        // Reset bets for next phase
        for (const p of state.players) p.bet = 0;

        if (state.status === 'preflop') {
            state.status = 'flop';
            state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
        } else if (state.status === 'flop') {
            state.status = 'turn';
            state.deck.pop(); // burn
            state.communityCards.push(state.deck.pop());
        } else if (state.status === 'turn') {
            state.status = 'river';
            state.deck.pop(); // burn
            state.communityCards.push(state.deck.pop());
        } else if (state.status === 'river') {
            this._resolveShowdown(state);
            return;
        }

        // Who starts betting in new phase: first active after dealer
        const firstIdx = (state.dealerIdx + 1) % state.players.length;
        state.currentTurnIdx = firstIdx;
        state.lastRaise = state.minBet;
    }

    private _resolveShowdown(state: PokerState) {
        state.status = 'showdown';
        state.roundEnd = true;
        const active = state.players.filter(p => !p.folded);
        if (active.length === 1) {
            state.winnerId = active[0].userId;
            state.winRank = 'Fold';
            return;
        }
        // Evaluate best hand for each active player
        const hands = active.map(p => ({
            userId: p.userId,
            evaluation: this._evalBestHand(p.hand, state.communityCards),
        }));
        let best = hands[0];
        for (let i = 1; i < hands.length; i++) {
            if (hands[i].evaluation.rank > best.evaluation.rank) {
                best = hands[i];
            } else if (hands[i].evaluation.rank === best.evaluation.rank) {
                if (this._compareKickers(hands[i].evaluation.kickers, best.evaluation.kickers) > 0) {
                    best = hands[i];
                }
            }
        }
        state.winnerId = best.userId;
        state.winRank = best.evaluation.name;
    }

    // Bot AI: simple heuristic
    getBotAction(state: PokerState, userId: string): { type: string; amount?: number } {
        const p = state.players.find(x => x.userId === userId);
        if (!p) return { type: 'fold' };
        const hand = p.hand;
        // Simple hand strength: high card value
        const highCard = Math.max(...hand.map((c: any) => this.ranks.indexOf(c.rank)));
        const hasPair = hand[0].rank === hand[1].rank;
        const bothHigh = highCard >= 10; // J, Q, K, A

        if (hasPair && highCard >= 8) return { type: 'raise', amount: state.lastRaise * 2 };
        if (hasPair) return { type: 'call' };
        if (bothHigh) return { type: 'call' };
        if (highCard >= 8 && Math.random() > 0.5) return { type: 'call' };
        return { type: 'fold' };
    }

    resolvePokerHand(hands: { userId: string; cards: any[] }[]): { winnerId: string; rank: string } {
        if (hands.length === 0) return { winnerId: '', rank: '' };
        let best = hands[0];
        let bestEval = this._evalHand(best.cards);
        for (let i = 1; i < hands.length; i++) {
            const ev = this._evalHand(hands[i].cards);
            if (ev.rank > bestEval.rank) {
                best = hands[i];
                bestEval = ev;
            } else if (ev.rank === bestEval.rank) {
                for (let k = 0; k < Math.min(ev.kickers.length, bestEval.kickers.length); k++) {
                    if (ev.kickers[k] > bestEval.kickers[k]) { best = hands[i]; bestEval = ev; break; }
                    else if (ev.kickers[k] < bestEval.kickers[k]) break;
                }
            }
        }
        return { winnerId: best.userId, rank: bestEval.name };
    }

    resolveBluffDice(bets: { userId: string; quantity: number; value: number }[], actualDice: number[][]): { winnerId: string } {
        const allDice = actualDice.flat();
        for (let i = 0; i < bets.length; i++) {
            if (bets[i].quantity === 0) continue; // challenge marker
            const count = allDice.filter(d => d === bets[i].value).length;
            const nextBet = bets[i + 1];
            if (nextBet && nextBet.quantity === 0 && count < bets[i].quantity) {
                return { winnerId: nextBet.userId };
            }
        }
        const lastBet = bets.filter(b => b.quantity > 0);
        return { winnerId: lastBet.length > 0 ? lastBet[lastBet.length - 1].userId : bets[0]?.userId || '' };
    }

    private _fnv1a32(input: string): number {
        let hash = 0x811c9dc5;
        for (let i = 0; i < input.length; i++) {
          hash ^= input.charCodeAt(i);
          hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
    }
}
