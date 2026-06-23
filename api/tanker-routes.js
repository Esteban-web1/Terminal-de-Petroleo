// ══════════════════════════════════════════════════════════════
// api/tanker-routes.js (Vercel Serverless Function)
// BUG 3 — Rutas de tanqueros.
//
// Investigación de factibilidad (honesta):
//   - MarineTraffic API: el free tier requiere REGISTRO + API key
//     (no es anónimo, no hay variable de entorno para esto en el
//     proyecto). No se puede llamar sin que vos te registres y me
//     pases una key.
//   - VesselFinder API: mismo caso — requiere cuenta y key paga para
//     casi todo excepto consultas muy limitadas, tampoco anónimo.
//   - EmodNet Human Activities API: es europea, cubre el Mediterráneo/
//     Atlántico europeo, NO cubre Hormuz/Malacca/Golfo Pérsico que son
//     los chokepoints que más importan acá — no es una solución real
//     para este caso de uso.
//
// CONCLUSIÓN: ninguna fuente gratuita y anónima de tracking en vivo es
// viable hoy sin que el usuario se registre y configure una API key.
// Por eso esta función devuelve rutas TÍPICAS publicadas (Worldscale /
// patrones de comercio conocidos), con liveTracking:false explícito en
// cada ruta — el frontend debe etiquetarlo así, nunca como "en vivo".
//
// GET /api/tanker-routes
// → { routes:[{from,to,fromLabel,toLabel,type,liveTracking}], note }
// ══════════════════════════════════════════════════════════════

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendOk(res, data) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200'); // esto no cambia día a día
  return res.status(200).json(data);
}

// Rutas típicas de comercio de crudo, públicamente conocidas (Worldscale,
// reportes EIA de flujos comerciales). Coordenadas son puntos representativos
// de la región de origen/destino, no puertos específicos.
const TYPICAL_ROUTES = [
  { from: [50.8, 27.0],  to: [104.0, 1.3],  fromLabel: 'Golfo Pérsico',      toLabel: 'Asia (vía Malacca)',     type: 'VLCC', liveTracking: false },
  { from: [-93.0, 29.0], to: [3.0, 51.0],   fromLabel: 'US Gulf Coast',      toLabel: 'Europa NW (Atlantic Basin)', type: 'Suezmax', liveTracking: false },
  { from: [5.0, 6.0],    to: [78.0, 12.0],  fromLabel: 'West Africa',        toLabel: 'India',                  type: 'VLCC', liveTracking: false },
  { from: [2.0, 60.0],   to: [4.0, 52.0],   fromLabel: 'Mar del Norte',      toLabel: 'NW Europa',               type: 'Aframax', liveTracking: false },
  { from: [50.8, 27.0],  to: [32.5, 30.0],  fromLabel: 'Golfo Pérsico',      toLabel: 'Europa (vía Suez)',        type: 'Suezmax', liveTracking: false },
];

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  console.log('[tanker-routes.js] devolviendo rutas típicas (sin tracking en vivo — ver comentarios del archivo)');

  return sendOk(res, {
    routes: TYPICAL_ROUTES,
    note: 'Rutas típicas histórico/comerciales (Worldscale), NO es tracking en vivo. MarineTraffic y VesselFinder requieren registro + API key propia que este proyecto no tiene configurada — si en algún momento te registrás y me pasás una key, esto se puede reemplazar por tracking real.',
  });
}
