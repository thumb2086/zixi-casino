import crypto from 'node:crypto';

const sessions = new Map();
const users = new Map();

const uuid = () => crypto.randomUUID().slice(0, 8);
const makeSid = () => `sess_${crypto.randomUUID().slice(0, 12)}`;
const envelope = (data, ok = true) => ({
  success: ok, data, requestId: uuid(), timestamp: Date.now(),
});
const errEnv = (msg) => ({ success: false, error: msg, requestId: uuid(), timestamp: Date.now() });

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try { resolve(JSON.parse(b)); } catch { resolve({}); }
    });
  });
}

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

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    json(res, 204, '');
    return;
  }

  try {
    // --- /api/v1/auth/* routes ---
    if (path.startsWith('/api/v1/auth/')) {
      const action = path.replace('/api/v1/auth', '') || '/';

      // POST /api/v1/auth/create-session
      if (action === '/create-session' && req.method === 'POST') {
        const sid = makeSid();
        sessions.set(sid, { status: 'pending', createdAt: Date.now() });
        json(res, 200, envelope({
          sessionId: sid,
          deepLink: `dlinker:login:${sid}`,
          legacyDeepLink: `dlinker:login:${sid}`,
        }));
        return;
      }

      // GET /api/v1/auth/status?sessionId=xxx
      if (action === '/status' && req.method === 'GET') {
        const sid = url.searchParams.get('sessionId');
        const s = sessions.get(sid);
        json(res, 200, envelope({
          status: s?.status || 'expired',
          address: s?.address || null,
          publicKey: s?.publicKey || null,
        }));
        return;
      }

      // POST /api/v1/auth/custody/login or register
      if ((action === '/custody/login' || action === '/custody/register') && req.method === 'POST') {
        const body = await readBody(req);
        const { username, password } = body;
        if (!username || !password) {
          json(res, 400, errEnv('USERNAME_PASSWORD_REQUIRED'));
          return;
        }

        if (action === '/custody/register') {
          if (users.has(username)) {
            json(res, 400, errEnv('USERNAME_TAKEN'));
            return;
          }
          const addr = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`;
          users.set(username, { username, password, id: crypto.randomUUID(), address: addr });
        }

        const user = users.get(username);
        if (!user || user.password !== password) {
          json(res, 400, errEnv('INVALID_CREDENTIALS'));
          return;
        }

        const sid = makeSid();
        sessions.set(sid, { status: 'authorized', address: user.address, publicKey: '0x', userId: user.id });

        json(res, 200, envelope({
          success: true,
          sessionId: sid,
          address: user.address,
          publicKey: '0x',
          user,
          registerBonus: action === '/custody/register' ? { granted: true, mode: 'demo', balance: '100000' } : undefined,
        }));
        return;
      }

      // GET /api/v1/auth/me?sessionId=xxx
      if (action === '/me' && req.method === 'GET') {
        const sid = url.searchParams.get('sessionId');
        const s = sessions.get(sid);
        if (!s || s.status !== 'authorized') {
          json(res, 200, envelope({ user: null }));
          return;
        }
        json(res, 200, envelope({
          user: { id: s.userId, address: s.address },
          address: s.address,
          mode: 'demo',
          username: 'demo_user',
          balance: '100000',
          totalBet: '0',
        }));
        return;
      }

      json(res, 404, errEnv('AUTH_ROUTE_NOT_FOUND'));
      return;
    }

    // --- /api/user.js legacy route ---
    if (path === '/api/user.js' && (req.method === 'POST' || req.method === 'GET')) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const act = body.action || body.act || url.searchParams.get('action');

      if (act === 'create_session') {
        const sid = makeSid();
        sessions.set(sid, { status: 'pending', createdAt: Date.now() });
        json(res, 200, {
          success: true, status: 'pending', sessionId: sid,
          deepLink: `dlinker:login:${sid}`,
          legacyDeepLink: `dlinker:login:${sid}`,
        });
        return;
      }

      if (act === 'authorize') {
        const { sessionId, address, publicKey } = body;
        if (!sessionId || !address) {
          json(res, 400, { success: false, error: 'MISSING_SESSION_OR_ADDRESS' });
          return;
        }
        const s = sessions.get(sessionId);
        if (!s) {
          json(res, 404, { success: false, error: 'SESSION_NOT_FOUND' });
          return;
        }
        s.status = 'authorized';
        s.address = address;
        s.publicKey = publicKey || '0x';
        s.userId = crypto.randomUUID();
        json(res, 200, { success: true, status: 'authorized', sessionId, address });
        return;
      }

      if (act === 'get_status') {
        const sid = body.sessionId || url.searchParams.get('sessionId');
        const s = sessions.get(sid);
        json(res, 200, { success: true, status: s?.status || 'expired', address: s?.address || null });
        return;
      }

      json(res, 400, { success: false, error: 'UNKNOWN_ACTION', act });
      return;
    }

    json(res, 404, errEnv('NOT_FOUND'));
  } catch (e) {
    console.error('API Error:', e);
    json(res, 500, errEnv('INTERNAL_SERVER_ERROR'));
  }
}
