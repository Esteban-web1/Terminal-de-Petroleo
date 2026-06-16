// ══════════════════════════════════════════════════════════════
// netlify/functions/prices-alpha.js
// Proxy para Alpha Vantage API — histórico de largo plazo
//
// Endpoint:
//   GET /.netlify/functions/prices-alpha?function=BRENT&interval=monthly
//
// Parámetros que acepta el frontend:
//   function → BRENT | WTI | NATURAL_GAS
//   interval → monthly | weekly
//
// Alpha Vantage devuelve:
//   { "data": [ { "date": "2024-01-01", "value": "74.38" }, ... ] }
//
// Casos de uso en el frontend (gráfico de velas japonesas):
//   - Temporalidad 3M  → función=BRENT,  interval=monthly, slice=13 puntos
//   - Temporalidad 6M  → función=BRENT,  interval=monthly, slice=26 puntos
//   - Temporalidad 1Y  → función=BRENT,  interval=weekly,  slice=52 puntos
//   - Temporalidad 5Y  → función=BRENT,  interval=monthly, slice=60 puntos
//   (el slice lo hace el frontend; nosotros devolvemos todos los datos)
//
// Variables de entorno requeridas:
//   ALPHA_VANTAGE_API_KEY → cargada en Netlify → Environment variables
//
// ⚠️  PARTICULARIDAD DE ALPHA VANTAGE:
//   Esta API devuelve rate-limit y errores con HTTP 200 (no con 4xx/5xx).
//   Hay que inspeccionar el cuerpo JSON para detectarlos:
//   - Rate limit: { "Note": "Thank you for using Alpha Vantage..." }
//   - Key inválida: { "Information": "Invalid API key..." }
//   - Error genérico: { "Error Message": "..." }
//   Este proxy detecta esos tres casos y los convierte en respuestas
//   con el status HTTP correcto para que el frontend los maneje bien.
// ══════════════════════════════════════════════════════════════

// ── CONSTANTES DE VALIDACIÓN ─────────────────────────────────

// Las tres funciones de commodity que usa el frontend.
// Alpha Vantage tiene más (COPPER, WHEAT, etc.) pero no las necesitamos.
// Whitelist explícita para no exponer otras capacidades de la key.
const ALLOWED_FUNCTIONS = new Set([
  'BRENT',        // Brent Crude Oil — usado para asset='brent' y 'coil'
  'WTI',          // West Texas Intermediate — usado para asset='wti'
  'NATURAL_GAS',  // Gas Natural Henry Hub — usado para asset='ng'
]);

// Los únicos dos intervalos disponibles para commodities en Alpha Vantage.
// (El plan gratuito no ofrece intraday para commodities.)
const ALLOWED_INTERVALS = new Set(['monthly', 'weekly']);

// Timeout de 10 segundos.
// Alpha Vantage puede ser lenta (los servidores responden en 2-4s normalmente).
const TIMEOUT_MS = 10_000;

