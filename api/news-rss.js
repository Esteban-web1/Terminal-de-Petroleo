// ══════════════════════════════════════════════════════════════
// api/news-rss.js (Vercel Serverless Function)
// Fallback SIN KEY cuando GNews y NewsAPI fallan (403/401/rate-limit).
// Combina dos feeds RSS públicos, gratis, sin API key, parseados con
// regex simple (RSS bien formado no necesita un parser XML completo):
//
//   - EIA "Today in Energy"   → https://www.eia.gov/rss/todayinenergy.xml
//     Oficial del gobierno de EE.UU. Publica "varias veces por semana"
//     (NO es un feed minuto a minuto).
//   - OilPrice.com             → https://oilprice.com/rss/main
//     Feed público de noticias de petróleo, actualiza varias veces al día.
//
// GET /api/news-rss
// → { articles: [ { title, description, url, publishedAt, source } ] }
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 10_000;
const FEEDS = [
  { url: 'https://oilprice.com/rss/main', name: 'OilPrice.com' },
  { url: 'https://www.eia.gov/rss/todayinenergy.xml', name: 'EIA Today in Energy' },
];

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
  return res.status(200).json(data);
}

// Decodifica entidades XML básicas y saca tags CDATA
function cleanXmlText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '') // por si quedó HTML embebido en la descripción
    .trim();
}

// Extrae el contenido de una etiqueta simple <tag>...</tag> dentro de un bloque
function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? cleanXmlText(m[1]) : '';
}

function parseRssItems(xml, sourceName, maxItems = 15) {
  const items = [];
  const itemBlocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const block of itemBlocks.slice(0, maxItems)) {
    const title = extractTag(block, 'title');
    const description = extractTag(block, 'description');
    const link = extractTag(block, 'link');
    const pubDateRaw = extractTag(block, 'pubDate');

    if (!title) continue;

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
    });
  }
  return items;
}

async function fetchOneFeed(feed, controller) {
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    if (!response.ok) return { ok: false, name: feed.name, error: `status ${response.status}` };
    const xml = await response.text();
    const items = parseRssItems(xml, feed.name);
    return { ok: true, name: feed.name, items };
  } catch (err) {
    return { ok: false, name: feed.name, error: err.message };
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Método no permitido. Usá GET.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const results = await Promise.all(FEEDS.map(f => fetchOneFeed(f, controller)));
    clearTimeout(timer);

    const failures = results.filter(r => !r.ok);
    const articles = results
      .filter(r => r.ok)
      .flatMap(r => r.items)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    if (articles.length === 0) {
      return sendError(res, 502, 'Ningún feed RSS devolvió artículos parseables.', failures);
    }

    console.log(`[news-rss.js] OK: ${articles.length} artículos (${results.filter(r=>r.ok).map(r=>r.name).join(', ')})`);
    return sendOk(res, {
      articles,
      _fuente: 'RSS público (fallback) — OilPrice.com + EIA Today in Energy',
      _warnings: failures.length ? failures.map(f => `${f.name}: ${f.error}`) : undefined,
    });

  } catch (err) {
    clearTimeout(timer);
    return sendError(res, 502, 'Error inesperado leyendo los feeds RSS.', err.message);
  }
}
