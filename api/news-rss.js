// ══════════════════════════════════════════════════════════════
// api/news-rss.js (Vercel Serverless Function)
// BUG 2 — Agregador RSS multi-fuente, sin key.
//
// IMPORTANTE sobre Reuters: sus feeds RSS directos (feeds.reuters.com)
// están MUERTOS desde junio de 2020 — devuelven 404 o redirect (esto
// es ampliamente documentado, no es un bug de este código). Por eso
// Reuters, Bloomberg y FT se traen vía el WORKAROUND de Google News
// (news.google.com/rss/search?q=site:dominio.com+...) — es gratis,
// público, y es la forma estándar que usa la comunidad desde que
// Reuters mató sus feeds.
//
// Feeds incluidos y su confiabilidad real:
//   ✅ OilPrice.com           — verificado, feed propio funcionando
//   ✅ EIA Today in Energy    — verificado, oficial gobierno EE.UU.
//   ✅ Reuters (vía Google News)   — workaround verificado, funciona
//   ✅ Bloomberg (vía Google News) — workaround verificado, funciona
//   ✅ Financial Times (vía Google News) — workaround verificado
//   ⚠️  OPEC press releases   — URL no verificable sin acceso de
//       prueba en vivo; si falla, no rompe nada (Promise.allSettled),
//       simplemente no aporta artículos.
//   ⚠️  IEA News               — mismo caso, no verificado con certeza.
//   ⚠️  Rigzone                — mismo caso, no verificado con certeza.
//   ❌ S&P Global Commodity Insights — NO incluido: es contenido
//       mayormente paywalled, no encontré un RSS público real.
//   ❌ Argus Media — NO incluido: es un servicio de pago, no tiene
//       RSS público.
//
// GET /api/news-rss
// → { articles:[{title,description,url,publishedAt,source,image}], ... }
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 6_000; // BUG2: 6s por feed, ninguno puede colgar a los demás
const FEEDS = [
  { url: 'https://oilprice.com/rss/main', name: 'OilPrice.com', confidence: 'alta' },
  { url: 'https://www.eia.gov/rss/todayinenergy.xml', name: 'EIA Today in Energy', confidence: 'alta' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+(oil+OR+crude+OR+OPEC+OR+brent+OR+wti)+when:2d&hl=en-US&gl=US&ceid=US:en', name: 'Reuters', confidence: 'alta (vía Google News)' },
  { url: 'https://news.google.com/rss/search?q=site:bloomberg.com+(oil+OR+crude+OR+OPEC)+when:2d&hl=en-US&gl=US&ceid=US:en', name: 'Bloomberg', confidence: 'alta (vía Google News)' },
  { url: 'https://news.google.com/rss/search?q=site:ft.com+(oil+OR+crude+OR+OPEC)+when:3d&hl=en-US&gl=US&ceid=US:en', name: 'Financial Times', confidence: 'alta (vía Google News)' },
  { url: 'https://www.opec.org/opec_web/static_files_project/media/downloads/press_room/feed.xml', name: 'OPEC', confidence: 'no verificado' },
  { url: 'https://www.iea.org/news/feed', name: 'IEA', confidence: 'no verificado' },
  { url: 'https://www.rigzone.com/news/rss/', name: 'Rigzone', confidence: 'no verificado' },
];

// BUG2: keywords para filtrar — sobre todo importa para los feeds de
// Google News (Reuters/Bloomberg/FT), que pueden traer ruido no-petróleo
// aunque el query ya filtre por site: + términos.
const OIL_KEYWORDS = ['oil','crude','opec','brent','wti','petroleum','refining','refinery','natural gas','opec+','hormuz','shale','gasoline','diesel','fuel','petróleo','crudo','gasolina','combustible'];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[news-rss.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  // BUG2: 3 minutos de caché de borde
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  return res.status(200).json(data);
}

function cleanXmlText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? cleanXmlText(m[1]) : '';
}

// BUG2: extracción de imagen — 3 estrategias en orden, la primera que
// encuentre algo gana. Si ninguna funciona, image:null (el frontend
// muestra un placeholder con la inicial de la fuente, no se inventa nada).
function extractImage(block) {
  let m = block.match(/<media:content[^>]*url=["']([^"']+)["']/i);
  if (m) return m[1];
  m = block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
  if (m) return m[1];
  m = block.match(/<description[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i);
  if (m) return m[1];
  return null;
}

function matchesOilKeywords(title, description) {
  const t = (title + ' ' + description).toLowerCase();
  return OIL_KEYWORDS.some(k => t.includes(k));
}

function parseRssItems(xml, sourceName, maxItems = 15) {
  const items = [];
  const itemBlocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const block of itemBlocks.slice(0, maxItems)) {
    const title = extractTag(block, 'title');
    const description = extractTag(block, 'description');
    const link = extractTag(block, 'link');
    const pubDateRaw = extractTag(block, 'pubDate');
    const image = extractImage(block);

    if (!title) continue;
    // BUG2: filtro de keywords — los feeds genéricos (Google News) pueden
    // traer ruido; OilPrice/EIA ya son 100% petróleo así que esto no les
    // hace nada, pero a Reuters/Bloomberg/FT sí les filtra lo no-relevante.
    if (!matchesOilKeywords(title, description)) continue;

    let publishedAt = new Date().toISOString();
    if (pubDateRaw) {
      const parsed = new Date(pubDateRaw);
      if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
    }

    items.push({
      title,
      description: description.length > 280 ? description.slice(0, 277) + '...' : description,
      url: link || '',
      publishedAt,
      source: { name: sourceName },
      image,
    });
  }
  return items;
}

async function fetchOneFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TerminalPetroleo/1.0)' },
    });
    clearTimeout(timer);
    if (!response.ok) return { ok: false, name: feed.name, error: `status ${response.status}` };
    const xml = await response.text();
    const items = parseRssItems(xml, feed.name);
    return { ok: true, name: feed.name, items };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, name: feed.name, error: err.name === 'AbortError' ? 'timeout 6s' : err.message };
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  // BUG2: Promise.allSettled — un feed lento o caído (ej. OPEC/IEA/Rigzone
  // sin verificar) NUNCA puede tirar abajo a los demás.
  const settled = await Promise.allSettled(FEEDS.map(f => fetchOneFeed(f)));
  const results = settled.map(s => s.status === 'fulfilled' ? s.value : { ok: false, name: '?', error: s.reason?.message || 'rejected' });

  const failures = results.filter(r => !r.ok);
  const articles = results
    .filter(r => r.ok)
    .flatMap(r => r.items)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  if (articles.length === 0) {
    return sendError(res, 502, 'Ningún feed RSS devolvió artículos parseables.', failures);
  }

  console.log(`[news-rss.js] OK: ${articles.length} artículos (${results.filter(r => r.ok).map(r => r.name).join(', ')})`);
  if (failures.length > 0) {
    console.warn('[news-rss.js] Feeds que fallaron (no rompen la respuesta):', failures.map(f => `${f.name}: ${f.error}`).join(' | '));
  }

  return sendOk(res, {
    articles,
    _fuente: `RSS multi-fuente (${results.filter(r => r.ok).map(r => r.name).join(', ')})`,
    _warnings: failures.length ? failures.map(f => `${f.name}: ${f.error}`) : undefined,
  });
}
