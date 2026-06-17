// ══════════════════════════════════════════════════════════════
// api/prices.js (Vercel Serverless Function)
// Proxy para TwelveData API — dos modos en un solo endpoint:
//
//   MODO 1 — Precios spot actuales (ticker + badge LIVE)
//   GET /api/prices?mode=spot
//   Respuesta: { "BRENT/USD": { price: "74.38" }, "WTI/USD": {...}, "XNG/USD": {...} }
//
//   MODO 2 — Serie de velas OHLCV (gráfico de velas japonesas)
//   GET /api/prices?mode=candles&symbol=BRENT/USD&interval=1day&outputsize=150
//   Respuesta: { values: [ { datetime, open, high, low, close, volume }, ... ] }
//
// Variable de entorno requerida:
//   TWELVE_DATA_API_KEY → cargada en Vercel → Project Settings → Environment Variables
// ══════════════════════════════════════════════════════════════

const ALLOWED_SYMBOLS = new Set(['BRENT/USD', 'WTI/USD', 'XNG/USD']);
const SPOT_SYMBOLS    = ['BRENT/USD', 'WTI/USD', 'XNG/USD'];

const ALLOWED_INTERVALS = new Set([
  '1min', '5min', '15min', '30min',
  '1h', '2h', '4h', '8h',
  '1day', '1week', '1month',
]);

const TIMEOUT_MS = 10_000;

// ── HELPERS ──────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[prices.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  return res.status(200).json(data);
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Método no permitido. Usá GET.');
  }

  const API_KEY = process.env.TWELVE_DATA_API_KEY;
  if (!API_KEY) {
    return sendError(res, 503, 'API key de TwelveData no configurada en el servidor.');
  }

  const params = req.query || {};
  const mode   = params.mode || 'spot';

  console.log(`[prices.js] mode=${mode}`, mode === 'candles'
    ? `symbol=${params.symbol} interval=${params.interval} outputsize=${params.outputsize}`
    : 'symbols=BRENT/USD,WTI/USD,XNG/USD'
  );

  if (mode === 'spot') {
    return await handleSpot(res, API_KEY);
  }

  if (mode === 'candles') {
    return await handleCandles(res, API_KEY, params);
  }

  return sendError(res, 400, `Modo inválido: "${mode}". Usá "spot" o "candles".`);
}

// ══════════════════════════════════════════════════════════════
// MODO SPOT
// ══════════════════════════════════════════════════════════════
async function handleSpot(res, apiKey) {
  const url = new URL('https://api.twelvedata.com/price');
  url.searchParams.set('symbol', SPOT_SYMBOLS.join(','));
  url.searchParams.set('apikey', apiKey);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (response.status === 429) {
      return sendError(res, 429, 'Rate limit de TwelveData alcanzado (8 req/min en plan gratuito). Reintentá en 60 segundos.');
    }
    if (!response.ok) {
      return sendError(res, 502, `TwelveData respondió con status ${response.status}.`);
    }

    const data = await response.json();

    if (data.status === 'error' || data.code) {
      return sendError(res, 502, 'TwelveData devolvió un error.', { code: data.code, message: data.message });
    }

    const hasAnyPrice = SPOT_SYMBOLS.some(sym => data[sym]?.price);
    if (!hasAnyPrice) {
      return sendError(res, 502, 'TwelveData no devolvió precios válidos.', data);
    }

    console.log('[prices.js] Spot prices OK:', {
      BRENT: data['BRENT/USD']?.price,
      WTI:   data['WTI/USD']?.price,
      XNG:   data['XNG/USD']?.price,
    });

    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `TwelveData no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }
    return sendError(res, 502, 'Error de red al conectar con TwelveData.', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// MODO CANDLES
// ══════════════════════════════════════════════════════════════
async function handleCandles(res, apiKey, params) {
  const symbol = params.symbol;
  if (!symbol) {
    return sendError(res, 400, 'Parámetro requerido: symbol (ej: BRENT/USD)');
  }

  const decodedSymbol = decodeURIComponent(symbol);
  if (!ALLOWED_SYMBOLS.has(decodedSymbol)) {
    return sendError(res, 400,
      `Símbolo no permitido: "${decodedSymbol}". Valores válidos: ${[...ALLOWED_SYMBOLS].join(', ')}`
    );
  }

  const interval = params.interval || '1day';
  if (!ALLOWED_INTERVALS.has(interval)) {
    return sendError(res, 400,
      `Intervalo no válido: "${interval}". Valores válidos: ${[...ALLOWED_INTERVALS].join(', ')}`
    );
  }

  const rawSize    = parseInt(params.outputsize, 10);
  const outputsize = isNaN(rawSize) ? 150 : Math.min(Math.max(rawSize, 1), 500);

  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol',     decodedSymbol);
  url.searchParams.set('interval',   interval);
  url.searchParams.set('outputsize', outputsize.toString());
  url.searchParams.set('apikey',     apiKey);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (response.status === 429) {
      return sendError(res, 429, 'Rate limit de TwelveData alcanzado. Reintentá en 60 segundos.');
    }
    if (!response.ok) {
      return sendError(res, 502, `TwelveData respondió con status ${response.status}.`);
    }

    const data = await response.json();

    if (data.status === 'error' || data.code) {
      return sendError(res, 502, 'TwelveData devolvió un error en time_series.', { code: data.code, message: data.message });
    }

    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return sendError(res, 502,
        'TwelveData no devolvió valores OHLCV. El símbolo o intervalo puede no estar disponible en el plan gratuito.',
        { symbol: decodedSymbol, interval, meta: data.meta }
      );
    }

    console.log(`[prices.js] Candles OK: ${data.values.length} barras ${decodedSymbol} ${interval}`);

    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `TwelveData time_series no respondió en ${TIMEOUT_MS / 1000} segundos.`);
    }
    return sendError(res, 502, 'Error de red al conectar con TwelveData.', err.message);
  }
}
