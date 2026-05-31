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
    private async getRoom(id: string): Promise<RoomState | null> {
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

export interface PokerState {
    status: 'waiting' | 'dealing' | 'betting' | 'showdown';
    pot: number;
    currentTurn: string;
    communityCards: any[];
    players: { userId: string; hand: any[]; stack: number; lastBet: number; folded: boolean }[];
}

export class MultiplayerGameManager {
    private suites = ['♠', '♥', '♦', '♣'];
    private ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    private drawCard(seed: string): any {
        const hash = this._fnv1a32(seed) >>> 0;
        return {
            rank: this.ranks[hash % this.ranks.length],
            suit: this.suites[Math.floor(hash / this.ranks.length) % this.suites.length]
        };
    }

    private _evalHand(cards: any[]): { rank: number; name: string; kickers: number[] } {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const rankCounts: Record<string, number> = {};
        const suitCounts: Record<string, number> = {};
        cards.forEach(c => {
            rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
            suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
        });
        const counts = Object.values(rankCounts);
        const uniqueRanks = Object.keys(rankCounts).map(r => ranks.indexOf(r)).sort((a, b) => a - b);
        const isFlush = Object.values(suitCounts).some(c => c >= 5);
        let isStraight = false;
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
            if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) { isStraight = true; break; }
        }
        if (uniqueRanks.includes(12) && uniqueRanks.includes(0) && uniqueRanks.includes(1) && uniqueRanks.includes(2) && uniqueRanks.includes(3)) isStraight = true;
        const kickers = Object.entries(rankCounts).sort((a, b) => b[1] - a[1] || ranks.indexOf(b[0]) - ranks.indexOf(a[0])).map(e => ranks.indexOf(e[0]));

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

    advancePoker(state: PokerState, action?: { type: string; userId: string; amount?: number }): PokerState {
        if (state.status === 'waiting' && state.players.length >= 2) {
            return {
                ...state,
                status: 'dealing',
                communityCards: [this.drawCard('comm1'), this.drawCard('comm2'), this.drawCard('comm3')],
                players: state.players.map(p => ({ ...p, hand: [this.drawCard(p.userId + '1'), this.drawCard(p.userId + '2')] })),
                currentTurn: state.players[0].userId
            };
        }

        if (action?.type === 'fold') {
            const player = state.players.find(p => p.userId === action.userId);
            if (player) player.folded = true;
            // Advance turn logic
            const activePlayers = state.players.filter(p => !p.folded);
            if (activePlayers.length === 1) return { ...state, status: 'showdown' };
        }

        return state;
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
                    if (ev.kickers[k] > bestEval.kickers[k]) {
                        best = hands[i];
                        bestEval = ev;
                        break;
                    } else if (ev.kickers[k] < bestEval.kickers[k]) {
                        break;
                    }
                }
            }
        }
        return { winnerId: best.userId, rank: bestEval.name };
    }

    resolveBluffDice(bets: { userId: string; quantity: number; value: number }[], actualDice: number[][]): { winnerId: string } {
        // Count actual dice showing the claimed value
        const allDice = actualDice.flat();
        for (const bet of bets) {
            const count = allDice.filter(d => d === bet.value).length;
            // If a player called bluff (quantity=0 means challenge), check if claim is false
            if (bet.quantity === 0) continue;
            // If the actual count is less than the claim, the claim was a bluff
            // The challenger (next player who called bluff) wins
            const nextBet = bets[bets.indexOf(bet) + 1];
            if (nextBet && nextBet.quantity === 0 && count < bet.quantity) {
                return { winnerId: nextBet.userId };
            }
        }
        // If no bluff caught, last better wins
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
