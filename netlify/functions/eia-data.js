// ══════════════════════════════════════════════════════════════
// netlify/functions/eia-data.js
// Proxy para EIA (Energy Information Administration) API v2
// Inventarios semanales de crudo de EE.UU.
//
// Endpoint:
//   GET /.netlify/functions/eia-data
//   GET /.netlify/functions/eia-data?series=petroleum/stoc/wstk/data/&frequency=weekly&length=4
//
// Parámetros opcionales:
//   series    → ruta del dataset dentro de la API v2
//               (default: 'petroleum/stoc/wstk/data/')
//   frequency → frecuencia de datos (default: 'weekly')
//   length    → cantidad de registros (default: 4, tope: 52)
//
// EIA responde con:
//   { response: { data: [ { period, value, ... }, ... ] } }
//
// El frontend (fetchEIAInventories) espera:
//   d.response?.data → array con al menos 2 items (latest y prev)
//   Cada item tiene: .value (en miles de barriles)
//
// Variables de entorno requeridas:
//   EIA_API_KEY → cargada en Netlify → Environment variables
//
// EIA API v2 no tiene rate limit documentado, pero la key es obligatoria.
// ══════════════════════════════════════════════════════════════

// ── CONSTANTES ───────────────────────────────────────────────
const TIMEOUT_MS = 10_000;

// Series permitidas — whitelist para no exponer toda la API de EIA
const ALLOWED_SERIES = new Set([
  'petroleum/stoc/wstk/data/',    // Inventarios semanales de crudo
  'petroleum/pri/spt/data/',      // Precios spot de petróleo
]);

const ALLOWED_FREQUENCIES = new Set(['weekly', 'monthly', 'annual']);

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
  console.error(`[eia-data.js] ERROR ${statusCode}: ${message}`, details || '');
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
  const API_KEY = process.env.EIA_API_KEY;
  if (!API_KEY) {
    return errorResponse(503, 'API key de EIA no configurada en el servidor.');
  }

  // ── LEER Y VALIDAR PARÁMETROS ─────────────────────────────
  const params    = event.queryStringParameters || {};
  const series    = params.series    || 'petroleum/stoc/wstk/data/';
  const frequency = params.frequency || 'weekly';
  const rawLen    = parseInt(params.length, 10);
  const length    = isNaN(rawLen) ? 4 : Math.min(Math.max(rawLen, 1), 52);

  // Validar series contra whitelist
  if (!ALLOWED_SERIES.has(series)) {
    return errorResponse(400,
      `Serie no permitida: "${series}". ` +
      `Valores válidos: ${[...ALLOWED_SERIES].join(', ')}`
    );
  }

  // Validar frequency
  if (!ALLOWED_FREQUENCIES.has(frequency)) {
    return errorResponse(400,
      `Frecuencia no válida: "${frequency}". ` +
      `Valores válidos: ${[...ALLOWED_FREQUENCIES].join(', ')}`
    );
  }

  console.log(`[eia-data.js] series=${series} frequency=${frequency} length=${length}`);

  // ── CONSTRUIR URL ─────────────────────────────────────────
  // La API v2 de EIA tiene una estructura de URL particular:
  // https://api.eia.gov/v2/{series}?api_key=KEY&frequency=X&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=N
  const url = `https://api.eia.gov/v2/${series}?api_key=${API_KEY}&frequency=${frequency}&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=${length}`;

  // ── LLAMADA CON TIMEOUT ───────────────────────────────────
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (response.status === 403) {
      return errorResponse(403, 'EIA rechazó la API key. Verificá que sea válida.');
    }
    if (!response.ok) {
      return errorResponse(502, `EIA respondió con status ${response.status}.`);
    }

    const data = await response.json();

    // Verificar estructura esperada
    if (!data.response || !data.response.data || !Array.isArray(data.response.data)) {
      return errorResponse(502, 'EIA no devolvió datos en el formato esperado.', {
        keys: Object.keys(data),
      });
    }

    if (data.response.data.length === 0) {
      return errorResponse(502, 'EIA devolvió un array de datos vacío.');
    }

    console.log(`[eia-data.js] OK: ${data.response.data.length} registros. Último período: ${data.response.data[0].period}`);

    // Devolvemos la respuesta completa — el frontend espera d.response.data
    return okResponse(data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return errorResponse(504, `EIA no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return errorResponse(502, 'Error de red al conectar con EIA.', err.message);
  }
};
