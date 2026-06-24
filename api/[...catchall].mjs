const PRIMARY = 'https://zixi-dev-tool.vercel.app/api/zixi';
const FALLBACK = 'https://zixi-casino-api.onrender.com';
const BACKENDS = [PRIMARY, FALLBACK];
const TIMEOUT = 10000;

const EXCLUDED_REQ_HEADERS = new Set([
  'host', 'connection', 'transfer-encoding',
  'x-forwarded-host', 'x-forwarded-for', 'x-forwarded-proto',
  'x-vercel-id', 'x-vercel-deployment-url', 'x-vercel-proxy-signature',
]);

const EXCLUDED_RES_HEADERS = new Set([
  'transfer-encoding', 'connection', 'keep-alive',
]);

export default async function handler(req, res) {
  const segments = req.query?.catchall || [];
  const subpath = Array.isArray(segments) ? segments.join('/') : segments || '';

  let targetPath;
  if (subpath.startsWith('__')) {
    targetPath = '/' + subpath.slice(2);
  } else if (subpath) {
    targetPath = '/api/' + subpath;
  } else {
    targetPath = '/api';
  }

  for (const backend of BACKENDS) {
    try {
      const targetUrl = `${backend}${targetPath}`;

      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (!EXCLUDED_REQ_HEADERS.has(key) && value !== undefined) {
          headers[key] = Array.isArray(value) ? value.join(', ') : value;
        }
      }

      const options = { method: req.method, headers };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        if (body.length > 0) options.body = body;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      options.signal = controller.signal;

      const upstream = await fetch(targetUrl, options);
      clearTimeout(timer);

      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => {
        if (!EXCLUDED_RES_HEADERS.has(key)) res.setHeader(key, value);
      });
      res.end(await upstream.text());
      return;
    } catch {
      continue;
    }
  }

  res.statusCode = 502;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: 'All backend services unreachable' }));
}
