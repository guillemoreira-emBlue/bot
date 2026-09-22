const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, '..', '..', 'data', 'audits.json');

/**
 * Backend de auditoría para correr LOCAL (npm start / npm run dev, o
 * cualquier hosting con disco persistente como Render/Railway/un VPS).
 * Guarda todo en un único JSON plano.
 *
 * NO se usa en Vercel: ahí el disco es efímero y se cambia automáticamente
 * al backend de Postgres (ver index.js de esta misma carpeta) apenas hay
 * una variable de entorno POSTGRES_URL configurada.
 */

let writeQueue = Promise.resolve();

function readAll() {
  if (!fs.existsSync(AUDIT_FILE)) return {};
  try {
    const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('[auditStore/local] audits.json corrupto, se ignora:', err.message);
    return {};
  }
}

function writeAllAtomic(data) {
  const tmpFile = `${AUDIT_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, AUDIT_FILE);
}

async function getAudit(ticketId) {
  const all = readAll();
  return all[ticketId] || null;
}

async function getAllAudits() {
  return readAll();
}

// cleanFields: objeto ya sanitizado (ver index.js::sanitizeFields), solo
// con los campos que cambiaron. Hace merge con lo que ya hubiera guardado.
function upsertAudit(ticketId, cleanFields) {
  writeQueue = writeQueue.then(() => {
    const all = readAll();
    all[ticketId] = {
      ...(all[ticketId] || {}),
      ...cleanFields,
      updatedAt: new Date().toISOString(),
    };
    writeAllAtomic(all);
    return all[ticketId];
  });
  return writeQueue;
}

module.exports = { getAudit, getAllAudits, upsertAudit };
