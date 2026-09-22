const { neon } = require('@neondatabase/serverless');

/**
 * Backend de auditoría para Vercel: guarda cada auditoría como una fila en
 * una tabla de Postgres (vía Neon, que es lo que Vercel provisiona hoy
 * cuando conectás una base de datos Postgres al proyecto desde la pestaña
 * Storage → Marketplace → Neon). Se activa solo (ver index.js) cuando existe
 * alguna de las variables de entorno que esa integración inyecta
 * automáticamente — no hace falta ninguna configuración manual además de
 * conectar la base desde el dashboard de Vercel.
 *
 * Por qué Postgres y no el archivo local: en Vercel cada función serverless
 * puede correr en una instancia distinta y el disco no persiste entre
 * invocaciones, así que un archivo JSON como el del backend local se
 * perdería o quedaría inconsistente entre pedidos.
 */

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING
  );
}

let sqlClient = null;
function getSql() {
  if (!sqlClient) sqlClient = neon(connectionString());
  return sqlClient;
}

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    const sql = getSql();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS bot_audit_records (
        ticket_id TEXT PRIMARY KEY,
        had_info BOOLEAN,
        answered_correctly BOOLEAN,
        error_type TEXT,
        completion TEXT,
        retained BOOLEAN,
        error_spec TEXT,
        improved TEXT,
        notes TEXT,
        audit_ok TEXT,
        comments TEXT,
        updated_at TIMESTAMPTZ
      )
    `.catch((err) => {
      tableReady = null; // reintentar en el próximo pedido si falló
      throw err;
    });
  }
  return tableReady;
}

function rowToRecord(row) {
  if (!row) return null;
  return {
    hadInfo: row.had_info,
    answeredCorrectly: row.answered_correctly,
    errorType: row.error_type,
    completion: row.completion,
    retained: row.retained,
    errorSpec: row.error_spec,
    improved: row.improved,
    notes: row.notes,
    auditOk: row.audit_ok,
    comments: row.comments,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function getAudit(ticketId) {
  await ensureTable();
  const sql = getSql();
  const rows = await sql`SELECT * FROM bot_audit_records WHERE ticket_id = ${ticketId}`;
  return rowToRecord(rows[0]);
}

async function getAllAudits() {
  await ensureTable();
  const sql = getSql();
  const rows = await sql`SELECT * FROM bot_audit_records`;
  const map = {};
  for (const row of rows) map[row.ticket_id] = rowToRecord(row);
  return map;
}

// cleanFields: objeto ya sanitizado (ver index.js::sanitizeFields), solo
// con los campos que cambiaron. Lee lo existente, mergea en JS (igual que
// el backend local) y hace un upsert de la fila completa — así ambos
// backends se comportan exactamente igual desde afuera.
async function upsertAudit(ticketId, cleanFields) {
  await ensureTable();
  const sql = getSql();
  const existing = await getAudit(ticketId);
  const merged = {
    ...(existing || {}),
    ...cleanFields,
    updatedAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO bot_audit_records (
      ticket_id, had_info, answered_correctly, error_type, completion,
      retained, error_spec, improved, notes, audit_ok, comments, updated_at
    ) VALUES (
      ${ticketId},
      ${merged.hadInfo ?? null},
      ${merged.answeredCorrectly ?? null},
      ${merged.errorType ?? null},
      ${merged.completion ?? null},
      ${merged.retained ?? null},
      ${merged.errorSpec ?? null},
      ${merged.improved ?? null},
      ${merged.notes ?? null},
      ${merged.auditOk ?? null},
      ${merged.comments ?? null},
      ${merged.updatedAt}
    )
    ON CONFLICT (ticket_id) DO UPDATE SET
      had_info = EXCLUDED.had_info,
      answered_correctly = EXCLUDED.answered_correctly,
      error_type = EXCLUDED.error_type,
      completion = EXCLUDED.completion,
      retained = EXCLUDED.retained,
      error_spec = EXCLUDED.error_spec,
      improved = EXCLUDED.improved,
      notes = EXCLUDED.notes,
      audit_ok = EXCLUDED.audit_ok,
      comments = EXCLUDED.comments,
      updated_at = EXCLUDED.updated_at
  `;

  return merged;
}

module.exports = { getAudit, getAllAudits, upsertAudit };
