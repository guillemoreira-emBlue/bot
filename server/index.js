const app = require('./app');
const { hasDatabaseConfigured } = require('./lib/auditStore');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\nBot Audit Dashboard`);
  console.log(`--------------------`);
  console.log(`Dashboard:  http://localhost:${PORT}`);
  console.log(`API base:   http://localhost:${PORT}/api`);
  console.log(`Fuente de datos activa: ${process.env.DATA_SOURCE || 'local'}`);
  console.log(`Auditoría guardada en:  ${hasDatabaseConfigured() ? 'Postgres' : 'server/data/audits.json (local)'}`);
  console.log(`--------------------\n`);
});
