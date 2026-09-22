const express = require('express');
const { getDataSource } = require('../datasources');
const { applyAudits, upsertAudit, AUDIT_KEYS } = require('../lib/auditStore');
const { AUDIT_FIELDS } = require('../config/auditOptions');
const {
  filterTickets,
  buildSummary,
  buildTopics,
  buildErrors,
  buildComplexity,
  buildTimeseries,
} = require('../lib/metrics');

const router = express.Router();

function getFilters(req) {
  const { from, to, category, complexity, pending } = req.query;
  return { from, to, category, complexity, pending };
}

// Cachear el fetch a la fuente de datos un ratito: si DATA_SOURCE=zoho, cada
// carga del dashboard dispara varios endpoints en paralelo (summary, topics,
// errors, timeseries, tickets) y no tiene sentido pedirle a Zoho la lista
// completa de tickets 5 veces seguidas. "local" no necesita cache (es leer
// un archivo). El TTL es configurable por si tu volumen de tickets es alto.
const CACHE_TTL_MS = Number(process.env.DATA_CACHE_TTL_MS || 20000);
let cache = { key: null, at: 0, tickets: null };

async function getBaseTickets() {
  const source = getDataSource();
  if (source.name === 'local') return source.getTickets();

  const fresh = cache.key === source.name && Date.now() - cache.at < CACHE_TTL_MS;
  if (fresh) return cache.tickets;

  const tickets = await source.getTickets();
  cache = { key: source.name, at: Date.now(), tickets };
  return tickets;
}

// Tickets base (de la fuente activa) + auditoría manual guardada, ya
// mergeados. Este es el único punto por el que pasan todos los endpoints
// de lectura, para que dashboard y auditoría vean siempre lo mismo.
async function getMergedTickets(filters) {
  const base = await getBaseTickets();
  const merged = await applyAudits(base);
  return filterTickets(merged, filters);
}

// GET /api/health -> estado de la fuente de datos activa
router.get('/health', async (req, res) => {
  try {
    const source = getDataSource();
    const health = await source.health();
    res.json({ ok: true, dataSource: process.env.DATA_SOURCE || 'local', ...health });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/audit-options -> las opciones de cada desplegable de auditoría
// (fuente única de verdad, para que el frontend no las tenga hardcodeadas)
router.get('/audit-options', (req, res) => {
  res.json(AUDIT_FIELDS);
});

// GET /api/tickets -> lista de tickets (base + auditoría, filtrable)
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await getMergedTickets(getFilters(req));
    res.json({ count: tickets.length, tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tickets/:id/audit -> guarda/actualiza la auditoría manual de un ticket
router.put('/tickets/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = {};
    for (const key of AUDIT_KEYS) {
      if (key in req.body) fields[key] = req.body[key];
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No se envió ningún campo de auditoría válido.' });
    }
    const saved = await upsertAudit(id, fields);
    res.json({ ok: true, ticketId: id, audit: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summary -> KPIs generales
router.get('/summary', async (req, res) => {
  try {
    const tickets = await getMergedTickets(getFilters(req));
    res.json(buildSummary(tickets));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/topics -> ranking de tópicos/categorías
router.get('/topics', async (req, res) => {
  try {
    const tickets = await getMergedTickets(getFilters(req));
    res.json(buildTopics(tickets));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/errors -> desglose de errores del bot
router.get('/errors', async (req, res) => {
  try {
    const tickets = await getMergedTickets(getFilters(req));
    res.json(buildErrors(tickets));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/complexity -> desglose por complejidad
router.get('/complexity', async (req, res) => {
  try {
    const tickets = await getMergedTickets(getFilters(req));
    res.json(buildComplexity(tickets));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timeseries?granularity=week|month -> evolución en el tiempo
router.get('/timeseries', async (req, res) => {
  try {
    const tickets = await getMergedTickets(getFilters(req));
    const granularity = req.query.granularity === 'month' ? 'month' : 'week';
    res.json(buildTimeseries(tickets, granularity));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories -> lista simple de categorías (para poblar filtros)
router.get('/categories', async (req, res) => {
  try {
    const tickets = await getBaseTickets();
    const cats = [...new Set(tickets.map((t) => t.topic.category).filter(Boolean))].sort();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
