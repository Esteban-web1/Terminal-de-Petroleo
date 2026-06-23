// ══════════════════════════════════════════════════════════════
// api/brent-history.js (Vercel Serverless Function)
// BUG 6 — Sirve el histórico manual de CO1-CO12 + Dated Brent que
// cargan los workflows update-prices.yml / update-dated-brent.yml en
// data/brent-history.json. El archivo viaja con el deploy (se lee del
// filesystem de la función), así que esto es más rápido y cacheable
// que leer el JSON directo como asset estático.
//
// GET /api/brent-history
// → { co_curve:[{Date,CO1..CO12}], dated_brent:[{Date,DB}] }
// ══════════════════════════════════════════════════════════════

import { readFile } from 'fs/promises';
import { join } from 'path';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, statusCode, message, details = null) {
  const body = { error: true, message };
  if (details) body.details = details;
  console.error(`[brent-history.js] ERROR ${statusCode}: ${message}`, details || '');
  return res.status(statusCode).json(body);
}

function sendOk(res, data) {
  // El archivo solo cambia cuando corre un workflow_dispatch manual —
  // no hace falta revalidar seguido. 1h de caché de borde.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');
  return res.status(200).json(data);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Método no permitido. Usá GET.');

  try {
    const filePath = join(process.cwd(), 'data', 'brent-history.json');
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    const co = Array.isArray(data.co_curve) ? data.co_curve : [];
    const db = Array.isArray(data.dated_brent) ? data.dated_brent : [];

    console.log(`[brent-history.js] OK: ${co.length} filas co_curve, ${db.length} filas dated_brent`);
    return sendOk(res, { co_curve: co, dated_brent: db });

  } catch (err) {
    if (err.code === 'ENOENT') {
      return sendError(res, 404, 'data/brent-history.json no existe en este deploy.');
    }
    return sendError(res, 502, 'Error leyendo o parseando data/brent-history.json.', err.message);
  }
}
