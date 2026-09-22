const { emptyTicket } = require('./schema');

/**
 * Conector para Chatbase (chatbase.co).
 *
 * Igual que zohoDataSource.js: es un esqueleto documentado, no una
 * integración terminada, porque necesita tus credenciales reales para
 * funcionar. Chatbase expone conversaciones/mensajes vía su API con un
 * Bearer token y un chatbotId.
 *
 * Variables de entorno:
 *   CHATBASE_API_KEY
 *   CHATBASE_CHATBOT_ID
 *
 * Docs: https://www.chatbase.co/docs/developer-guides/api
 *
 * Nota: Chatbase te da conversaciones/mensajes crudos, no el análisis de
 * auditoría (tópico, si respondió bien, tipo de error, etc). Esa capa de
 * auditoría hoy la hacen ustedes a mano en la planilla; si querés que siga
 * viviendo en algún lado accesible por API, dos opciones:
 *   a) seguir auditando en Zoho (como ya definiste que priorizás) y usar
 *      Chatbase solo para las métricas de volumen/uso de conversaciones, o
 *      b) agregar tags/metadata en Chatbase por conversación y leerlos acá.
 */
class ChatbaseDataSource {
  constructor(env = process.env) {
    this.name = 'chatbase';
    this.env = env;
  }

  isConfigured() {
    return Boolean(this.env.CHATBASE_API_KEY && this.env.CHATBASE_CHATBOT_ID);
  }

  async fetchRawConversations() {
    if (!this.isConfigured()) {
      throw new Error(
        '[ChatbaseDataSource] Faltan variables de entorno. Definí CHATBASE_API_KEY y ' +
          'CHATBASE_CHATBOT_ID en tu .env (ver server/datasources/chatbaseDataSource.js).'
      );
    }

    const url = `https://www.chatbase.co/api/v1/get-conversations?chatbotId=${this.env.CHATBASE_CHATBOT_ID}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.env.CHATBASE_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`[ChatbaseDataSource] Error consultando Chatbase: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  normalize(rawConversation) {
    return emptyTicket({
      id: rawConversation.id,
      date: rawConversation.createdAt ? rawConversation.createdAt.slice(0, 10) : null,
      topic: { raw: rawConversation.title || null, category: null, subcategory: null, detail: null },
      // TODO: mapear el resto según lo que decidan registrar en Chatbase
    });
  }

  async getTickets() {
    const raw = await this.fetchRawConversations();
    const list = Array.isArray(raw) ? raw : raw.data || [];
    return list.map((c) => this.normalize(c));
  }

  async health() {
    return { source: this.name, ok: this.isConfigured(), configured: this.isConfigured() };
  }
}

module.exports = ChatbaseDataSource;
