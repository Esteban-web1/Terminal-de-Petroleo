
// ══════════════════════════════════════════════════════════════
// api/eia.js (Vercel Serverless Function)
// OPTIMIZACIÓN DE FUNCIONES: fusiona lo que antes eran 2 funciones
// separadas (api/eia-data.js + api/eia-steo.js) en una sola, para
// no superar el límite de 12 funciones serverless del plan gratis
// de Vercel. Misma lógica de cada una, solo que ahora conviven bajo
// un parámetro "type".
//
// GET /api/eia?type=inventory&series=crude_stocks&length=8
//   → mismo formato que antes devolvía /api/eia-data
// GET /api/eia?type=steo
//   → mismo formato que antes devolvía /api/eia-steo: {wti:[...],brent:[...]}
//
// Variable de entorno requerida (la misma para ambos):
//   EIA_API_KEY → Vercel → Project Settings → Environment Variables
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;

// ── type=inventory: usa /v2/seriesid/{ID}, traduce IDs legacy solo ──
const SERIES_WHITELIST = {
  crude_stocks:    'PET.WCRSTUS1.W',
  gasoline_stocks: 'PET.WGTSTUS1.W',
  cushing_stocks:  'PET.W_EPC0_SAX_YCUOK_MBBL.W',
};

// ── type=steo: pronóstico oficial mensual de WTI/Brent ──
const STEO_SERIES_IDS = ['WTIPUUS', 'BREPUUS'];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[eia.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  return res.status(200).json(data);
}

async function handleInventory(res, params, API_KEY) {
  const seriesKey = params.series || 'crude_stocks';
  const rawLen = parseInt(params.length, 10);
  const length = isNaN(rawLen) ? 8 : Math.min(Math.max(rawLen, 1), 52);

  const legacyId = SERIES_WHITELIST[seriesKey];
  if (!legacyId) {
    return sendError(res, 400,
      `Serie no permitida: "${seriesKey}". Valores válidos: ${Object.keys(SERIES_WHITELIST).join(', ')}`
    );
  }

  console.log(`[eia.js] type=inventory series=${seriesKey} (${legacyId}) length=${length}`);

  const url = `https://api.eia.gov/v2/seriesid/${legacyId}?api_key=${API_KEY}&sort[0][column]=period&sort[0][direction]=desc&length=${length}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'TerminalPetroleo/1.0' } });
    clearTimeout(timer);

    if (response.status === 403) return sendError(res, 403, 'EIA rechazó la API key. Verificá que sea válida.');
    if (!response.ok) return sendError(res, 502, `EIA respondió con status ${response.status}.`);

    const data = await response.json();
    if (!data.response || !data.response.data || !Array.isArray(data.response.data)) {
      return sendError(res, 502, 'EIA no devolvió datos en el formato esperado.', { keys: Object.keys(data) });
    }
    if (data.response.data.length === 0) {
      return sendError(res, 502, 'EIA devolvió un array de datos vacío.', { seriesKey, legacyId });
    }

    console.log(`[eia.js] OK inventory: ${data.response.data.length} registros de ${seriesKey}.`);
    return sendOk(res, data);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return sendError(res, 504, `EIA no respondió en ${TIMEOUT_MS / 1000}s (timeout).`);
    return sendError(res, 502, 'Error de red al conectar con EIA.', err.message);
  }
}

async function handleSteo(res, API_KEY) {
  const url = new URL('https://api.eia.gov/v2/steo/data/');
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('frequency', 'monthly');
  url.searchParams.set('data[0]', 'value');
  STEO_SERIES_IDS.forEach(id => url.searchParams.append('facets[seriesId][]', id));
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'desc');
  url.searchParams.set('length', '24');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal, headers: { 'User-Agent': 'TerminalPetroleo/1.0' } });
    clearTimeout(timer);

    if (response.status === 403) return sendError(res, 403, 'EIA rechazó la API key. Verificá que sea válida.');
    if (!response.ok) return sendError(res, 502, `EIA respondió con status ${response.status}.`);

    const data = await response.json();
    if (!data.response || !Array.isArray(data.response.data)) {
      return sendError(res, 502, 'EIA no devolvió datos en el formato esperado.', { keys: Object.keys(data) });
    }
    const rows = data.response.data;
    if (rows.length === 0) {
      return sendError(res, 502, 'EIA STEO no devolvió filas. La serie WTIPUUS/BREPUUS puede haber cambiado de nombre.');
    }

    const wti = rows.filter(r => r.seriesId === 'WTIPUUS')
      .map(r => ({ period: r.period, value: parseFloat(r.value) }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const brent = rows.filter(r => r.seriesId === 'BREPUUS')
      .map(r => ({ period: r.period, value: parseFloat(r.value) }))
      .sort((a, b) => a.period.localeCompare(b.period));

    console.log(`[eia.js] OK steo: ${wti.length} puntos WTI, ${brent.length} puntos Brent`);
    return sendOk(res, { wti, brent });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return sendError(res, 504, `EIA STEO no respondió en ${TIMEOUT_MS / 1000}s (timeout).`);
    return sendError(res, 502, 'Error de red al conectar con EIA STEO.', err.message);
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  const API_KEY = process.env.EIA_API_KEY;
  if (!API_KEY) return sendError(res, 503, 'API key de EIA no configurada en el servidor.');

  const params = req.query || {};
  const type = params.type || 'inventory';

  if (type === 'steo') return await handleSteo(res, API_KEY);
  if (type === 'inventory') return await handleInventory(res, params, API_KEY);

  return sendError(res, 400, `type inválido: "${type}". Usá "inventory" o "steo".`);
}
