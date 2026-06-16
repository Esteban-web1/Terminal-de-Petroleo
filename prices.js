// ══════════════════════════════════════════════════════════════
// netlify/functions/prices.js
// Proxy para TwelveData API — dos modos en un solo endpoint:
//
//   MODO 1 — Precios spot actuales (ticker + badge LIVE)
//   GET /.netlify/functions/prices?mode=spot
//   Respuesta: { "BRENT/USD": { price: "74.38" }, "WTI/USD": {...}, "XNG/USD": {...} }
//
//   MODO 2 — Serie de velas OHLCV (gráfico de velas japonesas)
//   GET /.netlify/functions/prices?mode=candles&symbol=BRENT/USD&interval=1day&outputsize=150
//   Respuesta: { values: [ { datetime, open, high, low, close, volume }, ... ] }
//
// Variables de entorno requeridas:
//   TWELVE_DATA_API_KEY → cargada en Netlify → Environment variables
// ══════════════════════════════════════════════════════════════

// ── CONSTANTES DE VALIDACIÓN ─────────────────────────────────

// Solo los símbolos que usa el frontend. Cualquier otro se rechaza.
// Esto evita que alguien use nuestro proxy para consultar símbolos
// arbitrarios y agotar nuestra cuota de 800 req/día.
const ALLOWED_SYMBOLS = new Set([
  'BRENT/USD',
  'WTI/USD',
  'XNG/USD',   // Gas Natural
]);

// Símbolos fijos para el modo spot — siempre los mismos tres.
const SPOT_SYMBOLS = ['BRENT/USD', 'WTI/USD', 'XNG/USD'];

// Intervalos válidos según la documentación de TwelveData.
// El frontend los mapea desde sus propias temporalidades (1H → 1h, etc.)
const ALLOWED_INTERVALS = new Set([
  '1min', '5min', '15min', '30min',
  '1h', '2h', '4h', '8h',
  '1day', '1week', '1month',
]);

// Timeout para la llamada a TwelveData (milisegundos).
// TwelveData responde en general en < 2s. 10s es conservador.
const TIMEOUT_MS = 10_000;

