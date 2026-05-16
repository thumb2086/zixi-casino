import crypto from 'node:crypto';

// ── State stores ──
const sessions = new Map();
const users = new Map();
const balances = new Map();
const txs = new Map();
const airdropClaims = new Map();
const bjGames = new Map();
const crashGames = new Map();
const dragonGates = new Map();

// ── Constants ──
const ZXC_PER_YJC = 100_000_000;
const START_BALANCE = '100000';
const SUITS = ['♠', '♥', '♦', '♣'];

const uid = () => crypto.randomUUID().slice(0, 8);
const makeSid = () => `sess_${crypto.randomUUID().slice(0, 12)}`;
const addr = () => `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`;
const env = (d, ok = true) => ({ success: ok, data: d, requestId: uid(), timestamp: Date.now() });
const err = (m) => ({ success: false, error: m, requestId: uid(), timestamp: Date.now() });

function initBal(address) {
  if (!balances.has(address)) balances.set(address, { zhixi: START_BALANCE, yjc: '0' });
}
function getBal(address) { return balances.get(address) || { zhixi: '0', yjc: '0' }; }
function deductBal(address, token, amount) {
  const b = getBal(address);
  const k = token === 'zhixi' || token === 'ZXC' ? 'zhixi' : 'yjc';
  const cur = BigInt(b[k]);
  if (cur < BigInt(amount)) return false;
  b[k] = (cur - BigInt(amount)).toString();
  balances.set(address, b);
  return true;
}
function creditBal(address, token, amount) {
  const b = getBal(address);
  const k = token === 'zhixi' || token === 'ZXC' ? 'zhixi' : 'yjc';
  b[k] = (BigInt(b[k]) + BigInt(amount)).toString();
  balances.set(address, b);
}
function addTx(address, type, token, amount, meta = {}) {
  if (!txs.has(address)) txs.set(address, []);
  txs.get(address).unshift({ id: uid(), type, token, amount: String(amount), ...meta, createdAt: new Date().toISOString() });
  if (txs.get(address).length > 50) txs.get(address).pop();
}
function getSession(sid) {
  if (!sid) return null;
  const s = sessions.get(sid);
  return s?.status === 'authorized' ? s : null;
}
function win(address, token, amount) {
  creditBal(address, token, String(amount));
  addTx(address, 'win', token === 'yjc' ? 'YJC' : 'ZXC', String(amount), { status: 'confirmed' });
}
function bet(address, token, amount) {
  addTx(address, 'bet', token === 'yjc' ? 'YJC' : 'ZXC', String(amount), { status: 'confirmed' });
}

const readBody = (req) => new Promise((res) => {
  let b = '';
  req.on('data', c => b += c);
  req.on('end', () => { try { res(JSON.parse(b)); } catch { res({}); } });
});

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-session-id',
  });
  res.end(body);
}

