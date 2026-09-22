/**
 * Esquema común de "ticket" que usa todo el dashboard.
 *
 * Cualquier fuente de datos (local, Zoho, Chatbase) tiene que devolver
 * un array de objetos con esta forma. Así el resto de la app (métricas,
 * rutas de API, frontend) no le importa de dónde vinieron los datos.
 *
 * {
 *   id: string,                 // id interno único
 *   date: 'YYYY-MM-DD',         // fecha del ticket/conversación
 *   topic: {
 *     raw: string,              // texto completo original ("Contactos v2 :: Descartados :: Revisión de Descartados")
 *     category: string,         // "Contactos v2"
 *     subcategory: string|null, // "Descartados"
 *     detail: string|null,      // "Revisión de Descartados"
 *   },
 *   complexity: 'Basica'|'Intermedia'|'Avanzada'|'Técnica'|string|null,
 *   ticket: string|null,        // número de ticket (sin '#')
 *   ticketUrl: string|null,     // link directo al ticket (Zoho Desk, Chatbase, etc.)
 *   hadInfo: boolean|null,      // ¿el bot tenía la info para responder?
 *   answeredCorrectly: boolean|null,
 *   errorType: string|null,     // 'TU' | 'Error 1' | 'Error 2' | 'Error 3' | 'Error en plataforma' | ...
 *   completion: string|null,    // 'Retenido' | 'Handover - pidío humano' | 'Handover - no pudo solucionar' | 'perdido'
 *   retained: boolean,          // true si el chat se resolvió sin escalar a humano
 *   errorSpec: string|null,     // detalle del tipo de error
 *   improved: string|null,
 *   notes: string|null,
 *   auditOk: string|null,
 *   comments: string|null,
 * }
 */

function emptyTicket(overrides = {}) {
  return {
    id: null,
    date: null,
    topic: { raw: null, category: null, subcategory: null, detail: null },
    complexity: null,
    ticket: null,
    ticketUrl: null,
    hadInfo: null,
    answeredCorrectly: null,
    errorType: null,
    completion: null,
    retained: false,
    errorSpec: null,
    improved: null,
    notes: null,
    auditOk: null,
    comments: null,
    ...overrides,
  };
}

module.exports = { emptyTicket };
