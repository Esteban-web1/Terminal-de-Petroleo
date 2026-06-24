// ══════════════════════════════════════════════════════════════
// api/forward-curve.js (Vercel Serverless Function)
// BUG 5 fix — la curva ya no usa regularMarketPrice (fluctúa intradía,
// por eso "cambiaba al refrescar la página"). Ahora usa el CLOSE de la
// última vela DIARIA ya cerrada — mismo valor durante todo el día,
// determinístico.
//
// Tickers con vencimiento real de Yahoo Finance (verificado contra
// páginas reales: finance.yahoo.com/quote/CLZ26.NYM/, BZM26.NYM/):
//   WTI:   CL + código de mes + año (2 dígitos) + ".NYM"
//   Brent: BZ + código de mes + año (2 dígitos) + ".NYM"
// Código de mes (estándar CME, NO inventado):
//   F=Ene G=Feb H=Mar J=Abr K=May M=Jun N=Jul Q=Ago U=Sep V=Oct X=Nov Z=Dic
//
// Para Brent, además del ticker real se calcula una etiqueta estilo
// ICE ("CO1, CO2...") porque así se conoce comercialmente la curva de
// Brent — pero el dato sigue viniendo 100% de Yahoo, la etiqueta es
// solo un nombre más familiar.
//
// Open interest: Yahoo NO lo provee en este endpoint no-oficial de
// chart — se devuelve null explícito, no se inventa.
//
// GET /api/forward-curve?underlying=wti&count=12
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;
const SPOT_TICKER = { wti: 'CL=F', brent: 'BZ=F' };
const PREFIX = { wti: 'CL', brent: 'BZ' };
const FRIENDLY_PREFIX = { wti: 'M', brent: 'CO' }; // BUG5: Brent usa "CO1,CO2..." (convención ICE)
const MAX_COUNT = 24; // ver nota en README: 36 meses no tiene liquidez/listado real confiable
const MONTH_CODES = ['F','G','H','J','K','M','N','Q','U','V','X','Z'];
const MONTH_NAMES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json',
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[forward-curve.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  // BUG 5 fix: 5 minutos de caché — la curva de cierre diario no tiene
  // sentido revalidarla cada minuto.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(data);
}

// BUG 5 fix: trae el CLOSE de la última vela DIARIA ya cerrada, no el
// precio intradía en vivo — esto es lo que garantiza que la curva no
// cambie cada vez que se refresca la página dentro del mismo día.
async function fetchLastCloseAndVolume(ticker) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('range', '5d');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal, headers: YF_HEADERS });
    clearTimeout(timer);
    if (!response.ok) return { ok: false, error: `status ${response.status}` };
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const ts = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!Array.isArray(ts) || !quote?.close) return { ok: false, error: 'sin serie diaria válida' };

    for (let i = ts.length - 1; i >= 0; i--) {
      if (typeof quote.close[i] === 'number') {
        return {
          ok: true,
          close: quote.close[i],
          volume: typeof quote.volume?.[i] === 'number' ? quote.volume[i] : null,
          closeDate: new Date(ts[i] * 1000).toISOString().slice(0, 10),
          closeTimestamp: ts[i],
        };
      }
    }
    return { ok: false, error: 'todas las barras recientes vienen sin close' };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}

function generateContracts(underlying, count) {
  const prefix = PREFIX[underlying];
  const friendly = FRIENDLY_PREFIX[underlying];
  const now = new Date();
  const contracts = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() + i, 1);
    const code = MONTH_CODES[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    contracts.push({
      ticker: `${prefix}${code}${yy}.NYM`,
      label: `${friendly}${i}`,
      month: `${MONTH_NAMES_ES[d.getMonth()]}-${yy}`,
    });
  }
  return contracts;
}

