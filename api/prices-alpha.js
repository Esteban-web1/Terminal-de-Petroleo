// ══════════════════════════════════════════════════════════════
// api/prices-alpha.js (Vercel Serverless Function)
// Proxy para Alpha Vantage API — histórico de largo plazo
//
// GET /api/prices-alpha?function=BRENT&interval=monthly
//
// Variable de entorno requerida:
//   ALPHA_VANTAGE_API_KEY → Vercel → Project Settings → Environment Variables
//
// ⚠️  Alpha Vantage devuelve errores con HTTP 200. Se detectan vía
//   data["Note"] → 429, data["Information"] → 403, data["Error Message"] → 400
// ══════════════════════════════════════════════════════════════

const ALLOWED_FUNCTIONS = new Set(['BRENT', 'WTI', 'NATURAL_GAS']);
const ALLOWED_INTERVALS = new Set(['monthly', 'weekly']);
const TIMEOUT_MS = 10_000;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[prices-alpha.js] ERROR ${statusCode}: ${message}`, details || '');
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

  const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  if (!API_KEY) {
    return sendError(res, 503, 'API key de Alpha Vantage no configurada en el servidor.');
  }

  const params     = req.query || {};
  const avFunction = params.function;
  const interval   = params.interval || 'monthly';

  if (!avFunction) {
    return sendError(res, 400,
      `Parámetro requerido: function. Valores válidos: ${[...ALLOWED_FUNCTIONS].join(', ')}`
    );
  }
  if (!ALLOWED_FUNCTIONS.has(avFunction)) {
    return sendError(res, 400,
      `Función no permitida: "${avFunction}". Valores válidos: ${[...ALLOWED_FUNCTIONS].join(', ')}`
    );
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return sendError(res, 400,
      `Intervalo no válido: "${interval}". Valores válidos: ${[...ALLOWED_INTERVALS].join(', ')}`
    );
  }

  console.log(`[prices-alpha.js] function=${avFunction} interval=${interval}`);

  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', avFunction);
  url.searchParams.set('interval', interval);
  url.searchParams.set('apikey',   API_KEY);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return sendError(res, 502, `Alpha Vantage respondió con status HTTP ${response.status}.`);
    }

    const data = await response.json();

    if (data['Note']) {
      console.warn('[prices-alpha.js] Rate limit detectado:', data['Note'].substring(0, 100));
      return sendError(res, 429,
        'Límite diario de Alpha Vantage alcanzado (25 requests/día en plan gratuito). Se resetea a medianoche UTC.',
        { note: data['Note'] }
      );
    }

    if (data['Information']) {
      console.warn('[prices-alpha.js] Información de AV:', data['Information'].substring(0, 100));
      return sendError(res, 403,
        'Alpha Vantage rechazó la key o el acceso al endpoint. Verificá la API key.',
        { information: data['Information'] }
      );
    }

    if (data['Error Message']) {
      return sendError(res, 400,
        'Alpha Vantage reportó un error en los parámetros de la consulta.',
        { errorMessage: data['Error Message'] }
      );
    }

    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return sendError(res, 502,
        'Alpha Vantage no devolvió datos históricos. Puede que el endpoint no esté disponible en el plan gratuito actual.',
        { receivedKeys: Object.keys(data) }
      );
    }

    const sample = data.data[0];
    if (!sample.date || !sample.value) {
      return sendError(res, 502, 'El formato de los datos de Alpha Vantage no es el esperado.', { sample });
    }

    console.log(
      `[prices-alpha.js] OK: ${data.data.length} puntos de ${avFunction} (${interval}). ` +
      `Rango: ${data.data[data.data.length - 1].date} → ${data.data[0].date}`
    );

    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504,
        `Alpha Vantage no respondió en ${TIMEOUT_MS / 1000} segundos (timeout). La API puede estar temporalmente lenta. Reintentá.`
      );
    }
    return sendError(res, 502, 'Error de red al conectar con Alpha Vantage.', err.message);
  }
}
