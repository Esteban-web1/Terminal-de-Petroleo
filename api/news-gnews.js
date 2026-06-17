// ══════════════════════════════════════════════════════════════
// api/news-gnews.js (Vercel Serverless Function)
// Proxy para GNews API — noticias de petróleo en tiempo real
//
// GET /api/news-gnews?q=crude+oil+OPEC&lang=en&max=10
//
// Variable de entorno requerida:
//   GNEWS_API_KEY → Vercel → Project Settings → Environment Variables
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS   = 10_000;
const MAX_ARTICLES = 10; // tope del plan gratuito de GNews

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[news-gnews.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  return res.status(200).json(data);
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Método no permitido. Usá GET.');
  }

  const API_KEY = process.env.GNEWS_API_KEY;
  if (!API_KEY) {
    return sendError(res, 503, 'API key de GNews no configurada en el servidor.');
  }

  const params = req.query || {};
  const query  = params.q    || 'crude oil OPEC Brent WTI petroleum';
  const lang   = params.lang || 'en';
  const rawMax = parseInt(params.max, 10);
  const max    = isNaN(rawMax) ? 10 : Math.min(Math.max(rawMax, 1), MAX_ARTICLES);

  console.log(`[news-gnews.js] q="${query}" lang=${lang} max=${max}`);

  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q',     query);
  url.searchParams.set('lang',  lang);
  url.searchParams.set('max',   max.toString());
  url.searchParams.set('token', API_KEY);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (response.status === 429) {
      return sendError(res, 429,
        'Límite diario de GNews alcanzado (100 req/día en plan gratuito). Se resetea a medianoche UTC.'
      );
    }
    if (response.status === 403) {
      return sendError(res, 403, 'GNews rechazó la API key. Verificá que sea válida.');
    }
    if (!response.ok) {
      return sendError(res, 502, `GNews respondió con status ${response.status}.`);
    }

    const data = await response.json();

    if (data.errors) {
      return sendError(res, 502, 'GNews devolvió errores.', data.errors);
    }

    if (!data.articles || !Array.isArray(data.articles)) {
      return sendError(res, 502, 'GNews no devolvió artículos.', { keys: Object.keys(data) });
    }

    console.log(`[news-gnews.js] OK: ${data.articles.length} artículos`);

    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `GNews no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return sendError(res, 502, 'Error de red al conectar con GNews.', err.message);
  }
}
