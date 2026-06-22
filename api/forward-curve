// ══════════════════════════════════════════════════════════════
// api/forward-curve.js (Vercel Serverless Function)
// CAMBIO 1.4 — Curva de futuros real (contango/backwardation).
//
// Usa los tickers de contrato con vencimiento real de Yahoo Finance.
// Formato CME/ICE estándar verificado contra páginas reales existentes
// hoy (finance.yahoo.com/quote/CLZ26.NYM/, BZM26.NYM/, etc.):
//   WTI:   CL + código de mes + año (2 dígitos) + ".NYM"
//   Brent: BZ + código de mes + año (2 dígitos) + ".NYM"
// Código de mes (estándar de futuros, NO inventado):
//   F=Ene G=Feb H=Mar J=Abr K=May M=Jun N=Jul Q=Ago U=Sep V=Oct X=Nov Z=Dic
//
// GET /api/forward-curve?underlying=wti&count=12
// → { spot, curve:[{label,month,ticker,price}], shape, diffPct,
//     spreads:{m1m2,m1m3,m1m6,m1m12}, rollYieldPct }
//
// No requiere API key (mismo endpoint no-oficial que prices-yahoo.js).
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;
const SPOT_TICKER = { wti: 'CL=F', brent: 'BZ=F' };
const PREFIX = { wti: 'CL', brent: 'BZ' };
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
  // CACHE: la curva de futuros no cambia segundo a segundo — 60s de caché
  // de borde reduce drásticamente las ~13 llamadas a Yahoo por refresh.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  return res.status(200).json(data);
}

async function fetchYahooQuote(ticker) {
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
    const price = result?.meta?.regularMarketPrice;
    if (typeof price !== 'number') return { ok: false, error: 'sin precio válido' };
    return { ok: true, price };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}

function generateContracts(underlying, count) {
  const prefix = PREFIX[underlying];
  const now = new Date();
  const contracts = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() + i, 1);
    const code = MONTH_CODES[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    contracts.push({
      ticker: `${prefix}${code}${yy}.NYM`,
      label: `M${i}`,
      month: `${MONTH_NAMES_ES[d.getMonth()]}-${yy}`,
    });
  }
  return contracts;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  const params = req.query || {};
  const underlying = (params.underlying || 'wti').toLowerCase();
  if (!SPOT_TICKER[underlying]) {
    return sendError(res, 400, `underlying inválido: "${underlying}". Usá "wti" o "brent".`);
  }
  const rawCount = parseInt(params.count, 10);
  const count = isNaN(rawCount) ? 12 : Math.min(Math.max(rawCount, 3), 12);

  console.log(`[forward-curve.js] underlying=${underlying} count=${count}`);

  const contracts = generateContracts(underlying, count);

  const [spotResult, ...contractResults] = await Promise.all([
    fetchYahooQuote(SPOT_TICKER[underlying]),
    ...contracts.map(c => fetchYahooQuote(c.ticker)),
  ]);

  if (!spotResult.ok) {
    return sendError(res, 502, `No se pudo obtener el spot de ${underlying.toUpperCase()}: ${spotResult.error}`);
  }

  const curve = [];
  const failures = [];
  contracts.forEach((c, i) => {
    const r = contractResults[i];
    if (!r.ok) { failures.push(`${c.ticker}: ${r.error}`); return; }
    curve.push({ ...c, price: +r.price.toFixed(2) });
  });

  if (curve.length < 3) {
    return sendError(res, 502,
      `Yahoo no devolvió suficientes contratos de ${underlying.toUpperCase()} (mínimo 3, llegaron ${curve.length}). ` +
      `Puede que algunos contratos lejanos todavía no listen en Yahoo.`,
      failures
    );
  }

  // Forma de la curva: comparando el primer y último contrato disponible
  const first = curve[0].price, last = curve[curve.length - 1].price;
  const diffPct = +(((last - first) / first) * 100).toFixed(2);
  const shape = diffPct > 0.15 ? 'CONTANGO' : diffPct < -0.15 ? 'BACKWARDATION' : 'FLAT';

  // Time spreads M1-M2 / M1-M3 / M1-M6 / M1-M12 — solo si ese contrato cargó real
  const byLabel = {};
  curve.forEach(c => { byLabel[c.label] = c.price; });
  const m1 = byLabel['M1'] ?? null;
  const spread = (label) => (m1 !== null && byLabel[label] !== undefined) ? +(m1 - byLabel[label]).toFixed(2) : null;
  const spreads = {
    m1m2: spread('M2'),
    m1m3: spread('M3'),
    m1m6: spread('M6'),
    m1m12: spread('M12'),
  };

  // Roll yield aproximado: % de diferencia entre M1 y M2 anualizado simple
  let rollYieldPct = null;
  if (m1 !== null && byLabel['M2'] !== undefined) {
    rollYieldPct = +(((m1 - byLabel['M2']) / byLabel['M2']) * 100 * 12).toFixed(2); // anualizado simple (1 mes → x12)
  }

  const out = {
    underlying,
    spot: +spotResult.price.toFixed(2),
    curve,
    shape,
    diffPct,
    spreads,
    rollYieldPct,
  };
  if (failures.length > 0) out._warnings = failures;

  console.log(`[forward-curve.js] OK ${underlying}: ${curve.length} contratos, forma=${shape} (${diffPct}%)`);
  return sendOk(res, out);
}