// ── Game helpers ──
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RV = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
const rand = (max) => Math.floor(Math.random() * max);
const pick = (arr) => arr[rand(arr.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const draw = () => pick(RANKS);

function slots() {
  const r = [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];
  let mult = 0;
  if (r[0] === '7️⃣' && r[1] === '7️⃣' && r[2] === '7️⃣') mult = 50;
  else if (r[0] === r[1] && r[1] === r[2]) mult = 10;
  else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) mult = 2;
  return { symbols: r, multiplier: mult };
}

function pokerHand(cards) {
  const rVals = cards.map(c => RV[c.rank]).sort((a, b) => a - b);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = rVals.every((v, i) => i === 0 || v === rVals[i - 1] + 1) || (rVals[0] === 1 && rVals[1] === 10 && rVals[2] === 11 && rVals[3] === 12 && rVals[4] === 13);
  const counts = Object.values(cards.reduce((a, c) => { a[c.rank] = (a[c.rank] || 0) + 1; return a; }, {}));
  const groups = counts.sort((a, b) => b - a);
  if (isFlush && isStraight && rVals[0] === 1 && rVals[4] === 13) return { hand: '皇家同花順', mult: 100 };
  if (isFlush && isStraight) return { hand: '同花順', mult: 50 };
  if (groups[0] === 4) return { hand: '四條', mult: 20 };
  if (groups[0] === 3 && groups[1] === 2) return { hand: '葫蘆', mult: 10 };
  if (isFlush) return { hand: '同花', mult: 6 };
  if (isStraight) return { hand: '順子', mult: 4 };
  if (groups[0] === 3) return { hand: '三條', mult: 3 };
  if (groups[0] === 2 && groups[1] === 2) return { hand: '兩對', mult: 2 };
  if (groups[0] === 2) return { hand: '一對', mult: 1 };
  return { hand: '高牌', mult: 0 };
}

function bluffDice() {
  const d = Array.from({ length: 5 }, () => rand(6) + 1);
  const total = d.reduce((a, b) => a + b, 0);
  const diff = Math.abs(total - 18);
  let mult = 0;
  if (diff === 0) mult = 5;
  else if (diff <= 2) mult = 2;
  else if (diff <= 4) mult = 1;
  return { dice: d, total, multiplier: mult };
}

// ── Main handler ──
export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  if (req.method === 'OPTIONS') { json(res, 204, ''); return; }
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const sid = body.sessionId || url.searchParams.get('sessionId');
    const session = getSession(sid);

    // ──────── AUTH ────────
    if (path.startsWith('/api/v1/auth/')) {
      const act = path.replace('/api/v1/auth', '') || '/';
      if (act === '/create-session' && req.method === 'POST') {
        const s = makeSid();
        sessions.set(s, { status: 'pending', createdAt: Date.now() });
        json(res, 200, env({ sessionId: s, deepLink: `dlinker:login:${s}`, legacyDeepLink: `dlinker:login:${s}` }));
        return;
      }
      if (act === '/status' && req.method === 'GET') {
        const s = sessions.get(url.searchParams.get('sessionId'));
        json(res, 200, env({ status: s?.status || 'expired', address: s?.address || null, publicKey: s?.publicKey || null }));
        return;
      }
      if ((act === '/custody/login' || act === '/custody/register') && req.method === 'POST') {
        const { username, password } = body;
        if (!username || !password) { json(res, 400, err('USERNAME_PASSWORD_REQUIRED')); return; }
        if (act === '/custody/register') {
          if (users.has(username)) { json(res, 400, err('USERNAME_TAKEN')); return; }
          const address = addr();
          users.set(username, { username, password, id: crypto.randomUUID(), address });
          initBal(address);
          creditBal(address, 'zhixi', '100000');
        }
        const user = users.get(username);
        if (!user || user.password !== password) { json(res, 400, err('INVALID_CREDENTIALS')); return; }
        const s = makeSid();
        sessions.set(s, { status: 'authorized', address: user.address, publicKey: '0x', userId: user.id });
        const b = getBal(user.address);
        json(res, 200, env({ success: true, sessionId: s, address: user.address, publicKey: '0x', user, balance: b.zhixi, registerBonus: act === '/custody/register' ? { granted: true, mode: 'demo', balance: b.zhixi } : undefined }));
        return;
      }
      if (act === '/me' && req.method === 'GET') {
        const s = sessions.get(url.searchParams.get('sessionId'));
        if (!s || s.status !== 'authorized') { json(res, 200, env({ user: null })); return; }
        const b = getBal(s.address);
        json(res, 200, env({ user: { id: s.userId, address: s.address }, address: s.address, mode: 'demo', username: 'demo_user', balance: b.zhixi, totalBet: '0' }));
        return;
      }
      json(res, 404, err('AUTH_ROUTE_NOT_FOUND'));
      return;
    }

    // ──────── WALLET ────────
    if (path.startsWith('/api/v1/wallet/')) {
      if (!session) { json(res, 401, err('UNAUTHORIZED')); return; }
      const address = session.address;
      initBal(address);
      const b = getBal(address);
      const act = path.replace('/api/v1/wallet', '') || '/';

      if (act === '/summary' && req.method === 'GET') {
        const canClaim = !airdropClaims.has(address) || (Date.now() - airdropClaims.get(address)) > 86400000;
        json(res, 200, env({
          balances: { zhixi: { balance: b.zhixi }, yjc: { balance: b.yjc } },
          summary: { balances: { ZXC: b.zhixi, YJC: b.yjc }, recentTransactions: (txs.get(address) || []).slice(0, 20) },
          assets: { market: { overlayNetWorth: '0', netWorth: b.zhixi } },
          onchain: { zxc: { balance: b.zhixi, available: true }, yjc: { balance: b.yjc, available: true }, adminAddress: '0xadmin' },
          canClaimAirdrop: canClaim,
          nextAirdropAt: airdropClaims.has(address) ? new Date(airdropClaims.get(address) + 86400000).toISOString() : new Date().toISOString(),
        }));
        return;
      }
      if (act === '/airdrop' && req.method === 'POST') {
        const last = airdropClaims.get(address) || 0;
        if (Date.now() - last < 86400000) { json(res, 429, err('Airdrop cooldown 24h')); return; }
        creditBal(address, 'zhixi', '1000000');
        airdropClaims.set(address, Date.now());
        addTx(address, 'airdrop', 'ZXC', '1000000', { status: 'confirmed' });
        json(res, 200, env({ success: true, reward: '1000000', balance: getBal(address).zhixi }));
        return;
      }
      if (act === '/transfer' && req.method === 'POST') {
        const { to, amount, token } = body;
        const t = token === 'YJC' ? 'yjc' : 'zhixi';
        if (!deductBal(address, t, String(amount))) { json(res, 400, err('INSUFFICIENT_BALANCE')); return; }
        creditBal(to, t, String(amount));
        addTx(address, 'transfer_out', token, String(amount), { counterparty: to, status: 'confirmed' });
        json(res, 200, env({ success: true, balance: getBal(address).zhixi }));
        return;
      }
      if (act === '/convert' && req.method === 'POST') {
        const zxcAmt = body.zxcAmount || body.amount || '0';
        if (!deductBal(address, 'zhixi', zxcAmt)) { json(res, 400, err('INSUFFICIENT_BALANCE')); return; }
        const yjcAmt = Math.floor(Number(zxcAmt) / ZXC_PER_YJC).toString();
        creditBal(address, 'yjc', yjcAmt);
        addTx(address, 'convert', 'ZXC', zxcAmt, { status: 'confirmed' });
        json(res, 200, env({ success: true, requiredZxc: zxcAmt, yjcAmount: yjcAmt, balance: getBal(address).zhixi }));
        return;
      }
      if (act === '/convert/yjc-to-zxc' && req.method === 'POST') {
        const yjcAmt = body.yjcAmount || '0';
        if (!deductBal(address, 'yjc', yjcAmt)) { json(res, 400, err('INSUFFICIENT_YJC')); return; }
        const zxcAmt = (BigInt(yjcAmt) * BigInt(ZXC_PER_YJC)).toString();
        creditBal(address, 'zhixi', zxcAmt);
        json(res, 200, env({ success: true, yjcAmount: yjcAmt, zxcAmount: zxcAmt, balance: getBal(address) }));
        return;
      }
      json(res, 404, err('WALLET_ROUTE_NOT_FOUND'));
      return;
    }

    // ──────── ME / PROFILE ────────
    if (path.startsWith('/api/v1/me/') && req.method === 'GET') {
      if (!session) { json(res, 401, err('UNAUTHORIZED')); return; }
      const act = path.replace('/api/v1/me', '') || '/';
      if (act === '/profile') {
        json(res, 200, env({ displayName: 'Player', address: session.address, vipLevel: 0, maxBet: 1000, avatar: { id: 'default', name: 'Default' }, title: { id: 'newbie', name: 'Newbie' }, balance: getBal(session.address).zhixi }));
        return;
      }
      if (act === '/inventory') { json(res, 200, env({ items: [], avatars: [], titles: [], equipment: {} })); return; }
      json(res, 404, err('ME_ROUTE_NOT_FOUND'));
      return;
    }

    // ──────── VIP ────────
    if (path === '/api/v1/vip/me' && req.method === 'GET') {
      if (!session) { json(res, 401, err('UNAUTHORIZED')); return; }
      json(res, 200, env({ level: { tier: 1, label: '普通会员', maxBet: 1000, dailyBonusMultiplier: 1, marketFeeDiscount: 0 }, vip: { tier: 0, label: 'Unmet', perks: [] }, yjcBalance: '0', totalBet: '0', nextLevel: { tier: 2, label: '青铜会员', threshold: 10000 } }));
      return;
    }
    if (path === '/api/v1/vip/levels' && req.method === 'GET') {
      json(res, 200, env([
        { threshold: 0, label: '普通會員', maxBet: 1000, dailyBonusMultiplier: 1.0, marketFeeDiscount: 0.0 },
        { threshold: 10000, label: '青銅會員', maxBet: 5000, dailyBonusMultiplier: 1.1, marketFeeDiscount: 0.05 },
        { threshold: 100000, label: '白銀會員', maxBet: 20000, dailyBonusMultiplier: 1.25, marketFeeDiscount: 0.10 },
        { threshold: 1000000, label: '黃金會員', maxBet: 100000, dailyBonusMultiplier: 1.5, marketFeeDiscount: 0.20 },
        { threshold: 10000000, label: '白金會員', maxBet: 500000, dailyBonusMultiplier: 2.0, marketFeeDiscount: 0.35 },
        { threshold: 50000000, label: '鑽石等級', maxBet: 2000000, dailyBonusMultiplier: 3.0, marketFeeDiscount: 0.50 },
        { threshold: 100000000, label: '黑鑽等級', maxBet: 10000000, dailyBonusMultiplier: 3.5, marketFeeDiscount: 0.55 },
        { threshold: 1000000000, label: '王者等級', maxBet: 100000000, dailyBonusMultiplier: 5.0, marketFeeDiscount: 0.70 },
        { threshold: 10000000000, label: '寰宇等級', maxBet: 500000000, dailyBonusMultiplier: 6.5, marketFeeDiscount: 0.85 },
        { threshold: 100000000000, label: '創世等級', maxBet: 900000000, dailyBonusMultiplier: 8.0, marketFeeDiscount: 1.0 },
      ]));
      return;
    }

    // ──────── CHESTS / REWARDS ────────
    if ((path === '/api/v1/chests' || path === '/api/v1/chests/') && req.method === 'GET') {
      json(res, 200, env([{ id: 'common', name: '普通寶箱', nameEn: 'Common Chest', price: 100, pityThreshold: 10, dropCount: { min: 2, max: 4 }, rarities: [{ rarity: 'common', name: '普通', color: '#b0b0b0', chance: 70 }, { rarity: 'rare', name: '稀有', color: '#4fc3f7', chance: 25 }, { rarity: 'epic', name: '史詩', color: '#ba68c8', chance: 4.5 }, { rarity: 'legendary', name: '傳說', color: '#ffd54f', chance: 0.5 }] }, { id: 'rare', name: '稀有寶箱', nameEn: 'Rare Chest', price: 500, pityThreshold: 10, dropCount: { min: 3, max: 5 }, rarities: [{ rarity: 'common', name: '普通', color: '#b0b0b0', chance: 40 }, { rarity: 'rare', name: '稀有', color: '#4fc3f7', chance: 45 }, { rarity: 'epic', name: '史詩', color: '#ba68c8', chance: 13 }, { rarity: 'legendary', name: '傳說', color: '#ffd54f', chance: 1.9 }, { rarity: 'mythic', name: '神話', color: '#ff6f00', chance: 0.1 }] }]));
      return;
    }
    if (path === '/api/v1/chests/items' && req.method === 'GET') {
      json(res, 200, env([{ id: 'token_small', name: 'ZXC 代幣', label: '10-25 ZXC', description: '少量 ZXC', icon: 'coin', rarity: 'common', type: 'token' }, { id: 'xp_boost', name: '經驗加成', label: 'XP Boost (1h)', description: '1h 雙倍經驗', icon: 'boost', rarity: 'common', type: 'buff_xp' }, { id: 'token_medium', name: 'ZXC 代幣', label: '50-100 ZXC', description: '中量 ZXC', icon: 'coin', rarity: 'rare', type: 'token' }, { id: 'shield_3', name: '護盾', label: 'Loss Shield (3 uses)', description: '3次輸局保本', icon: 'shield', rarity: 'rare', type: 'buff_shield' }, { id: 'token_large', name: 'ZXC 代幣', label: '250-500 ZXC', description: '大量 ZXC', icon: 'coin', rarity: 'epic', type: 'token' }, { id: 'vip_trial', name: 'VIP 試用', label: 'VIP Trial (24h)', description: '24h VIP', icon: 'crown', rarity: 'epic', type: 'buff_vip' }, { id: 'token_legendary', name: 'ZXC 代幣', label: '1000 ZXC', description: '傳說代幣', icon: 'coin', rarity: 'legendary', type: 'token' }, { id: 'permanent_luck', name: '永久運氣', label: 'Permanent Luck', description: '+2% 勝率', icon: 'boost', rarity: 'legendary', type: 'buff_luck' }]));
      return;
    }
    if (path === '/api/v1/rewards/catalog' && req.method === 'GET') {
      json(res, 200, env({ avatars: [
        { id: 'classic', name: '經典籌碼', label: 'Classic Chip', description: '經典頭像', icon: 'chip', rarity: 'common', source: 'shop' },
        { id: 'diamond', name: '鑽石', label: 'Diamond', description: '鑽石头像', icon: 'diamond', rarity: 'epic', source: 'chest' },
        { id: 'gold', name: '黃金', label: 'Gold', description: '黃金頭像', icon: 'gold', rarity: 'epic', source: 'chest' },
        { id: 'legend', name: '傳奇', label: 'Legend', description: '傳奇頭像', icon: 'legend', rarity: 'legendary', source: 'chest' },
      ], titles: [
        { id: 'newbie', name: '新手', label: 'Newbie', description: '新手稱號', icon: 'newbie', rarity: 'common', source: 'shop' },
        { id: 'gambler', name: '賭徒', label: 'Gambler', description: '賭徒稱號', icon: 'gambler', rarity: 'rare', source: 'chest' },
        { id: 'highroller', name: '豪賭', label: 'High Roller', description: '高賭注玩家', icon: 'highroller', rarity: 'epic', source: 'chest' },
      ]}));
      return;
    }

    // ──────── MARKET ────────
    if (path.startsWith('/api/v1/market/')) {
      const act = path.replace('/api/v1/market', '') || '/';
      if (act === '/snapshot' && req.method === 'GET') {
        json(res, 200, env({ snapshot: { marketIndex: 50000, marketTrendPct: 1.23, fearGreedIndex: 55, symbols: { 'BTC/USD': { symbol: 'BTC/USD', name: 'Bitcoin', price: 51234.56, type: 'crypto', sector: 'Crypto', changePct: 2.34 }, 'ETH/USD': { symbol: 'ETH/USD', name: 'Ethereum', price: 3123.45, type: 'crypto', sector: 'Crypto', changePct: 1.56 }, 'SOL/USD': { symbol: 'SOL/USD', name: 'Solana', price: 105.67, type: 'crypto', sector: 'Crypto', changePct: -0.78 }, 'YJC/USD': { symbol: 'YJC/USD', name: 'YJC Token', price: 0.1023, type: 'token', sector: 'DeFi', changePct: 5.67 } }, history: { 'BTC/USD': [50000, 50100, 50250, 50500, 51000, 51234] } }));
        return;
      }
      if (!session) { json(res, 401, err('UNAUTHORIZED')); return; }
      if (act === '/me' && req.method === 'GET') {
        json(res, 200, env({ account: { netWorth: 50000, cash: 25000, bankBalance: 25000, stockPositions: [], history: [] } }));
        return;
      }
      if (act === '/action' && req.method === 'POST') { json(res, 200, env({ success: true })); return; }
      json(res, 404, err('MARKET_ROUTE_NOT_FOUND'));
      return;
    }

    // ──────── GAMES ────────
    if (path.startsWith('/api/v1/games/') && req.method === 'POST') {
      if (!session) { json(res, 401, err('UNAUTHORIZED')); return; }
      const address = session.address;
      initBal(address);
      const betAmt = Number(body.betAmount) || 0;
      if (betAmt <= 0) { json(res, 400, err('INVALID_BET')); return; }
      const token = body.token || 'zhixi';

      // Check balance
      const balKey = token === 'yjc' ? 'yjc' : 'zhixi';
      if (BigInt(getBal(address)[balKey]) < BigInt(betAmt)) { json(res, 400, err('INSUFFICIENT_BALANCE')); return; }

      // ── Coinflip ──
      if (path === '/api/v1/games/coinflip/play') {
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const w = result === (body.selection || 'heads');
        const payout = w ? Math.floor(betAmt * 1.96) : 0;
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ roundId: uid(), result: w ? 'win' : 'lose', payout, balance: getBal(address).zhixi }));
        return;
      }

      // ── Roulette ──
      if (path === '/api/v1/games/roulette/play') {
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        json(res, 200, env({ winningNumber: rand(37) }));
        return;
      }

      // ── Horse Racing ──
      if (path === '/api/v1/games/horse/play') {
        const horseId = body.horseId || 1;
        const HORSES = [
          { id: 1, name: '赤焰', mult: 3.6 }, { id: 2, name: '雷霆', mult: 4.4 },
          { id: 3, name: '幻影', mult: 5.8 }, { id: 4, name: '夜刃', mult: 8.0 },
          { id: 5, name: '霜牙', mult: 11.6 }, { id: 6, name: '流星', mult: 17.0 },
        ];
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const tw = HORSES.reduce((s, h) => s + 1 / h.mult, 0);
        let r = Math.random() * tw;
        const winner = HORSES.find(h => { r -= 1 / h.mult; return r <= 0; }) || HORSES[0];
        const w = winner.id === horseId;
        const payout = w ? Math.floor(betAmt * winner.mult) : 0;
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ selectedHorse: horseId, winnerId: winner.id, winnerName: winner.name, result: w ? 'win' : 'lose', payout, multiplier: winner.mult, balance: getBal(address).zhixi }));
        return;
      }

      // ── Slots ──
      if (path === '/api/v1/games/slots/play') {
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const r = slots();
        const payout = Math.floor(betAmt * r.multiplier);
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ result: { symbols: r.symbols, multiplier: r.multiplier }, payout, balance: getBal(address).zhixi }));
        return;
      }

      // ── Sicbo ──
      if (path === '/api/v1/games/sicbo/play') {
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const dice = [rand(6) + 1, rand(6) + 1, rand(6) + 1];
        const total = dice.reduce((a, b) => a + b, 0);
        const isBig = total >= 11 && total <= 17;
        const bt = (body.bets || [{ type: 'big' }])[0]?.type;
        const w = (bt === 'big' && isBig) || (bt === 'small' && total >= 4 && total <= 10);
        const payout = w ? Math.floor(betAmt * 2) : 0;
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ dice, total, isBig, result: w ? 'win' : 'lose', payout, balance: getBal(address).zhixi }));
        return;
      }

      // ── Bingo ──
      if (path === '/api/v1/games/bingo/play') {
        const nums = body.numbers || [];
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const drawn = shuffle(Array.from({ length: 75 }, (_, i) => i + 1)).slice(0, 30);
        const matches = nums.filter(n => drawn.includes(n));
        const payoutMap = { 5: 1, 6: 2, 7: 5, 8: 10, 9: 20, 10: 100 };
        const mult = payoutMap[matches.length] || 0;
        const payout = Math.floor(betAmt * mult);
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ payout, result: payout > 0 ? 'win' : 'lose', matches, drawn, matchCount: matches.length, balance: getBal(address).zhixi }));
        return;
      }

      // ── Duel ──
      if (path === '/api/v1/games/duel/play') {
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const w = Math.random() < 0.5;
        const payout = w ? Math.floor(betAmt * 1.96) : 0;
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ winner: w ? 1 : 2, payout, result: w ? 'win' : 'lose', balance: getBal(address).zhixi }));
        return;
      }

      // ── Blackjack ──
      if (path === '/api/v1/games/blackjack/play') {
        const action = body.action || 'start';
        let state = bjGames.get(sid) || null;

        if (action === 'start') {
          deductBal(address, token, betAmt); bet(address, token, betAmt);
          const deck = shuffle(RANKS.flatMap(r => SUITS.map(s => ({ rank: r, suit: s }))));
          const pc = [deck.pop(), deck.pop()];
          const dc = [deck.pop(), { ...deck.pop(), hidden: true }];
          state = { deck, playerCards: pc, dealerCards: dc, playerTotal: pc.reduce((s, c) => s + RV[c.rank], 0), dealerTotal: RV[dc[0].rank] + RV[dc[1].rank], status: 'in_progress', betAmount: betAmt };
          bjGames.set(sid, state);
          json(res, 200, env({ playerCards: pc, dealerCards: dc, playerTotal: state.playerTotal, dealerTotal: state.dealerTotal, status: 'in_progress', isWin: false, isPush: false, multiplier: 0 }));
          return;
        }

        if (!state) { json(res, 400, err('NO_ACTIVE_GAME')); return; }

        if (action === 'hit') {
          state.playerCards.push(state.deck.pop());
          state.playerTotal = state.playerCards.reduce((s, c) => s + RV[c.rank], 0);
          if (state.playerTotal > 21) {
            bjGames.delete(sid);
            json(res, 200, env({ playerCards: state.playerCards, dealerCards: state.dealerCards.map(c => ({ ...c, hidden: false })), playerTotal: state.playerTotal, dealerTotal: state.dealerTotal, status: 'settled', isWin: false, isPush: false, multiplier: 0, reason: '爆牌', result: 'lose', payout: 0 }));
            return;
          }
          bjGames.set(sid, state);
          json(res, 200, env({ playerCards: state.playerCards, dealerCards: state.dealerCards, playerTotal: state.playerTotal, dealerTotal: state.dealerTotal, status: 'in_progress', isWin: false, isPush: false, multiplier: 0 }));
          return;
        }

        if (action === 'stand') {
          let dTotal = state.dealerCards.reduce((s, c) => s + RV[c.rank], 0);
          while (dTotal < 17) { const c = state.deck.pop(); state.dealerCards.push(c); dTotal += RV[c.rank]; }
          state.dealerTotal = dTotal;
          const isPush = state.playerTotal === dTotal;
          const isWin = !isPush && (dTotal > 21 || state.playerTotal > dTotal);
          const payout = isWin ? Math.floor(state.betAmount * 2) : isPush ? state.betAmount : 0;
          if (payout > 0) win(address, token, payout);
          bjGames.delete(sid);
          json(res, 200, env({ playerCards: state.playerCards, dealerCards: state.dealerCards.map(c => ({ ...c, hidden: false })), playerTotal: state.playerTotal, dealerTotal: state.dealerTotal, status: 'settled', isWin, isPush, multiplier: isWin ? 2 : isPush ? 1 : 0, reason: isWin ? '' : isPush ? '平手' : '莊家勝', result: isWin ? 'win' : isPush ? 'draw' : 'lose', payout }));
          return;
        }
        json(res, 400, err('UNKNOWN_ACTION'));
        return;
      }

      // ── Crash ──
      if (path === '/api/v1/games/crash/play') {
        const cashout = body.cashout || false;
        const roundId = body.roundId;

        if (!cashout || !roundId) {
          deductBal(address, token, betAmt); bet(address, token, betAmt);
          const cPt = 1 + Math.random() * 5;
          const rid = uid();
          crashGames.set(rid, { address, betAmount: betAmt, crashPoint: cPt, token });
          json(res, 200, env({ roundId: rid, crashPoint: cPt, crashed: false, result: 'in_progress', multiplier: 1 }));
          return;
        }

        const g = crashGames.get(roundId);
        if (!g) { json(res, 400, err('ROUND_NOT_FOUND')); return; }
        const curMult = 1 + (body.elapsedSeconds || 0) * 0.3;
        const crashed = curMult >= g.crashPoint;
        const payout = crashed ? 0 : Math.floor(g.betAmount * curMult);
        if (payout > 0) win(address, token, payout);
        crashGames.delete(roundId);
        json(res, 200, env({ roundId, crashPoint: g.crashPoint, crashed, result: crashed ? 'crashed' : 'cashed_out', multiplier: curMult, payout, balance: getBal(address).zhixi }));
        return;
      }

      // ── Dragon Gate ──
      if (path === '/api/v1/games/shoot-dragon-gate/open') {
        const l = draw(), r2 = draw();
        const [lo, hi] = [Math.min(RV[l], RV[r2]), Math.max(RV[l], RV[r2])];
        const gid = uid();
        dragonGates.set(gid, { left: l, right: r2, lo, hi, address });
        json(res, 200, env({ gateId: gid, left: l, right: r2, lo, hi, multiplier: 2 }));
        return;
      }
      if (path === '/api/v1/games/shoot-dragon-gate/play') {
        const gate = dragonGates.get(body.gateId);
        if (!gate || gate.address !== address) { json(res, 400, err('INVALID_GATE')); return; }
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        dragonGates.delete(body.gateId);
        const mid = draw();
        const mv = RV[mid];
        let result, payout;
        if (gate.lo === gate.hi) { result = 'draw'; payout = betAmt; }
        else if (mv > gate.lo && mv < gate.hi) { result = 'win'; payout = Math.floor(betAmt * 2); }
        else { result = 'lose'; payout = 0; }
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ left: gate.left, right: gate.right, mid, lo: gate.lo, hi: gate.hi, result, payout, balance: getBal(address).zhixi }));
        return;
      }

      // ── Poker ──
      if (path === '/api/v1/games/poker/play') {
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const deck = shuffle(RANKS.flatMap(r => SUITS.map(s => ({ rank: r, suit: s }))));
        const cards = deck.slice(0, 5);
        const hand = pokerHand(cards);
        const payout = Math.floor(betAmt * hand.mult);
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ result: payout > 0 ? 'win' : 'lose', hand: hand.hand, multiplier: hand.mult, payout, cards, balance: getBal(address).zhixi }));
        return;
      }

      // ── BluffDice ──
      if (path === '/api/v1/games/bluffdice/play') {
        deductBal(address, token, betAmt); bet(address, token, betAmt);
        const r = bluffDice();
        const payout = Math.floor(betAmt * r.multiplier);
        if (payout > 0) win(address, token, payout);
        json(res, 200, env({ dice: r.dice, total: r.total, result: payout > 0 ? 'win' : 'lose', payout, balance: getBal(address).zhixi }));
        return;
      }

      json(res, 404, err('GAME_NOT_FOUND'));
      return;
    }

    // ──────── HEALTH ────────
    if (path === '/api/health' || path === '/health') { json(res, 200, { status: 'ok' }); return; }

    // ──────── LEGACY /api/user.js ────────
    if (path === '/api/user.js' && (req.method === 'POST' || req.method === 'GET')) {
      const act = body.action || body.act || url.searchParams.get('action');
      if (act === 'create_session') {
        const s = makeSid();
        sessions.set(s, { status: 'pending', createdAt: Date.now() });
        json(res, 200, { success: true, status: 'pending', sessionId: s, deepLink: `dlinker:login:${s}`, legacyDeepLink: `dlinker:login:${s}` });
        return;
      }
      if (act === 'authorize') {
        const { sessionId, address, publicKey } = body;
        if (!sessionId || !address) { json(res, 400, { success: false, error: 'MISSING_SESSION_OR_ADDRESS' }); return; }
        const s = sessions.get(sessionId);
        if (!s) { json(res, 404, { success: false, error: 'SESSION_NOT_FOUND' }); return; }
        s.status = 'authorized'; s.address = address; s.publicKey = publicKey || '0x'; s.userId = crypto.randomUUID();
        initBal(address);
        json(res, 200, { success: true, status: 'authorized', sessionId, address });
        return;
      }
      if (act === 'get_status') {
        const s = sessions.get(body.sessionId || url.searchParams.get('sessionId'));
        json(res, 200, { success: true, status: s?.status || 'expired', address: s?.address || null });
        return;
      }
      json(res, 400, { success: false, error: 'UNKNOWN_ACTION', act });
      return;
    }

    json(res, 404, err('NOT_FOUND'));
  } catch (e) {
    console.error('API Error:', e);
    json(res, 500, err('INTERNAL_SERVER_ERROR'));
  }
}
