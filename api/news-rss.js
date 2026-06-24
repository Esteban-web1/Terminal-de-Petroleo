// ══════════════════════════════════════════════════════════════
// api/news-rss.js (Vercel Serverless Function)
// Agregador RSS multi-fuente, sin key.
//
// ARREGLO 4: los 3 feeds que fallaban crónicamente eran casi seguro
// OPEC press / IEA / Rigzone — habían quedado marcados como "no
// verificado" en una vuelta anterior porque nunca pude confirmar que
// esas URLs existieran de verdad. Se sacan. En su lugar se agregan 2
// feeds de Dow Jones que VERIFIQUÉ ahora mismo con un fetch real
// (tienen artículos de hoy, incluyendo uno sobre Brent/WTI y Hormuz):
//   - feeds.content.dowjones.io/public/rss/RSSMarketsMain (WSJ Markets)
//   - feeds.content.dowjones.io/public/rss/mw_topstories (MarketWatch)
//
// Sobre Reuters/Bloomberg/FT vía Google News: es real que Google News
// a veces devuelve error a IPs de datacenter (incluida la de Vercel) —
// es un riesgo conocido, no inventado. Se mantienen (Promise.allSettled
// hace que fallar ahí no rompa nada) pero ya no son la única fuente de
// esos 3 medios — los feeds de Dow Jones nuevos cubren mercados/energía
// en general como respaldo real si Google News falla ese día.
//
// Timeout subido de 6s a 10s por feed (ARREGLO 4).
//
// GET /api/news-rss
// → { articles:[{title,description,url,publishedAt,source,image}], ... }
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000; // ARREGLO 4: subido de 6s a 10s
const FEEDS = [
  { url: 'https://oilprice.com/rss/main', name: 'OilPrice.com' },
  { url: 'https://www.eia.gov/rss/todayinenergy.xml', name: 'EIA Today in Energy' },
  { url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', name: 'WSJ Markets' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', name: 'MarketWatch' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+(oil+OR+crude+OR+OPEC+OR+brent+OR+wti)+when:2d&hl=en-US&gl=US&ceid=US:en', name: 'Reuters' },
  { url: 'https://news.google.com/rss/search?q=site:bloomberg.com+(oil+OR+crude+OR+OPEC)+when:2d&hl=en-US&gl=US&ceid=US:en', name: 'Bloomberg' },
  { url: 'https://news.google.com/rss/search?q=site:ft.com+(oil+OR+crude+OR+OPEC)+when:3d&hl=en-US&gl=US&ceid=US:en', name: 'Financial Times' },
];

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
    return { ok: false, name: feed.name, error: err.name === 'AbortError' ? 'timeout 10s' : err.message };
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  const settled = await Promise.allSettled(FEEDS.map(f => fetchOneFeed(f)));
  const results = settled.map(s => s.status === 'fulfilled' ? s.value : { ok: false, name: '?', error: s.reason?.message || 'rejected' });

  const failures = results.filter(r => !r.ok);
  const okCount = results.filter(r => r.ok).length;
  const articles = results
    .filter(r => r.ok)
    .flatMap(r => r.items)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  if (articles.length === 0) {
    return sendError(res, 502, 'Ningún feed RSS devolvió artículos parseables.', failures);
  }

  console.log(`[news-rss.js] OK: ${articles.length} artículos (${results.filter(r => r.ok).map(r => r.name).join(', ')})`);
  if (failures.length > 0) {
    console.warn('[news-rss.js] Feeds que fallaron:', failures.map(f => `${f.name}: ${f.error}`).join(' | '));
  }

  return sendOk(res, {
    articles,
    _fuente: `RSS multi-fuente (${results.filter(r => r.ok).map(r => r.name).join(', ')})`,
    _feedsOk: okCount,
    _feedsTotal: FEEDS.length,
    _warnings: failures.length ? failures.map(f => `${f.name}: ${f.error}`) : undefined,
  });
}
