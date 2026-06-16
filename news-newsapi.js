// ══════════════════════════════════════════════════════════════
// netlify/functions/news-newsapi.js
// Proxy para NewsAPI — noticias de Reuters, Bloomberg, etc.
//
// Endpoint:
//   GET /.netlify/functions/news-newsapi
//   GET /.netlify/functions/news-newsapi?q=crude+oil+OPEC+Brent+WTI
//
// Parámetros opcionales:
//   q        → query de búsqueda (default: 'crude oil OPEC Brent WTI')
//   sortBy   → criterio de orden (default: 'publishedAt')
//   pageSize → cantidad de artículos (default: 10, tope: 100)
//   language → idioma (default: 'en')
//
// NewsAPI responde con:
//   { status: "ok", totalResults: N, articles: [ { source: { name },
//     title, description, url, publishedAt, ... }, ... ] }
//
// El frontend (fetchNewsAPI) espera exactamente d.articles con
//   a.source?.name, a.publishedAt, a.title, a.url
//
// ⚠️  PARTICULARIDAD DE NEWSAPI:
//   En el plan gratuito ("Developer"), las llamadas desde el navegador
//   están BLOQUEADAS por CORS. Solo funcionan desde un servidor (backend).
//   Por eso este proxy es OBLIGATORIO para que funcione en producción.
//   La API key se envía como header 'X-Api-Key', no como query param.
//
// Variables de entorno requeridas:
//   NEWSAPI_API_KEY → cargada en Netlify → Environment variables
// ══════════════════════════════════════════════════════════════

// ── CONSTANTES ───────────────────────────────────────────────
const TIMEOUT_MS = 10_000;

// SortBy válidos según documentación de NewsAPI
const ALLOWED_SORT = new Set(['publishedAt', 'relevancy', 'popularity']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// ── HELPERS ──────────────────────────────────────────────────
function errorResponse(statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[news-newsapi.js] ERROR ${statusCode}: ${message}`, details || '');
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function okResponse(data) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

// ── HANDLER PRINCIPAL ────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Método no permitido. Usá GET.');
  }

  // ── VERIFICAR KEY ─────────────────────────────────────────
  const API_KEY = process.env.NEWSAPI_API_KEY;
  if (!API_KEY) {
    return errorResponse(503, 'API key de NewsAPI no configurada en el servidor.');
  }

  // ── LEER Y VALIDAR PARÁMETROS ─────────────────────────────
  const params   = event.queryStringParameters || {};
  const query    = params.q        || 'crude oil OPEC Brent WTI';
  const sortBy   = ALLOWED_SORT.has(params.sortBy) ? params.sortBy : 'publishedAt';
  const language = params.language || 'en';
  const rawSize  = parseInt(params.pageSize, 10);
  const pageSize = isNaN(rawSize) ? 10 : Math.min(Math.max(rawSize, 1), 100);

  console.log(`[news-newsapi.js] q="${query}" sortBy=${sortBy} pageSize=${pageSize}`);

  // ── CONSTRUIR URL ─────────────────────────────────────────
  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q',        query);
  url.searchParams.set('sortBy',   sortBy);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set('language', language);

  // ── LLAMADA CON TIMEOUT ───────────────────────────────────
  // NewsAPI requiere la key como header, no como query param
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TerminalPetroleo/1.0',
        'X-Api-Key':  API_KEY,    // ← Así se autentica NewsAPI
      },
    });
    clearTimeout(timer);

    if (response.status === 429) {
      return errorResponse(429, 'Rate limit de NewsAPI alcanzado. Reintentá más tarde.');
    }
    if (response.status === 401) {
      return errorResponse(401, 'NewsAPI rechazó la API key. Verificá que sea válida.');
    }
    if (!response.ok) {
      return errorResponse(502, `NewsAPI respondió con status ${response.status}.`);
    }

    const data = await response.json();

    // NewsAPI devuelve { status: "error", code: "...", message: "..." }
    if (data.status === 'error') {
      return errorResponse(502, 'NewsAPI devolvió un error.', {
        code:    data.code,
        message: data.message,
      });
    }

    if (!data.articles || !Array.isArray(data.articles)) {
      return errorResponse(502, 'NewsAPI no devolvió artículos.', { keys: Object.keys(data) });
    }

    console.log(`[news-newsapi.js] OK: ${data.articles.length} artículos`);
    return okResponse(data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return errorResponse(504, `NewsAPI no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return errorResponse(502, 'Error de red al conectar con NewsAPI.', err.message);
  }
};
