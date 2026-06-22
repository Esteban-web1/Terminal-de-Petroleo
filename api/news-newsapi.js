// ══════════════════════════════════════════════════════════════
// api/eia-data.js (Vercel Serverless Function)
// Proxy para EIA API v2 — usa el endpoint /v2/seriesid/{ID} que
// traduce automáticamente IDs legacy de la API v1 (formato
// "PET.XXXXX.W"). Evita tener que adivinar facets manualmente
// (duoarea, productId, etc.) — la causa de un bug anterior donde
// el delta de inventarios salía sin sentido por escopear mal el
// área geográfica.
//
// GET /api/eia-data?series=crude_stocks
// GET /api/eia-data?series=cushing_stocks&length=8
//
// Variable de entorno requerida:
//   EIA_API_KEY → Vercel → Project Settings → Environment Variables
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;

// Whitelist: clave interna → ID legacy real de EIA (verificado).
// MEJORA 6: se agregaron gasolina y Cushing además del crudo
// nacional que ya existía. SPR y utilización de refinerías NO se
// incluyen porque no pude verificar con certeza sus IDs legacy
// exactos sin acceso de prueba en vivo — agregarlos a ciegas podría
// repetir el bug de facets mal adivinados que ya tuvimos. Si me
// pasás el ID confirmado (ej. desde eia.gov/opendata/browser),
// lo sumo en la próxima vuelta.
const SERIES_WHITELIST = {
  crude_stocks:    'PET.WCRSTUS1.W',              // Existencias de crudo (excl. SPR), EE.UU., semanal
  gasoline_stocks: 'PET.WGTSTUS1.W',              // Existencias de gasolina terminada, EE.UU., semanal
  cushing_stocks:  'PET.W_EPC0_SAX_YCUOK_MBBL.W', // Existencias en Cushing, OK, semanal
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[eia-data.js] ERROR ${statusCode}: ${message}`, details || '');
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

  const API_KEY = process.env.EIA_API_KEY;
  if (!API_KEY) {
    return sendError(res, 503, 'API key de EIA no configurada en el servidor.');
  }

  const params = req.query || {};
  const seriesKey = params.series || 'crude_stocks';
  const rawLen = parseInt(params.length, 10);
  const length = isNaN(rawLen) ? 8 : Math.min(Math.max(rawLen, 1), 52);

  const legacyId = SERIES_WHITELIST[seriesKey];
  if (!legacyId) {
    return sendError(res, 400,
      `Serie no permitida: "${seriesKey}". Valores válidos: ${Object.keys(SERIES_WHITELIST).join(', ')}`
    );
  }

  console.log(`[eia-data.js] series=${seriesKey} (${legacyId}) length=${length}`);

  const url = `https://api.eia.gov/v2/seriesid/${legacyId}?api_key=${API_KEY}&sort[0][column]=period&sort[0][direction]=desc&length=${length}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (response.status === 403) {
      return sendError(res, 403, 'EIA rechazó la API key. Verificá que sea válida.');
    }
    if (!response.ok) {
      return sendError(res, 502, `EIA respondió con status ${response.status}.`);
    }

    const data = await response.json();

    if (!data.response || !data.response.data || !Array.isArray(data.response.data)) {
      return sendError(res, 502, 'EIA no devolvió datos en el formato esperado.', { keys: Object.keys(data) });
    }

    if (data.response.data.length === 0) {
      return sendError(res, 502, 'EIA devolvió un array de datos vacío.', { seriesKey, legacyId });
    }

    console.log(`[eia-data.js] OK: ${data.response.data.length} registros de ${seriesKey}. Último período: ${data.response.data[0].period}`);

    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `EIA no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return sendError(res, 502, 'Error de red al conectar con EIA.', err.message);
  }
}
