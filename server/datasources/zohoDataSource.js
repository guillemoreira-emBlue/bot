const { emptyTicket } = require('./schema');

/**
 * Conector para Zoho Desk (tickets).
 *
 * Trae automáticamente los datos BASE del ticket (fecha, tópico, número,
 * link, y complejidad si la tenés como campo personalizado). Los 10 campos
 * de auditoría (Tenía la info, Respondió bien, Tipo de error, Finalización,
 * Retenido, Especificación del error, Improved, Notas, Audit ok, Coments)
 * NO se leen de Zoho: esos los completa la persona que audita desde la
 * pantalla de Auditoría de este dashboard, y se guardan en
 * server/data/audits.json (ver server/lib/auditStore.js). Así separás
 * claramente "lo que ya existe en Zoho" de "lo que decide un humano".
 *
 * Variables de entorno (Zoho OAuth 2.0 - "Self Client" o Server-based app,
 * ver https://desk.zoho.com/DeskAPIDocument#OauthRequest):
 *   ZOHO_DC               -> datacenter: com | eu | in | com.au | jp
 *   ZOHO_CLIENT_ID
 *   ZOHO_CLIENT_SECRET
 *   ZOHO_REFRESH_TOKEN
 *   ZOHO_ORG_ID           -> orgId de Zoho Desk
 *   ZOHO_DEPARTMENT_ID    -> (opcional) filtrar por un departamento
 *
 * Si en Zoho registrás el tópico/categoría o la complejidad en campos
 * personalizados (en vez de "category"/"subCategory" estándar), decile a
 * este conector cómo se llaman con estas variables, sin tocar código:
 *   ZOHO_FIELD_CATEGORY      (default: "category")
 *   ZOHO_FIELD_SUBCATEGORY   (default: "subCategory")
 *   ZOHO_FIELD_COMPLEXITY    (default: ninguno -> queda null)
 *
 * Flujo:
 *   1. authenticate(): con el refresh_token pide un access_token corto
 *      (accounts.zoho.<dc>/oauth/v2/token), lo cachea en memoria y lo
 *      renueva solo cuando expira (~1h).
 *   2. fetchAllRawTickets(): pagina el endpoint de tickets de Zoho Desk
 *      hasta traerlos todos (100 por página).
 *   3. normalize(): mapea cada ticket de Zoho al esquema común
 *      (ver server/datasources/schema.js).
 */
class ZohoDataSource {
  constructor(env = process.env) {
    this.name = 'zoho';
    this.env = env;
    this._accessToken = null;
    this._accessTokenExpiresAt = 0;
  }

  isConfigured() {
    const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID } = this.env;
    return Boolean(ZOHO_CLIENT_ID && ZOHO_CLIENT_SECRET && ZOHO_REFRESH_TOKEN && ZOHO_ORG_ID);
  }

  _requireConfig() {
    if (!this.isConfigured()) {
      throw new Error(
        '[ZohoDataSource] Faltan variables de entorno de Zoho. Definí ZOHO_CLIENT_ID, ' +
          'ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN y ZOHO_ORG_ID en tu .env (copiá .env.example) ' +
          'y poné DATA_SOURCE=zoho. Ver server/datasources/zohoDataSource.js para el detalle.'
      );
    }
  }

  async authenticate() {
    if (this._accessToken && Date.now() < this._accessTokenExpiresAt) {
      return this._accessToken;
    }
    this._requireConfig();

    const dc = this.env.ZOHO_DC || 'com';
    const url = `https://accounts.zoho.${dc}/oauth/v2/token`;
    const params = new URLSearchParams({
      refresh_token: this.env.ZOHO_REFRESH_TOKEN,
      client_id: this.env.ZOHO_CLIENT_ID,
      client_secret: this.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    });

    const res = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`[ZohoDataSource] Error autenticando contra Zoho: ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    if (!json.access_token) {
      throw new Error(`[ZohoDataSource] Zoho no devolvió access_token: ${JSON.stringify(json)}`);
    }
    this._accessToken = json.access_token;
    // Zoho da expires_in en segundos; restamos un margen de 60s.
    this._accessTokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;
    return this._accessToken;
  }

  async _zohoFetch(pathAndQuery) {
    const token = await this.authenticate();
    const dc = this.env.ZOHO_DC || 'com';
    const url = `https://desk.zoho.${dc}/api/v1${pathAndQuery}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        orgId: this.env.ZOHO_ORG_ID,
      },
    });
    if (!res.ok) {
      throw new Error(`[ZohoDataSource] Error consultando Zoho (${url}): ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  /**
   * Trae TODOS los tickets, paginando de a 100 (el máximo que permite
   * Zoho Desk por página) hasta que una página vuelve incompleta.
   */
  async fetchAllRawTickets() {
    const pageSize = 100;
    const maxPages = Number(this.env.ZOHO_MAX_PAGES || 50); // salvaguarda anti loop infinito
    let from = 0;
    const all = [];

    for (let page = 0; page < maxPages; page++) {
      const deptFilter = this.env.ZOHO_DEPARTMENT_ID
        ? `&departmentId=${encodeURIComponent(this.env.ZOHO_DEPARTMENT_ID)}`
        : '';
      const json = await this._zohoFetch(`/tickets?from=${from}&limit=${pageSize}${deptFilter}`);
      const batch = json.data || [];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return all;
  }

  normalize(rawTicket) {
    const categoryField = this.env.ZOHO_FIELD_CATEGORY || 'category';
    const subcategoryField = this.env.ZOHO_FIELD_SUBCATEGORY || 'subCategory';
    const complexityField = this.env.ZOHO_FIELD_COMPLEXITY || null;

    const customFields = rawTicket.cf || {}; // campos personalizados de Zoho Desk vienen bajo "cf"

    return emptyTicket({
      id: String(rawTicket.id),
      date: rawTicket.createdTime ? rawTicket.createdTime.slice(0, 10) : null,
      topic: {
        raw: rawTicket.subject || null,
        category: rawTicket[categoryField] || customFields[categoryField] || null,
        subcategory: rawTicket[subcategoryField] || customFields[subcategoryField] || null,
        detail: null,
      },
      complexity: complexityField ? rawTicket[complexityField] || customFields[complexityField] || null : null,
      ticket: rawTicket.ticketNumber || String(rawTicket.id),
      ticketUrl: rawTicket.webUrl || (rawTicket.id ? `https://desk.zoho.${this.env.ZOHO_DC || 'com'}/agent/ticket/${rawTicket.id}` : null),
      // Los 10 campos de auditoría quedan en su default (null/false):
      // los completa la persona desde la pantalla de Auditoría, no Zoho.
    });
  }

  async getTickets() {
    const raw = await this.fetchAllRawTickets();
    return raw.map((t) => this.normalize(t));
  }

  async health() {
    return { source: this.name, ok: this.isConfigured(), configured: this.isConfigured() };
  }
}

module.exports = ZohoDataSource;
