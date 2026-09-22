require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');
const basicAuth = require('./middleware/basicAuth');

/**
 * La app de Express en sí, SIN app.listen(). Se separa de server/index.js
 * para poder reusarla de dos formas distintas:
 *   - server/index.js la levanta con app.listen() para correr local
 *     (npm start) o en cualquier hosting con servidor persistente
 *     (Render, Railway, un VPS).
 *   - api/index.js (raíz del repo) la exporta tal cual para Vercel, que
 *     no corre servidores persistentes: envuelve esta misma app en una
 *     función serverless y le manda todos los requests (ver vercel.json).
 * El comportamiento de la app —rutas, estáticos, todo— es idéntico en
 * los dos casos.
 */
const app = express();

app.use(cors());
app.use(express.json());

// Login compartido para todo el sitio (dashboard, auditoría y API). Se
// activa solo si AUTH_USER y AUTH_PASS están configuradas — ver
// server/middleware/basicAuth.js.
app.use(basicAuth);

// API REST — esta es la capa que consumen Zoho/Chatbase (o cualquier otra
// herramienta, o un frontend distinto) sin tocar nada del resto.
app.use('/api', apiRouter);

// Dashboard estático (frontend) servido por el mismo servidor/función.
app.use(express.static(path.join(__dirname, '..', 'public')));

module.exports = app;