function marketFreshness(closeTimestamp) {
  const now = new Date();
  const closeDate = new Date(closeTimestamp * 1000);
  const dayUTC = now.getUTCDay();
  const hourUTC = now.getUTCHours();
  const hourET = (hourUTC - 4 + 24) % 24; // aproximación ET, alcanza para este badge
  const isWeekendGap = (dayUTC === 6) || (dayUTC === 0 && hourET < 18) || (dayUTC === 5 && hourET >= 17);
  return {
    isOpen: !isWeekendGap,
    lastCloseDate: closeDate.toISOString().slice(0, 10),
    asOf: now.toISOString(),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  const params = req.query || {};

  // BUG 5 (brent-spread-monitor): historial diario real de uno o más
  // contratos puntuales (CLN26.NYM, BZQ26.NYM, etc.) — esto es lo que
  // permite armar curvas "hace 1/2/3/6 meses" y el histórico del
  // spread entre dos contratos SIN inventar nada: es el precio real
  // de ESE ticker puntual en esas fechas, no una reconstrucción de
  // "qué contrato era front month" (eso sí sería inventado).
  if (params.mode === 'history') {
    return await handleHistory(res, params);
  }

  const underlying = (params.underlying || 'wti').toLowerCase();
  if (!SPOT_TICKER[underlying]) {
    return sendError(res, 400, `underlying inválido: "${underlying}". Usá "wti" o "brent".`);
  }
  const rawCount = parseInt(params.count, 10);
  const count = isNaN(rawCount) ? 12 : Math.min(Math.max(rawCount, 3), MAX_COUNT);

  console.log(`[forward-curve.js] underlying=${underlying} count=${count}`);

  const contracts = generateContracts(underlying, count);

  const [spotResult, ...contractResults] = await Promise.all([
    fetchLastCloseAndVolume(SPOT_TICKER[underlying]),
    ...contracts.map(c => fetchLastCloseAndVolume(c.ticker)),
  ]);

  if (!spotResult.ok) {
    return sendError(res, 502, `No se pudo obtener el spot de ${underlying.toUpperCase()}: ${spotResult.error}`);
  }

  const curve = [];
  const failures = [];
  contracts.forEach((c, i) => {
    const r = contractResults[i];
    if (!r.ok) { failures.push(`${c.ticker}: ${r.error}`); return; }
    curve.push({
      ...c,
      price: +r.close.toFixed(2),
      volume: r.volume,
      openInterest: null,
      closeDate: r.closeDate,
    });
  });

  if (curve.length < 3) {
    return sendError(res, 502,
      `Yahoo no devolvió suficientes contratos de ${underlying.toUpperCase()} (mínimo 3, llegaron ${curve.length}).`,
      failures
    );
  }

  const first = curve[0].price, last = curve[curve.length - 1].price;
  const diffPct = +(((last - first) / first) * 100).toFixed(2);
  const shape = diffPct > 0.15 ? 'CONTANGO' : diffPct < -0.15 ? 'BACKWARDATION' : 'FLAT';

  const byLabel = {};
  curve.forEach(c => { byLabel[c.label] = c.price; });
  const friendly = FRIENDLY_PREFIX[underlying];
  const m1 = byLabel[`${friendly}1`] ?? null;
  const spread = (label) => (m1 !== null && byLabel[label] !== undefined) ? +(m1 - byLabel[label]).toFixed(2) : null;
  const spreads = {
    m1m2: spread(`${friendly}2`),
    m1m3: spread(`${friendly}3`),
    m1m6: spread(`${friendly}6`),
    m1m12: spread(`${friendly}12`),
  };

  let rollYieldPct = null;
  if (m1 !== null && byLabel[`${friendly}2`] !== undefined) {
    rollYieldPct = +(((m1 - byLabel[`${friendly}2`]) / byLabel[`${friendly}2`]) * 100 * 12).toFixed(2);
  }

  const out = {
    underlying,
    spot: +spotResult.close.toFixed(2),
    spotVolume: spotResult.volume,
    curve,
    shape,
    diffPct,
    spreads,
    rollYieldPct,
    freshness: marketFreshness(spotResult.closeTimestamp),
  };
  if (failures.length > 0) out._warnings = failures;

  console.log(`[forward-curve.js] OK ${underlying}: ${curve.length} contratos, forma=${shape} (${diffPct}%), cierre=${spotResult.closeDate}`);
  return sendOk(res, out);
}

// ══════════════════════════════════════════════════════════════
// MODE HISTORY — historial diario real de tickers puntuales
// GET /api/forward-curve?mode=history&tickers=CLN26.NYM,CLQ26.NYM&range=6mo
// → { history: { "CLN26.NYM": [{date,close}], ... }, _warnings? }
// ══════════════════════════════════════════════════════════════
const ALLOWED_HISTORY_RANGES = new Set(['1mo', '2mo', '3mo', '6mo', '1y', '2y', 'max']);

async function fetchTickerHistory(ticker, range) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('range', range);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal, headers: YF_HEADERS });
    clearTimeout(timer);
    if (!response.ok) return { ok: false, error: `status ${response.status}` };
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const ts = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(ts) || !Array.isArray(closes)) return { ok: false, error: 'sin serie diaria válida' };
    const series = [];
    for (let i = 0; i < ts.length; i++) {
      if (typeof closes[i] === 'number') {
        series.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: +closes[i].toFixed(2) });
      }
    }
    return { ok: true, series };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}

async function handleHistory(res, params) {
  const tickersRaw = params.tickers;
  if (!tickersRaw) return sendError(res, 400, 'Falta el parámetro "tickers" (separados por coma).');
  const tickers = tickersRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 14); // tope razonable por request

  const range = ALLOWED_HISTORY_RANGES.has(params.range) ? params.range : '6mo';

  console.log(`[forward-curve.js] mode=history tickers=${tickers.length} range=${range}`);

  const results = await Promise.all(tickers.map(t => fetchTickerHistory(t, range)));

  const history = {};
  const failures = [];
  tickers.forEach((t, i) => {
    const r = results[i];
    if (!r.ok) { failures.push(`${t}: ${r.error}`); return; }
    history[t] = r.series;
  });

  if (Object.keys(history).length === 0) {
    return sendError(res, 502, 'Ningún ticker devolvió historial real.', failures);
  }

  const out = { history };
  if (failures.length > 0) out._warnings = failures;

  // Cache de 1h — historial diario no necesita revalidarse más seguido
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');
  return res.status(200).json(out);
}
