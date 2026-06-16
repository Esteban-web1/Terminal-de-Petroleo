// ══════════════════════════════════════════════════════════════
// netlify/functions/news-gnews.js
// Proxy para GNews API — noticias de petróleo en tiempo real
//
// Endpoint:
//   GET /.netlify/functions/news-gnews
//   GET /.netlify/functions/news-gnews?q=crude+oil+OPEC&lang=en&max=10
//
// Parámetros opcionales (todos tienen defaults):
//   q    → query de búsqueda (default: 'crude oil OPEC Brent WTI petroleum')
//   lang → idioma de resultados (default: 'en')
//   max  → cantidad máxima de artículos (default: 10, tope: 10 en plan gratuito)
//
// GNews responde con:
//   { totalArticles: N, articles: [ { title, description, url, image,
//     publishedAt, source: { name, url } }, ... ] }
//
// El frontend (fetchGNews) espera exactamente ese formato:
//   d.articles.forEach(a => { ... a.source?.name, a.publishedAt, a.title, a.url })
//
// Variables de entorno requeridas:
//   GNEWS_API_KEY → cargada en Netlify → Environment variables
//
// GNews plan gratuito: 100 requests/día, máximo 10 artículos por request.
// ══════════════════════════════════════════════════════════════

// ── CONSTANTES ───────────────────────────────────────────────
const TIMEOUT_MS = 10_000;
const MAX_ARTICLES = 10; // Tope del plan gratuito de GNews

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
  console.error(`[news-gnews.js] ERROR ${statusCode}: ${message}`, details || '');
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function okResponse(data) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

// ── HANDLER PRINCIPAL ────────────────────────────────────────
exports.handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Método no permitido. Usá GET.');
  }

  // ── VERIFICAR KEY ─────────────────────────────────────────
  const API_KEY = process.env.GNEWS_API_KEY;
  if (!API_KEY) {
    return errorResponse(503, 'API key de GNews no configurada en el servidor.');
  }

  // ── LEER PARÁMETROS ───────────────────────────────────────
  const params = event.queryStringParameters || {};
  const query  = params.q    || 'crude oil OPEC Brent WTI petroleum';
  const lang   = params.lang || 'en';
  // Limitar max a 10 (máximo del plan gratuito)
  const rawMax = parseInt(params.max, 10);
  const max    = isNaN(rawMax) ? 10 : Math.min(Math.max(rawMax, 1), MAX_ARTICLES);

  console.log(`[news-gnews.js] q="${query}" lang=${lang} max=${max}`);

  // ── CONSTRUIR URL ─────────────────────────────────────────
  // GNews usa 'token' como nombre del parámetro de API key
  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q',     query);
  url.searchParams.set('lang',  lang);
  url.searchParams.set('max',   max.toString());
  url.searchParams.set('token', API_KEY);

  // ── LLAMADA CON TIMEOUT ───────────────────────────────────
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (response.status === 429) {
      return errorResponse(429,
        'Límite diario de GNews alcanzado (100 req/día en plan gratuito). Se resetea a medianoche UTC.'
      );
    }
    if (response.status === 403) {
      return errorResponse(403, 'GNews rechazó la API key. Verificá que sea válida.');
    }
    if (!response.ok) {
      return errorResponse(502, `GNews respondió con status ${response.status}.`);
    }

    const data = await response.json();

    // GNews devuelve { errors: [...] } cuando hay un problema
    if (data.errors) {
      return errorResponse(502, 'GNews devolvió errores.', data.errors);
    }

    // Verificar que haya artículos
    if (!data.articles || !Array.isArray(data.articles)) {
      return errorResponse(502, 'GNews no devolvió artículos.', { keys: Object.keys(data) });
    }

    console.log(`[news-gnews.js] OK: ${data.articles.length} artículos`);

    // Devolvemos la respuesta tal cual — el frontend espera este formato
    return okResponse(data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return errorResponse(504, `GNews no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return errorResponse(502, 'Error de red al conectar con GNews.', err.message);
  }
};
