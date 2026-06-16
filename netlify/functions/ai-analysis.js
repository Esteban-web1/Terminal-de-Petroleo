// ══════════════════════════════════════════════════════════════
// netlify/functions/ai-analysis.js
// Proxy para Anthropic Claude API — resumen IA de noticias
//
// Endpoint:
//   POST /.netlify/functions/ai-analysis
//   Body JSON: { "headlines": ["noticia 1", "noticia 2", ...] }
//
// La función:
//   1. Recibe los titulares del frontend
//   2. Construye el prompt internamente (seguridad: el frontend
//      NO puede controlar el prompt completo)
//   3. Llama a Claude Haiku (barato y rápido)
//   4. Devuelve el análisis
//
// Response:
//   { content: [{ type: "text", text: "▲ Brent sube por..." }] }
//
// Variables de entorno requeridas:
//   ANTHROPIC_API_KEY → cargada en Netlify → Environment variables
//
// ⚠️  SEGURIDAD:
//   - El prompt se arma en el backend, no en el frontend
//   - Se limita a 8 titulares máximo para controlar costos
//   - max_tokens = 400 para mantener bajo el consumo
//   - Se usa claude-haiku-4-5-20251001 (el más económico)
//   - Timeout de 30 segundos (los LLM pueden tardar)
// ══════════════════════════════════════════════════════════════

// ── CONSTANTES ───────────────────────────────────────────────
const TIMEOUT_MS       = 30_000;  // 30 segundos — los LLM tardan más
const MAX_HEADLINES    = 8;       // No procesar más de 8 titulares
const MAX_TOKENS       = 400;     // Limitar respuesta de Claude
const MODEL            = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

// Prompt fijo — el frontend solo envía los titulares, no el prompt.
// Esto previene prompt injection desde el navegador.
const SYSTEM_PROMPT = `Sos analista de mercados de petróleo. Resumí las noticias en 4 puntos clave con impacto en precio (alcista/bajista). Formato: "▲/▼ [acción]". Sé conciso en español.`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// ── HELPERS ──────────────────────────────────────────────────
function errorResponse(statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[ai-analysis.js] ERROR ${statusCode}: ${message}`, details || '');
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function okResponse(data) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

// ── HANDLER PRINCIPAL ────────────────────────────────────────
exports.handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Solo POST — el frontend envía los titulares en el body
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Método no permitido. Usá POST con body JSON.');
  }

  // ── VERIFICAR KEY ─────────────────────────────────────────
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return errorResponse(503, 'API key de Anthropic no configurada en el servidor.');
  }

  // ── PARSEAR BODY ──────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return errorResponse(400, 'Body no es JSON válido.');
  }

  const headlines = body.headlines;

  // Validar que headlines sea un array de strings no vacío
  if (!Array.isArray(headlines) || headlines.length === 0) {
    return errorResponse(400,
      'Se requiere "headlines" como array de strings con al menos 1 titular.'
    );
  }

  // Validar que cada elemento sea un string
  const validHeadlines = headlines
    .filter(h => typeof h === 'string' && h.trim().length > 0)
    .slice(0, MAX_HEADLINES);  // Limitar a 8

  if (validHeadlines.length === 0) {
    return errorResponse(400, 'Ningún titular válido en el array "headlines".');
  }

  console.log(`[ai-analysis.js] Procesando ${validHeadlines.length} titulares`);

  // ── CONSTRUIR REQUEST A ANTHROPIC ─────────────────────────
  // El prompt se arma acá en el backend — NO viene del frontend.
  // Esto previene que alguien inyecte instrucciones maliciosas.
  const userMessage = `Noticias:\n${validHeadlines.join('\n')}`;

  const anthropicBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'user', content: `${SYSTEM_PROMPT}\n\n${userMessage}` }
    ],
  };

  // ── LLAMADA CON TIMEOUT ───────────────────────────────────
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
      return errorResponse(401, 'Anthropic rechazó la API key. Verificá que sea válida.');
    }
    if (response.status === 429) {
      return errorResponse(429, 'Rate limit de Anthropic alcanzado. Reintentá en unos minutos.');
    }
    if (response.status === 529) {
      return errorResponse(529, 'Anthropic está sobrecargado. Reintentá en unos minutos.');
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return errorResponse(502, `Anthropic respondió con status ${response.status}.`, errText);
    }

    const data = await response.json();

    // Verificar que la respuesta tenga el formato esperado
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return errorResponse(502, 'Anthropic no devolvió contenido.', { keys: Object.keys(data) });
    }

    // Verificar que haya texto
    const textBlock = data.content.find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) {
      return errorResponse(502, 'Anthropic no devolvió texto en la respuesta.', data.content);
    }

    console.log(`[ai-analysis.js] OK: ${textBlock.text.length} caracteres generados`);

    // Devolvemos la respuesta tal cual — el frontend espera d.content[0].text
    return okResponse(data);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return errorResponse(504,
        `Anthropic no respondió en ${TIMEOUT_MS / 1000} segundos (timeout). ` +
        'Los modelos IA pueden tardar. Reintentá.'
      );
    }
    return errorResponse(502, 'Error de red al conectar con Anthropic.', err.message);
  }
};
