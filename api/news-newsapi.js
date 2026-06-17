// ══════════════════════════════════════════════════════════════
// api/news-newsapi.js (Vercel Serverless Function)
// Proxy para NewsAPI — noticias de Reuters, Bloomberg, etc.
//
// GET /api/news-newsapi?q=crude+oil+OPEC+Brent+WTI
//
// ⚠️  La key se envía como header 'X-Api-Key', no como query param.
//
// Variable de entorno requerida:
//   NEWSAPI_API_KEY → Vercel → Project Settings → Environment Variables
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS   = 10_000;
const ALLOWED_SORT = new Set(['publishedAt', 'relevancy', 'popularity']);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[news-newsapi.js] ERROR ${statusCode}: ${message}`, details || '');
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

  const API_KEY = process.env.NEWSAPI_API_KEY;
  if (!API_KEY) {
    return sendError(res, 503, 'API key de NewsAPI no configurada en el servidor.');
  }

  const params   = req.query || {};
  const query    = params.q        || 'crude oil OPEC Brent WTI';
  const sortBy   = ALLOWED_SORT.has(params.sortBy) ? params.sortBy : 'publishedAt';
  const language = params.language || 'en';
  const rawSize  = parseInt(params.pageSize, 10);
  const pageSize = isNaN(rawSize) ? 10 : Math.min(Math.max(rawSize, 1), 100);

  console.log(`[news-newsapi.js] q="${query}" sortBy=${sortBy} pageSize=${pageSize}`);

  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q',        query);
  url.searchParams.set('sortBy',   sortBy);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set('language', language);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TerminalPetroleo/1.0',
        'X-Api-Key':  API_KEY, // ← así se autentica NewsAPI
      },
    });
    clearTimeout(timer);

    if (response.status === 429) {
      return sendError(res, 429, 'Rate limit de NewsAPI alcanzado. Reintentá más tarde.');
    }
    if (response.status === 401) {
      return sendError(res, 401, 'NewsAPI rechazó la API key. Verificá que sea válida.');
    }
    if (!response.ok) {
      return sendError(res, 502, `NewsAPI respondió con status ${response.status}.`);
    }

    const data = await response.json();

    if (data.status === 'error') {
      return sendError(res, 502, 'NewsAPI devolvió un error.', { code: data.code, message: data.message });
    }

    if (!data.articles || !Array.isArray(data.articles)) {
      return sendError(res, 502, 'NewsAPI no devolvió artículos.', { keys: Object.keys(data) });
    }

    console.log(`[news-newsapi.js] OK: ${data.articles.length} artículos`);

    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `NewsAPI no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return sendError(res, 502, 'Error de red al conectar con NewsAPI.', err.message);
  }
}
