// ══════════════════════════════════════════════════════════════
// api/static-data.js (Vercel Serverless Function)
// OPTIMIZACIÓN DE FUNCIONES: fusiona lo que antes eran 3 funciones
// separadas (api/brent-history.js + api/trade-flows.js +
// api/tanker-routes.js) en una sola — las 3 hacían exactamente lo
// mismo (leer un JSON de /data y servirlo con cache), así que no
// tenía sentido gastar 3 slots de función para eso.
//
// GET /api/static-data?file=brent-history  → { co_curve, dated_brent }
// GET /api/static-data?file=trade-flows    → { flows, endpoints_geo, maritime_waypoints }
// GET /api/static-data?file=tanker-routes  → { routes, _nota }
//
// Whitelist explícita de archivos servibles — no se puede pedir
// cualquier path arbitrario del filesystem.
// ══════════════════════════════════════════════════════════════

import { readFile } from 'fs/promises';
import { join } from 'path';

// clave pública → { archivo real, cache en segundos }
const FILES = {
  'brent-history': { path: 'data/brent-history.json', cache: 3600 },   // cambia solo con workflow manual
  'trade-flows':   { path: 'data/trade-flows.json',   cache: 86400 },  // referencia anual
  'tanker-routes': { path: 'data/tanker-routes.json',  cache: 86400 }, // rutas típicas, no cambian
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[static-data.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  const params = req.query || {};
  const fileKey = params.file;
  const entry = FILES[fileKey];

  if (!entry) {
    return sendError(res, 400, `file inválido: "${fileKey}". Valores válidos: ${Object.keys(FILES).join(', ')}`);
  }

  try {
    const filePath = join(process.cwd(), entry.path);
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    res.setHeader('Cache-Control', `s-maxage=${entry.cache}, stale-while-revalidate=${Math.floor(entry.cache / 2)}`);
    console.log(`[static-data.js] OK: ${fileKey} servido desde ${entry.path}`);
    return res.status(200).json(data);

  } catch (err) {
    if (err.code === 'ENOENT') {
      return sendError(res, 404, `${entry.path} no existe en este deploy.`);
    }
    return sendError(res, 502, `Error leyendo o parseando ${entry.path}.`, err.message);
  }
}
