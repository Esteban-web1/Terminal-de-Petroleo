
// ══════════════════════════════════════════════════════════════
// api/news-translate.js (Vercel Serverless Function)
// BUG 2 — Traducción de titulares/descripciones de noticias a español.
//
// Usa MyMemory Translator (https://mymemory.translated.net), gratis,
// SIN key, límite de 5000 caracteres/día por IP de origen (la IP del
// servidor de Vercel, no la del usuario — el límite es compartido
// entre TODOS los visitantes de tu sitio, no por persona).
//
// Con ~150 caracteres promedio por titular, esto da para ~30 titulares
// reales por día como máximo en el plan gratis. El frontend traduce
// SOLO lo que el usuario realmente ve (no todo el backlog acumulado)
// y cachea agresivamente para no gastar quota de nuevo en el mismo
// titular — ver TRANSLATION_CACHE en index.html.
//
// Particularidad de MyMemory: cuando se acaba la quota NO devuelve un
// código de error limpio — devuelve HTTP 200 con el texto literal
// "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR
// TODAY" dentro de translatedText. Hay que detectar ese string a mano.
//
// GET /api/news-translate?q=TEXTO+EN+INGLES
// → { translated: "texto en español", ok: true }
// → { error: true, message: "..." } si falla o se acabó la quota
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS = 8_000;
const MAX_CHARS = 500; // MyMemory trunca/falla con queries muy largas

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[news-translate.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  // Una vez traducido, ese texto en inglés siempre traduce igual —
  // cache largo de borde (24h) además del cache en memoria del frontend.
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');
  return res.status(200).json(data);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  const params = req.query || {};
  const text = (params.q || '').toString().trim();
  if (!text) return sendError(res, 400, 'Falta el parámetro "q" (texto a traducir).');

  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', truncated);
  url.searchParams.set('langpair', 'en|es');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'TerminalPetroleo/1.0' },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return sendError(res, 502, `MyMemory respondió con status ${response.status}.`);
    }

    const data = await response.json();
    const translated = data?.responseData?.translatedText;

    if (!translated) {
      return sendError(res, 502, 'MyMemory no devolvió traducción.', { keys: Object.keys(data || {}) });
    }

    // Particularidad de MyMemory: el aviso de quota agotada viene como
    // HTTP 200 con este texto literal adentro del campo traducido.
    if (translated.includes('MYMEMORY WARNING') || translated.includes('QUOTA')) {
      return sendError(res, 429, 'Quota diaria de MyMemory agotada (5000 caracteres/día, compartida entre todos los visitantes). Se resetea a medianoche UTC. El frontend muestra el original con badge "EN" mientras tanto.');
    }

    return sendOk(res, { translated, ok: true });

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504, `MyMemory no respondió en ${TIMEOUT_MS / 1000}s (timeout).`);
    }
    return sendError(res, 502, 'Error de red al conectar con MyMemory.', err.message);
  }
}
