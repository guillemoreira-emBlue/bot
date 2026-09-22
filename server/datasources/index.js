const LocalDataSource = require('./localDataSource');
const ZohoDataSource = require('./zohoDataSource');
const ChatbaseDataSource = require('./chatbaseDataSource');

let cachedSource = null;

/**
 * Elige la fuente de datos según la variable de entorno DATA_SOURCE.
 * Por defecto usa la planilla importada localmente, así el dashboard
 * funciona de entrada sin ninguna cuenta externa.
 *
 * Para pasar a datos en vivo el día de mañana, solo hace falta:
 *   1. Completar las credenciales en .env (ver zohoDataSource.js / chatbaseDataSource.js)
 *   2. Cambiar DATA_SOURCE=zoho (o chatbase) en .env
 *   3. Reiniciar el servidor
 * Ninguna ruta de la API ni el frontend necesitan cambios.
 */
function getDataSource() {
  if (cachedSource) return cachedSource;

  const which = (process.env.DATA_SOURCE || 'local').toLowerCase();

  if (which === 'zoho') {
    cachedSource = new ZohoDataSource();
  } else if (which === 'chatbase') {
    cachedSource = new ChatbaseDataSource();
  } else {
    cachedSource = new LocalDataSource();
  }

  return cachedSource;
}

module.exports = { getDataSource };
