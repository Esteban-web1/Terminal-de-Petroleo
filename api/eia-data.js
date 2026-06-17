// ══════════════════════════════════════════════════════════════
// api/eia-data.js (Vercel Serverless Function)
// Proxy para EIA (Energy Information Administration) API v2
//
// GET /api/eia-data
// GET /api/eia-data?series=petroleum/stoc/wstk/data/&frequency=weekly&length=4
//
// Variable de entorno requerida:
//   EIA_API_KEY → Vercel → Project Settings → Environment Variables
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;

const ALLOWED_SERIES = new Set([
  'petroleum/stoc/wstk/data/',
  'petroleum/pri/spt/data/',
]);

const ALLOWED_FREQUENCIES = new Set(['weekly', 'monthly', 'annual']);

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

  const params    = req.query || {};
  const series    = params.series    || 'petroleum/stoc/wstk/data/';
  const frequency = params.frequency || 'weekly';
  const rawLen    = parseInt(params.length, 10);
  const length    = isNaN(rawLen) ? 4 : Math.min(Math.max(rawLen, 1), 52);

  if (!ALLOWED_SERIES.has(series)) {
    return sendError(res, 400,
      `Serie no permitida: "${series}". Valores válidos: ${[...ALLOWED_SERIES].join(', ')}`
    );
  }
  if (!ALLOWED_FREQUENCIES.has(frequency)) {
    return sendError(res, 400,
      `Frecuencia no válida: "${frequency}". Valores válidos: ${[...ALLOWED_FREQUENCIES].join(', ')}`
    );
  }

  console.log(`[eia-data.js] series=${series} frequency=${frequency} length=${length}`);

  const url = `https://api.eia.gov/v2/${series}?api_key=${API_KEY}&frequency=${frequency}&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=${length}`;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
      return sendError(res, 502, 'EIA devolvió un array de datos vacío.');
    }

    console.log(`[eia-data.js] OK: ${data.response.data.length} registros. Último período: ${data.response.data[0].period}`);

    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `EIA no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return sendError(res, 502, 'Error de red al conectar con EIA.', err.message);
  }
}
