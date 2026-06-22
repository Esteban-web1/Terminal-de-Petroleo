// ══════════════════════════════════════════════════════════════
// api/prices-yahoo.js (Vercel Serverless Function)
// Proxy para Yahoo Finance (endpoint no oficial) — reemplaza a TwelveData,
// cuyo plan gratuito dejó de incluir commodities.
//
// MODO SPOT:
//   GET /api/prices-yahoo?mode=spot
//   → { brent:{price,change}, wti:{...}, ng:{...}, heatoil:{...}, rbob:{...} }
//
// MODO CANDLES:
//   GET /api/prices-yahoo?mode=candles&symbol=brent&interval=1d&range=3mo
//   → { values: [ { datetime, open, high, low, close, volume }, ... ] }
//
// No requiere API key. Yahoo puede bloquear requests sin User-Agent
// de navegador real, por eso se envía uno explícito.
// ══════════════════════════════════════════════════════════════

// Mapeo símbolo interno → ticker real de Yahoo Finance (futuros continuos)
const SYMBOL_MAP = {
  brent:   'BZ=F',  // Brent Crude
  wti:     'CL=F',  // WTI Crude
  ng:      'NG=F',  // Natural Gas Henry Hub
  heatoil: 'HO=F',  // Heating Oil
  rbob:    'RB=F',  // RBOB Gasoline
};

const SPOT_KEYS = Object.keys(SYMBOL_MAP); // ['brent','wti','ng','heatoil','rbob']

const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo']);
const ALLOWED_RANGES    = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y', 'max']);

const TIMEOUT_MS = 10_000;

const YF_HEADERS = {
  // Yahoo bloquea clientes sin User-Agent de navegador (devuelve 999/403)
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept':     'application/json',
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[prices-yahoo.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  return res.status(200).json(data);
}

// Convierte timestamp UNIX (segundos) a "YYYY-MM-DD HH:mm:ss"
function formatDatetime(unixSeconds) {
  const iso = new Date(unixSeconds * 1000).toISOString(); // "2026-06-17T14:30:00.000Z"
  return iso.slice(0, 19).replace('T', ' ');
}

// Llamada genérica a Yahoo Finance con timeout
async function fetchYahooChart(ticker, interval, range) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  url.searchParams.set('interval', interval);
  url.searchParams.set('range',    range);
  url.searchParams.set('includePrePost', 'false');

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal, headers: YF_HEADERS });
    clearTimeout(timer);
    if (!response.ok) {
      return { ok: false, status: response.status, error: `Yahoo respondió con status ${response.status}` };
    }
    const data = await response.json();
    if (data?.chart?.error) {
      return { ok: false, status: 502, error: data.chart.error.description || 'Yahoo devolvió un error.' };
    }
    const result = data?.chart?.result?.[0];
    if (!result) {
      return { ok: false, status: 502, error: 'Yahoo no devolvió datos para este ticker.' };
    }
    return { ok: true, result };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, status: 504, error: `Yahoo no respondió en ${TIMEOUT_MS / 1000}s (timeout).` };
    }
    return { ok: false, status: 502, error: `Error de red: ${err.message}` };
  }
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

  const params = req.query || {};
  const mode   = params.mode || 'spot';

  if (mode === 'spot') {
    return await handleSpot(res);
  }
  if (mode === 'candles') {
    return await handleCandles(res, params);
  }
  return sendError(res, 400, `Modo inválido: "${mode}". Usá "spot" o "candles".`);
}