// ── HEADERS CORS ─────────────────────────────────────────────
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
  console.error(`[prices-alpha.js] ERROR ${statusCode}: ${message}`, details || '');
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

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'Método no permitido. Usá GET.');
  }

  // ── VERIFICAR KEY ───────────────────────────────────────────
  const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  if (!API_KEY) {
    return errorResponse(503, 'API key de Alpha Vantage no configurada en el servidor.');
  }

  // ── LEER Y VALIDAR PARÁMETROS ───────────────────────────────
  const params       = event.queryStringParameters || {};
  const avFunction   = params.function;   // nombre del parámetro 'function' en AV
  const interval     = params.interval || 'monthly';

  // Validar function
  if (!avFunction) {
    return errorResponse(400,
      'Parámetro requerido: function. ' +
      `Valores válidos: ${[...ALLOWED_FUNCTIONS].join(', ')}`
    );
  }
  if (!ALLOWED_FUNCTIONS.has(avFunction)) {
    return errorResponse(400,
      `Función no permitida: "${avFunction}". ` +
      `Valores válidos: ${[...ALLOWED_FUNCTIONS].join(', ')}`
    );
  }

  // Validar interval
  if (!ALLOWED_INTERVALS.has(interval)) {
    return errorResponse(400,
      `Intervalo no válido: "${interval}". ` +
      `Valores válidos: ${[...ALLOWED_INTERVALS].join(', ')}`
    );
  }

  // Log para monitoreo
  console.log(`[prices-alpha.js] function=${avFunction} interval=${interval}`);

  // ── CONSTRUIR URL ────────────────────────────────────────────
  // Alpha Vantage usa el parámetro "function" para elegir el dataset
  // y "interval" para la frecuencia temporal.
  // La key se llama "apikey" (distinto de otras APIs que usan "api_key" o "apiKey").
  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', avFunction);
  url.searchParams.set('interval', interval);
  url.searchParams.set('apikey',   API_KEY);

  // ── LLAMADA CON TIMEOUT ──────────────────────────────────────
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return errorResponse(502, `Alpha Vantage respondió con status HTTP ${response.status}.`);
    }

    const data = await response.json();

    // ── DETECCIÓN DE ERRORES EMBEBIDOS (el gran problema de AV) ──
    //
    // Alpha Vantage siempre devuelve HTTP 200, incluso cuando hay un error.
    // Hay que inspeccionar el JSON para saber si realmente funcionó.

    // CASO 1 — Rate limit (25 req/día en plan gratuito)
    // Mensaje exacto: "Thank you for using Alpha Vantage! Our standard API rate limit..."
    if (data['Note']) {
      console.warn('[prices-alpha.js] Rate limit detectado:', data['Note'].substring(0, 100));
      return errorResponse(429,
        'Límite diario de Alpha Vantage alcanzado (25 requests/día en plan gratuito). ' +
        'Se resetea a medianoche UTC.',
        { note: data['Note'] }
      );
    }

    // CASO 2 — API key inválida o problema de acceso
    // Mensaje: "The **demo** API key is for demo purposes only..."
    // o: "Invalid API call. Please retry or visit the documentation..."
    if (data['Information']) {
      console.warn('[prices-alpha.js] Información de AV:', data['Information'].substring(0, 100));
      return errorResponse(403,
        'Alpha Vantage rechazó la key o el acceso al endpoint. Verificá la API key.',
        { information: data['Information'] }
      );
    }

    // CASO 3 — Error de parámetros (función no válida, etc.)
    if (data['Error Message']) {
      return errorResponse(400,
        'Alpha Vantage reportó un error en los parámetros de la consulta.',
        { errorMessage: data['Error Message'] }
      );
    }

    // ── VERIFICAR QUE HAYA DATOS ─────────────────────────────
    // La respuesta válida de AV para commodities tiene la forma:
    // { "name": "Crude Oil Prices: Brent", "interval": "monthly",
    //   "unit": "dollars per barrel", "data": [ {...}, ... ] }
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return errorResponse(502,
        'Alpha Vantage no devolvió datos históricos. ' +
        'Puede que el endpoint no esté disponible en el plan gratuito actual.',
        { receivedKeys: Object.keys(data) }
      );
    }

    // Validar que al menos el primer punto tenga el formato esperado
    // { "date": "2024-01-01", "value": "74.38" }
    const sample = data.data[0];
    if (!sample.date || !sample.value) {
      return errorResponse(502,
        'El formato de los datos de Alpha Vantage no es el esperado.',
        { sample }
      );
    }

    console.log(
      `[prices-alpha.js] OK: ${data.data.length} puntos de ${avFunction} ` +
      `(${interval}). Rango: ${data.data[data.data.length - 1].date} → ${data.data[0].date}`
    );

    // Devolvemos la respuesta completa.
    // El frontend lee data.data y hace el slice según la temporalidad elegida.
    return okResponse(data);

  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      return errorResponse(504,
        `Alpha Vantage no respondió en ${TIMEOUT_MS / 1000} segundos (timeout). ` +
        'La API puede estar temporalmente lenta. Reintentá.'
      );
    }

    return errorResponse(502, 'Error de red al conectar con Alpha Vantage.', err.message);
  }
};
