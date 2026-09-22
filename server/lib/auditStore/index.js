const { AUDIT_FIELDS } = require('../../config/auditOptions');

const AUDIT_KEYS = Object.keys(AUDIT_FIELDS);

/**
 * Guarda las auditorías manuales (los 10 campos que llena una persona)
 * separadas de los datos base del ticket (que vienen de Zoho/Chatbase/local).
 * Este archivo es la fachada: decide QUÉ backend de almacenamiento usar y
 * hace el merge de auditoría sobre un ticket. server/routes/api.js solo
 * conoce esta fachada, nunca los backends de abajo.
 *
 * - Si existe alguna variable de conexión a Postgres (DATABASE_URL /
 *   POSTGRES_URL / *_UNPOOLED — Vercel las inyecta solas al conectar una
 *   base Postgres desde la pestaña Storage del proyecto): usa Postgres. Es
 *   lo que hace falta para que auditar funcione de verdad en Vercel, donde
 *   el disco no persiste entre pedidos.
 * - Si no: usa un archivo JSON local (server/data/audits.json). Es lo que
 *   se usa corriendo con `npm start` en tu máquina, o en cualquier hosting
 *   con disco persistente (Render, Railway, un VPS).
 *
 * Ningún otro archivo del proyecto necesita saber cuál de los dos está
 * activo.
 */
function hasDatabaseConfigured() {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING
  );
}

function getBackend() {
  if (hasDatabaseConfigured()) {
    return require('./postgresBackend');
  }
  return require('./localBackend');
}

function sanitizeFields(fields) {
  const clean = {};
  for (const key of AUDIT_KEYS) {
    if (!(key in fields)) continue;
    const def = AUDIT_FIELDS[key];
    let value = fields[key];

    if (def.type === 'text') {
      clean[key] = value === undefined || value === null ? '' : String(value);
      continue;
    }

    // selects: normalizamos strings vacíos a null, 'true'/'false' a boolean
    if (value === '' || value === undefined || value === null) {
      clean[key] = null;
    } else if (value === 'true' || value === true) {
      clean[key] = true;
    } else if (value === 'false' || value === false) {
      clean[key] = false;
    } else if (value === 'si') {
      // hadInfo / answeredCorrectly se guardan como boolean; el resto de
      // los selects (errorType, completion, errorSpec, improved, auditOk)
      // guardan el string tal cual.
      clean[key] = ['hadInfo', 'answeredCorrectly'].includes(key) ? true : value;
    } else if (value === 'no' && ['hadInfo', 'answeredCorrectly'].includes(key)) {
      clean[key] = false;
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

async function getAudit(ticketId) {
  return getBackend().getAudit(ticketId);
}

async function getAllAudits() {
  return getBackend().getAllAudits();
}

async function upsertAudit(ticketId, fields) {
  const clean = sanitizeFields(fields);
  return getBackend().upsertAudit(ticketId, clean);
}

/**
 * Superpone la auditoría guardada (si existe) sobre los campos base de un
 * ticket. Los campos de auditoría de la auditoría guardada siempre ganan
 * porque representan la última decisión humana.
 */
function applyAudit(ticket, auditRecord) {
  if (!auditRecord) return ticket;
  const merged = { ...ticket };
  for (const key of AUDIT_KEYS) {
    if (key in auditRecord && auditRecord[key] !== undefined) {
      merged[key] = auditRecord[key];
    }
  }
  merged.auditedAt = auditRecord.updatedAt || null;
  return merged;
}

async function applyAudits(tickets) {
  const all = await getAllAudits();
  return tickets.map((t) => applyAudit(t, all[t.id]));
}

module.exports = {
  getAudit,
  getAllAudits,
  upsertAudit,
  applyAudit,
  applyAudits,
  AUDIT_KEYS,
  hasDatabaseConfigured,
};