// ══════════════════════════════════════════════════════════════
// MODO SPOT — 5 llamadas en paralelo, una por commodity
// ══════════════════════════════════════════════════════════════
async function handleSpot(res) {
  console.log('[prices-yahoo.js] mode=spot — consultando 5 commodities en paralelo');

  const results = await Promise.all(
    SPOT_KEYS.map(async (key) => {
      const r = await fetchYahooChart(SYMBOL_MAP[key], '1d', '5d');
      return { key, r };
    })
  );

  const out = {};
  const failures = [];

  for (const { key, r } of results) {
    if (!r.ok) {
      failures.push(`${key}: ${r.error}`);
      continue;
    }
    const meta = r.result.meta;
    const price = meta?.regularMarketPrice;
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;

    if (typeof price !== 'number') {
      failures.push(`${key}: sin regularMarketPrice en la respuesta`);
      continue;
    }

    const change = (typeof prevClose === 'number' && prevClose !== 0)
      ? +(((price - prevClose) / prevClose) * 100).toFixed(2)
      : 0;

    out[key] = { price: +price.toFixed(key === 'brent' || key === 'wti' ? 2 : 3), change };
  }

  // Si TODOS fallaron, es un error real (Yahoo caído, bloqueo, etc.)
  if (Object.keys(out).length === 0) {
    return sendError(res, 502, 'Yahoo Finance no devolvió ningún precio válido.', failures);
  }

  // Si fallaron algunos pero no todos, devolvemos los que sí funcionaron
  // junto con un aviso — mejor data parcial que nada.
  if (failures.length > 0) {
    console.warn('[prices-yahoo.js] Fallos parciales en spot:', failures);
    out._warnings = failures;
  }

  console.log('[prices-yahoo.js] Spot OK:', Object.keys(out).filter(k => k !== '_warnings'));
  return sendOk(res, out);
}

// ══════════════════════════════════════════════════════════════
// MODO CANDLES — serie OHLCV para un solo commodity
// ══════════════════════════════════════════════════════════════
async function handleCandles(res, params) {
  const symbol = params.symbol;
  if (!symbol || !SYMBOL_MAP[symbol]) {
    return sendError(res, 400,
      `Símbolo no permitido: "${symbol}". Valores válidos: ${SPOT_KEYS.join(', ')}`
    );
  }

  const interval = params.interval || '1d';
  if (!ALLOWED_INTERVALS.has(interval)) {
    return sendError(res, 400,
      `Intervalo no válido: "${interval}". Valores válidos: ${[...ALLOWED_INTERVALS].join(', ')}`
    );
  }

  const range = params.range || '3mo';
  if (!ALLOWED_RANGES.has(range)) {
    return sendError(res, 400,
      `Rango no válido: "${range}". Valores válidos: ${[...ALLOWED_RANGES].join(', ')}`
    );
  }

  console.log(`[prices-yahoo.js] mode=candles symbol=${symbol} interval=${interval} range=${range}`);

  const r = await fetchYahooChart(SYMBOL_MAP[symbol], interval, range);
  if (!r.ok) {
    return sendError(res, r.status || 502, `Yahoo Finance: ${r.error}`, { symbol, interval, range });
  }

  const { timestamp, indicators } = r.result;
  const quote = indicators?.quote?.[0];

  if (!Array.isArray(timestamp) || !quote) {
    return sendError(res, 502, 'Yahoo no devolvió series de tiempo válidas.', { symbol, interval, range });
  }

  // Yahoo a veces incluye barras con valores null (huecos de mercado cerrado).
  // Las filtramos para no romper el renderer de velas del frontend.
  const values = [];
  for (let i = 0; i < timestamp.length; i++) {
    const o = quote.open?.[i], h = quote.high?.[i], l = quote.low?.[i], c = quote.close?.[i], v = quote.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    values.push({
      datetime: formatDatetime(timestamp[i]),
      open:  o,
      high:  h,
      low:   l,
      close: c,
      volume: v ?? 0,
    });
  }

  if (values.length === 0) {
    return sendError(res, 502,
      'Yahoo devolvió la serie vacía (todas las barras sin datos válidos) para esta combinación de interval/range.',
      { symbol, interval, range }
    );
  }

  console.log(`[prices-yahoo.js] Candles OK: ${values.length} barras ${symbol} ${interval}/${range}`);

  return sendOk(res, { values });
}
