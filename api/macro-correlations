// ══════════════════════════════════════════════════════════════
// api/macro-correlations.js (Vercel Serverless Function)
// CAMBIO 2.2 — Correlación rolling 30 días de Brent vs activos macro.
// Todo real: se traen velas diarias reales de Yahoo Finance para Brent
// y cada activo, se alinean por fecha, y se calcula el coeficiente de
// correlación de Pearson sobre los retornos diarios (no sobre el precio
// nominal — correlacionar precios nominales con tendencias distintas da
// resultados engañosos; la convención estándar es correlacionar retornos).
//
// GET /api/macro-correlations
// → { pairs: [ { name, ticker, corr, n } ], asOf }
//
// No requiere API key (mismo endpoint no-oficial que prices-yahoo.js).
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;
const BRENT_TICKER = 'BZ=F';
const MACRO_ASSETS = [
  { name: 'DXY (Dollar Index)', ticker: 'DX-Y.NYB' },
  { name: 'Oro (Gold)',         ticker: 'GC=F' },
  { name: 'Cobre (Copper)',     ticker: 'HG=F' },
  { name: 'Bono 10Y (UST)',     ticker: '^TNX' },
  { name: 'S&P 500',            ticker: '^GSPC' },
  { name: 'VIX (Volatilidad)',  ticker: '^VIX' },
];

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
  console.error(`[macro-correlations.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  // 30 min de caché de borde — esto no necesita ser más fresco que eso
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
  return res.status(200).json(data);
}

async function fetchDailyCloses(ticker) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('range', '2mo'); // de sobra para tener 30 ruedas hábiles reales
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
    if (!Array.isArray(ts) || !Array.isArray(closes)) return { ok: false, error: 'sin serie de tiempo válida' };
    const series = [];
    for (let i = 0; i < ts.length; i++) {
      if (typeof closes[i] === 'number') series.push({ t: ts[i], c: closes[i] });
    }
    return { ok: true, series };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}

// Retornos diarios simples (% cambio día a día) — es lo que se correlaciona,
// no el precio nominal.
function toReturns(series) {
  const byTime = new Map(series.map(p => [p.t, p.c]));
  return byTime;
}

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 10) return null; // muy pocos puntos en común para que tenga sentido
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY;
    num += dx * dy; denX += dx * dx; denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  console.log('[macro-correlations.js] calculando correlaciones reales 30d vs Brent');

  const [brentResult, ...assetResults] = await Promise.all([
    fetchDailyCloses(BRENT_TICKER),
    ...MACRO_ASSETS.map(a => fetchDailyCloses(a.ticker)),
  ]);

  if (!brentResult.ok) {
    return sendError(res, 502, `No se pudo obtener Brent: ${brentResult.error}`);
  }

  // Brent: timestamp → close, y retornos diarios alineados por timestamp
  const brentSeries = brentResult.series.slice(-31); // últimas ~31 ruedas → 30 retornos
  const brentByTime = toReturns(brentSeries);
  const brentTimes = brentSeries.map(p => p.t).sort((a, b) => a - b);

  const pairs = [];
  const failures = [];

  MACRO_ASSETS.forEach((asset, i) => {
    const r = assetResults[i];
    if (!r.ok) { failures.push(`${asset.ticker}: ${r.error}`); return; }
    const assetByTime = toReturns(r.series);

    // Construir series de retornos diarios alineadas — solo fechas en común
    const commonTimes = brentTimes.filter(t => assetByTime.has(t));
    if (commonTimes.length < 11) { failures.push(`${asset.ticker}: muy pocas fechas en común (${commonTimes.length})`); return; }

    const brentReturns = [], assetReturns = [];
    for (let i = 1; i < commonTimes.length; i++) {
      const t0 = commonTimes[i - 1], t1 = commonTimes[i];
      const b0 = brentByTime.get(t0), b1 = brentByTime.get(t1);
      const a0 = assetByTime.get(t0), a1 = assetByTime.get(t1);
      if (b0 && b1 && a0 && a1) {
        brentReturns.push((b1 - b0) / b0);
        assetReturns.push((a1 - a0) / a0);
      }
    }

    const corr = pearsonCorrelation(brentReturns, assetReturns);
    if (corr === null) { failures.push(`${asset.ticker}: muy pocos retornos válidos para correlacionar`); return; }

    // % cambio del día más reciente — se reusa la misma serie ya traída,
    // no se pide de nuevo (evita una llamada extra a Yahoo).
    const lastTwo = r.series.slice(-2);
    const changePct = lastTwo.length === 2 ? +(((lastTwo[1].c - lastTwo[0].c) / lastTwo[0].c) * 100).toFixed(2) : null;

    pairs.push({ name: asset.name, ticker: asset.ticker, corr: +corr.toFixed(2), n: brentReturns.length, changePct });
  });

  if (pairs.length === 0) {
    return sendError(res, 502, 'No se pudo calcular ninguna correlación real.', failures);
  }

  const out = { pairs, asOf: new Date().toISOString() };
  if (failures.length > 0) out._warnings = failures;

  console.log(`[macro-correlations.js] OK: ${pairs.length}/${MACRO_ASSETS.length} correlaciones reales calculadas`);
  return sendOk(res, out);
}