// ── HEADERS CORS ─────────────────────────────────────────────
// Aplicados a todas las respuestas de esta función.
// En producción, reemplazá '*' por tu dominio:
//   'https://terminal-petroleo.netlify.app'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// ── HELPER: respuesta de error uniforme ──────────────────────
function errorResponse(statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[prices.js] ERROR ${statusCode}: ${message}`, details || '');
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

// ── HELPER: respuesta exitosa ─────────────────────────────────
function okResponse(data) {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────
exports.handler = async (event) => {

  // Preflight CORS — el navegador envía OPTIONS antes de GET
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Solo aceptamos GET
  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Método no permitido. Usá GET.');
  }

  // ── VERIFICAR KEY ───────────────────────────────────────────
  const API_KEY = process.env.TWELVE_DATA_API_KEY;
  if (!API_KEY) {
    // Esto no debería pasar en producción si configuraste Netlify correctamente.
    // En local: asegurate de tener TWELVE_DATA_API_KEY en tu archivo .env
    return errorResponse(503, 'API key de TwelveData no configurada en el servidor.');
  }

  // ── LEER PARÁMETROS ─────────────────────────────────────────
  const params = event.queryStringParameters || {};
  const mode   = params.mode || 'spot'; // 'spot' | 'candles'

  // Log de la request para monitoreo (visible en Netlify → Functions → Logs)
  console.log(`[prices.js] mode=${mode}`, mode === 'candles'
    ? `symbol=${params.symbol} interval=${params.interval} outputsize=${params.outputsize}`
    : 'symbols=BRENT/USD,WTI/USD,XNG/USD'
  );

  // ── MODO SPOT ────────────────────────────────────────────────
  if (mode === 'spot') {
    return await handleSpot(API_KEY);
  }

  // ── MODO CANDLES ─────────────────────────────────────────────
  if (mode === 'candles') {
    return await handleCandles(API_KEY, params);
  }

  return errorResponse(400, `Modo inválido: "${mode}". Usá "spot" o "candles".`);
};

// ══════════════════════════════════════════════════════════════
// MODO SPOT — Precios actuales de los tres commodities
// Endpoint TwelveData: GET /price?symbol=A,B,C&apikey=KEY
// ══════════════════════════════════════════════════════════════
async function handleSpot(apiKey) {
  const url = new URL('https://api.twelvedata.com/price');
  url.searchParams.set('symbol',  SPOT_SYMBOLS.join(','));
  url.searchParams.set('apikey',  apiKey);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    // TwelveData puede devolver 429 cuando se agota el rate limit por minuto
    if (response.status === 429) {
      return errorResponse(429, 'Rate limit de TwelveData alcanzado (8 req/min en plan gratuito). Reintentá en 60 segundos.');
    }

    if (!response.ok) {
      return errorResponse(502, `TwelveData respondió con status ${response.status}.`);
    }

    const data = await response.json();

    // TwelveData a veces devuelve un objeto de error con status 200
    // Ejemplo: { "code": 400, "message": "Invalid API key", "status": "error" }
    if (data.status === 'error' || data.code) {
      return errorResponse(502, 'TwelveData devolvió un error.', {
        code:    data.code,
        message: data.message,
      });
    }

    // Validar que al menos un símbolo tenga precio
    // (si todos fallaron, algo está muy mal)
    const hasAnyPrice = SPOT_SYMBOLS.some(sym => data[sym]?.price);
    if (!hasAnyPrice) {
      return errorResponse(502, 'TwelveData no devolvió precios válidos.', data);
    }

    console.log('[prices.js] Spot prices OK:', {
      BRENT: data['BRENT/USD']?.price,
      WTI:   data['WTI/USD']?.price,
      XNG:   data['XNG/USD']?.price,
    });

    return okResponse(data);

  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      return errorResponse(504, `TwelveData no respondió en ${TIMEOUT_MS / 1000} segundos (timeout).`);
    }

    return errorResponse(502, 'Error de red al conectar con TwelveData.', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// MODO CANDLES — Serie histórica OHLCV para velas japonesas
// Endpoint TwelveData: GET /time_series?symbol=X&interval=Y&outputsize=Z&apikey=KEY
// ══════════════════════════════════════════════════════════════
async function handleCandles(apiKey, params) {

  // ── Validar symbol ────────────────────────────────────────
  const symbol = params.symbol;
  if (!symbol) {
    return errorResponse(400, 'Parámetro requerido: symbol (ej: BRENT/USD)');
  }
  // Decodificamos por si viene URL-encoded como BRENT%2FUSD
  const decodedSymbol = decodeURIComponent(symbol);
  if (!ALLOWED_SYMBOLS.has(decodedSymbol)) {
    return errorResponse(400,
      `Símbolo no permitido: "${decodedSymbol}". ` +
      `Valores válidos: ${[...ALLOWED_SYMBOLS].join(', ')}`
    );
  }

  // ── Validar interval ─────────────────────────────────────
  const interval = params.interval || '1day';
  if (!ALLOWED_INTERVALS.has(interval)) {
    return errorResponse(400,
      `Intervalo no válido: "${interval}". ` +
      `Valores válidos: ${[...ALLOWED_INTERVALS].join(', ')}`
    );
  }

  // ── Validar outputsize ───────────────────────────────────
  // El frontend siempre pide 150. Limitamos a 500 (máximo de TwelveData
  // en el plan gratuito para time_series).
  const rawSize    = parseInt(params.outputsize, 10);
  const outputsize = isNaN(rawSize) ? 150 : Math.min(Math.max(rawSize, 1), 500);

  // ── Construir URL ────────────────────────────────────────
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
      return errorResponse(429, 'Rate limit de TwelveData alcanzado. Reintentá en 60 segundos.');
    }

    if (!response.ok) {
      return errorResponse(502, `TwelveData respondió con status ${response.status}.`);
    }

    const data = await response.json();

    // Error embebido en respuesta 200
    if (data.status === 'error' || data.code) {
      return errorResponse(502, 'TwelveData devolvió un error en time_series.', {
        code:    data.code,
        message: data.message,
      });
    }

    // Verificar que haya valores
    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return errorResponse(502,
        'TwelveData no devolvió valores OHLCV. ' +
        'El símbolo o intervalo puede no estar disponible en el plan gratuito.',
        { symbol: decodedSymbol, interval, meta: data.meta }
      );
    }

    console.log(`[prices.js] Candles OK: ${data.values.length} barras ${decodedSymbol} ${interval}`);

    // Devolvemos la respuesta tal cual viene de TwelveData.
    // El frontend espera exactamente este formato:
    // { values: [ { datetime, open, high, low, close, volume }, ... ] }
    return okResponse(data);

  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      return errorResponse(504, `TwelveData time_series no respondió en ${TIMEOUT_MS / 1000} segundos.`);
    }

    return errorResponse(502, 'Error de red al conectar con TwelveData.', err.message);
  }
}
