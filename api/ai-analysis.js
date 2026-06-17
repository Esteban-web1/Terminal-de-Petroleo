// ══════════════════════════════════════════════════════════════
// api/ai-analysis.js (Vercel Serverless Function)
// Proxy para Anthropic Claude API — resumen IA de noticias
//
// POST /api/ai-analysis
// Body JSON: { "headlines": ["noticia 1", "noticia 2", ...] }
//
// El prompt se arma en el backend (no en el frontend) por seguridad
// contra prompt injection. Máximo 8 titulares, modelo Haiku (económico).
//
// Variable de entorno requerida:
//   ANTHROPIC_API_KEY → Vercel → Project Settings → Environment Variables
// ══════════════════════════════════════════════════════════════

const TIMEOUT_MS        = 30_000; // 30s — los LLM tardan más
const MAX_HEADLINES     = 8;
const MAX_TOKENS        = 400;
const MODEL             = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT = `Sos analista de mercados de petróleo. Resumí las noticias en 4 puntos clave con impacto en precio (alcista/bajista). Formato: "▲/▼ [acción]". Sé conciso en español.`;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[ai-analysis.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  return res.status(200).json(data);
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Método no permitido. Usá POST con body JSON.');
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return sendError(res, 503, 'API key de Anthropic no configurada en el servidor.');
  }

  // Vercel parsea el JSON del body automáticamente → req.body ya es un objeto
  const body      = req.body || {};
  const headlines = body.headlines;

  if (!Array.isArray(headlines) || headlines.length === 0) {
    return sendError(res, 400, 'Se requiere "headlines" como array de strings con al menos 1 titular.');
  }

  const validHeadlines = headlines
    .filter(h => typeof h === 'string' && h.trim().length > 0)
    .slice(0, MAX_HEADLINES);

  if (validHeadlines.length === 0) {
    return sendError(res, 400, 'Ningún titular válido en el array "headlines".');
  }

  console.log(`[ai-analysis.js] Procesando ${validHeadlines.length} titulares`);

  const userMessage = `Noticias:\n${validHeadlines.join('\n')}`;

  const anthropicBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'user', content: `${SYSTEM_PROMPT}\n\n${userMessage}` }
    ],
  };

  const controller = new AbortController();
  const timer       = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(anthropicBody),
    });
    clearTimeout(timer);

    if (response.status === 401) {
      return sendError(res, 401, 'Anthropic rechazó la API key. Verificá que sea válida.');
    }
    if (response.status === 429) {
      return sendError(res, 429, 'Rate limit de Anthropic alcanzado. Reintentá en unos minutos.');
    }
    if (response.status === 529) {
      return sendError(res, 529, 'Anthropic está sobrecargado. Reintentá en unos minutos.');
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return sendError(res, 502, `Anthropic respondió con status ${response.status}.`, errText);
    }

    const data = await response.json();

    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return sendError(res, 502, 'Anthropic no devolvió contenido.', { keys: Object.keys(data) });
    }

    const textBlock = data.content.find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) {
      return sendError(res, 502, 'Anthropic no devolvió texto en la respuesta.', data.content);
    }

    console.log(`[ai-analysis.js] OK: ${textBlock.text.length} caracteres generados`);

    // Devolvemos la respuesta tal cual — el frontend espera d.content[0].text
    return sendOk(res, data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return sendError(res, 504,
        `Anthropic no respondió en ${TIMEOUT_MS / 1000} segundos (timeout). Los modelos IA pueden tardar. Reintentá.`
      );
    }
    return sendError(res, 502, 'Error de red al conectar con Anthropic.', err.message);
  }
}
