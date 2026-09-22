// Punto de entrada para Vercel: exporta la app de Express tal cual,
// Vercel la corre como función serverless para cada request.
// vercel.json manda ACÁ todo lo que llega (tanto /api/* como el frontend
// estático), así la misma app.js sirve tal cual en local y en Vercel.
module.exports = require('../server/app');
