/**
 * Autenticación HTTP Basic muy simple: un solo usuario/contraseña
 * compartido para todo el sitio (dashboard, auditoría y API).
 *
 * Por qué así y no la "Password Protection" nativa de Vercel: esa función
 * es de pago en la mayoría de los planes (Hobby incluido). Esto en cambio
 * es código propio, funciona en cualquier plan y en cualquier hosting
 * (Vercel, Render, tu compu), y no depende de nada externo.
 *
 * Cómo se activa: seteando AUTH_USER y AUTH_PASS como variables de
 * entorno. Si CUALQUIERA de las dos falta, el middleware no exige nada
 * (así npm start sigue funcionando sin login mientras estás developando
 * local, a menos que vos mismo pongas esas variables en tu .env también).
 *
 * Es intencionalmente básico (un solo usuario para todo el equipo, sin
 * altas/bajas de usuarios individuales). Si más adelante hace falta que
 * cada persona tenga su propio login, hay que reemplazar esto por un
 * sistema de autenticación real (por ejemplo con sesiones + una tabla de
 * usuarios en la misma base Postgres que ya está conectada).
 */
function basicAuth(req, res, next) {
  const user = process.env.AUTH_USER;
  const pass = process.env.AUTH_PASS;

  // Sin credenciales configuradas: no se exige login (permite correr
  // local sin fricción). En producción, definí AUTH_USER/AUTH_PASS.
  if (!user || !pass) return next();

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    } catch {
      decoded = '';
    }
    const separatorIndex = decoded.indexOf(':');
    const providedUser = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
    const providedPass = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

    if (providedUser === user && providedPass === pass) {
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Bot Audit Dashboard"');
  return res.status(401).send('Autenticación requerida.');
}

module.exports = basicAuth;
