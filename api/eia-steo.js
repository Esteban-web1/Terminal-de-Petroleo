// ══════════════════════════════════════════════════════════════
// api/eia-steo.js (Vercel Serverless Function)
// Proxy para el EIA STEO (Short-Term Energy Outlook) — pronóstico
// oficial del gobierno de EE.UU. para WTI y Brent. Real, gratis,
// se actualiza mensualmente. Reemplaza la tabla de bancos ficticia.
//
// GET /api/eia-steo
// → { wti: [{period,value}...], brent: [{period,value}...] }
//
// Series IDs confirmados:
//   WTIPUUS → WTI Price, US (STEO)
//   BREPUUS → Brent Price, US (STEO)
//
// Variable de entorno requerida:
//   EIA_API_KEY → la misma key que ya usa eia-data.js
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;
const SERIES_IDS = ['WTIPUUS', 'BREPUUS'];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[eia-steo.js] ERROR ${statusCode}: ${message}`, details || '');
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

  const url = new URL('https://api.eia.gov/v2/steo/data/');
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('frequency', 'monthly');
  url.searchParams.set('data[0]', 'value');
  SERIES_IDS.forEach(id => url.searchParams.append('facets[seriesId][]', id));
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'desc');
  url.searchParams.set('length', '24'); // últimos ~12 meses de cada serie

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
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

    if (!data.response || !Array.isArray(data.response.data)) {
      return sendError(res, 502, 'EIA no devolvió datos en el formato esperado.', { keys: Object.keys(data) });
    }

    const rows = data.response.data;
    if (rows.length === 0) {
      return sendError(res, 502,
        'EIA STEO no devolvió filas. La serie WTIPUUS/BREPUUS puede haber cambiado de nombre — verificar en api.eia.gov/opendata/browser/steo.'
      );
    }

    const wti = rows.filter(r => r.seriesId === 'WTIPUUS')
      .map(r => ({ period: r.period, value: parseFloat(r.value) }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const brent = rows.filter(r => r.seriesId === 'BREPUUS')
      .map(r => ({ period: r.period, value: parseFloat(r.value) }))
      .sort((a, b) => a.period.localeCompare(b.period));

    console.log(`[eia-steo.js] OK: ${wti.length} puntos WTI, ${brent.length} puntos Brent`);

    return sendOk(res, { wti, brent });

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `EIA STEO no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return sendError(res, 502, 'Error de red al conectar con EIA STEO.', err.message);
  }
}
