const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'tickets.json');

/**
 * Fuente de datos local: lee el JSON generado a partir de tu Google Sheet.
 * Esta es la fuente por defecto (DATA_SOURCE=local) y la que te permite
 * probar todo el dashboard sin depender de ninguna cuenta externa.
 */
class LocalDataSource {
  constructor() {
    this.name = 'local';
  }

  async getTickets() {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  }

  async health() {
    return { source: this.name, ok: fs.existsSync(DATA_FILE) };
  }
}

module.exports = LocalDataSource;
