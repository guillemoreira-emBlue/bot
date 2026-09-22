# Bot Audit Dashboard

App de auditoría del bot: trae los tickets automáticamente desde Zoho (o,
mientras tanto, desde tu planilla de Google Sheets ya importada), y te deja
auditar cada uno con desplegables — sin tocar una fila del código. Es una
app real: un servidor (Node/Express) con una API REST propia, un frontend
que la consume, y una capa de datos separada del resto, para que cambiar de
"planilla" a "Zoho en vivo" sea una variable de entorno y no una reescritura.

## 1. Probarlo en tu máquina (sin publicar nada)

Requisito: [Node.js](https://nodejs.org/) 18 o superior instalado.

```bash
cd bot-audit-dashboard
npm install
npm start
```

Abrí **http://localhost:3000** en el navegador. Eso es todo — corre 100% en
tu compu, no hace falta subir nada a ningún hosting para verlo funcionando.

Para desarrollo con recarga automática al guardar cambios:

```bash
npm run dev
```

## 2. Dos pantallas: Dashboard y Auditoría

**`index.html` — Dashboard** (solo lectura, para ver el panorama):
- **KPIs**: tickets totales, pendientes de auditar, % de retención (se
  resolvió sin escalar a un humano), % de respuestas correctas, % con error.
- **Evolución semanal**: volumen de tickets y tasa de retención en el tiempo.
- **Finalización de chats**: Retenido vs Handover vs Perdido.
- **Tipos de error**: Error 1/2/3, error de plataforma, etc. (excluye "TU" =
  sin error, para enfocarse en lo que hay que corregir).
- **Tópicos más consultados**: ranking de categorías con más tickets.

Las tasas (retención, correctas, error) se calculan sobre lo **ya auditado**,
no sobre el total, para que los tickets recién llegados de Zoho sin auditar
todavía no distorsionen los números.

**`audit.html` — Auditoría** (el trabajo día a día del equipo, botón "📝
Auditar tickets" en el dashboard): una fila por ticket con los datos base
de solo lectura (fecha, tópico, complejidad, ticket — automáticos, vienen de
la fuente activa) y, al lado, un desplegable por cada campo que audita una
persona:

`Tenía la info para responder?` · `Respondió correctamente?` · `Tipo de Error`
· `Finalización` · `Retenido` · `Especificación del error` · `Improved`
· `Audit ok?` — como desplegable, y `Notas` / `Coments` como texto libre.

Cada cambio se guarda solo (no hay botón "Guardar"): al tocar un desplegable
se guarda al instante, al escribir en Notas/Coments se guarda medio segundo
después de dejar de tipear. El indicador de la última columna muestra
"Guardando…" / "Guardado ✓" / "Error al guardar" por fila. El checkbox
"Mostrar solo pendientes de auditar" filtra a los tickets que todavía no
tienen `Finalización` cargada — pensado para trabajar la cola de auditoría
sin tener que revisar de nuevo lo ya hecho.

Los filtros de fecha y categoría afectan tanto al dashboard como a la
auditoría, porque ambos consumen los mismos endpoints con los mismos
parámetros.

## 3. La API (para conectar cualquier otra cosa)

Todo vive bajo `/api`. Podés probarla directo en la terminal:

```bash
curl http://localhost:3000/api/summary
curl http://localhost:3000/api/topics
curl http://localhost:3000/api/errors
curl "http://localhost:3000/api/tickets?category=Login%20v2&from=2025-08-01"
```

| Endpoint | Qué devuelve |
|---|---|
| `GET /api/health` | Estado y fuente de datos activa |
| `GET /api/tickets` | Lista de tickets, base + auditoría ya combinadas (filtrable) |
| `PUT /api/tickets/:id/audit` | Guarda uno o más campos de auditoría de un ticket |
| `GET /api/audit-options` | Las opciones de cada desplegable de auditoría |
| `GET /api/summary` | KPIs generales |
| `GET /api/topics` | Ranking de categorías/tópicos |
| `GET /api/errors` | Desglose de tipos de error |
| `GET /api/complexity` | Desglose por complejidad |
| `GET /api/timeseries?granularity=week\|month` | Evolución en el tiempo |
| `GET /api/categories` | Lista de categorías (para poblar filtros) |

Los endpoints de lectura aceptan los mismos filtros por query string: `from`,
`to` (fechas `YYYY-MM-DD`), `category`, `complexity`, y `pending=true` para
traer solo los tickets sin auditar todavía.

Ejemplo de auditar un ticket por API (así es exactamente lo que hace
`audit.html` al tocar un desplegable). El `:id` es el campo `id` que
devuelve `/api/tickets` para ese ticket (con la fuente local son ids tipo
`t-1`; con Zoho es el id interno del ticket, no el número que ve el
cliente):

```bash
curl -X PUT http://localhost:3000/api/tickets/t-1/audit \
  -H "Content-Type: application/json" \
  -d '{"hadInfo": "si", "answeredCorrectly": "si", "completion": "Retenido", "retained": "true"}'
```

## 4. Conectar Zoho como fuente de datos en vivo

Esta es la pieza clave de esta versión: **los datos base del ticket** (fecha,
tópico/categoría, complejidad si la tenés como campo personalizado, número
de ticket, link) **se traen automáticamente de Zoho** — vos no cargás nada
de eso a mano. Lo único manual es la auditoría (los 10 campos con
desplegable), y esa auditoría se guarda en esta app, no en Zoho, así que no
depende de que crees campos nuevos en Zoho para arrancar.

Pasos para activarlo:

1. En Zoho, generá credenciales OAuth de tipo "Self Client" (o Server-based
   app) con scope de Zoho Desk. Vas a obtener: Client ID, Client Secret, y
   con esos dos generás un Refresh Token. Guía oficial:
   https://desk.zoho.com/DeskAPIDocument#OauthRequest
2. Copiá `.env.example` a `.env`.
3. Completá `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`,
   `ZOHO_ORG_ID` (el orgId de tu cuenta de Zoho Desk) y `ZOHO_DC` (el
   datacenter: `com`, `eu`, `in`, etc., según dónde esté tu cuenta).
4. Si el tópico/categoría de tus tickets vive en un campo personalizado con
   otro nombre (no el estándar `category`/`subCategory` de Zoho Desk), o si
   registrás la complejidad en un campo personalizado, completá
   `ZOHO_FIELD_CATEGORY`, `ZOHO_FIELD_SUBCATEGORY` y `ZOHO_FIELD_COMPLEXITY`
   con el nombre exacto de esos campos (API name) — sin tocar código.
5. Poné `DATA_SOURCE=zoho` en `.env`.
6. Reiniciá el servidor (`npm start`) y abrí `audit.html`: deberías ver los
   tickets de Zoho apareciendo automáticamente, todos como "pendientes de
   auditar" hasta que alguien complete los desplegables.

`server/datasources/zohoDataSource.js` ya trae el flujo completo: autenticación
OAuth con refresh automático del token, paginación (trae todos los tickets,
no solo los primeros 100), y el mapeo a los campos base. Si algo en tu cuenta
de Zoho tiene un nombre distinto al esperado, ese archivo es el único lugar
que hay que tocar.

**Próximo paso, no incluido todavía:** si más adelante querés que la
auditoría viva en Zoho también (por ejemplo como campos personalizados del
ticket) en vez de en `server/data/audits.json`, se agrega una función
`pushAuditToZoho()` en ese mismo archivo que haga un `PATCH` al ticket
después de cada `PUT /api/tickets/:id/audit` — la estructura ya está lista
para eso, solo falta que existan esos campos en tu Zoho y decidir los
nombres.

Para Chatbase el mismo patrón está en `server/datasources/chatbaseDataSource.js`
con `DATA_SOURCE=chatbase`. Ojo: Chatbase te da conversaciones/mensajes, no
tópico/complejidad — la nota dentro de ese archivo explica las opciones.

Ninguna ruta de `server/routes/api.js`, ninguna función de
`server/lib/metrics.js`, la lógica de auditoría, ni una sola línea del
frontend necesitan cambiar cuando hacés este switch. Esa es la idea de tener
la fuente de datos separada del resto de la app.

## 5. Publicarlo con GitHub + Vercel

Mientras solo lo estés probando vos, no hace falta publicar nada. Cuando
quieras que el equipo lo vea por internet, estos son los pasos.

### 5.1. Subir el código a GitHub

Si la carpeta todavía no es un repo git:

```bash
cd bot-audit-dashboard
git init
git add .
git commit -m "Bot audit dashboard"
```

Creá un repo vacío en GitHub (botón "New" en github.com/new, sin marcar
ningún checkbox de inicialización) y conectalo:

```bash
git remote add origin https://github.com/TU-USUARIO/bot-audit-dashboard.git
git branch -M main
git push -u origin main
```

### 5.2. Importarlo en Vercel

En vercel.com (o en la pantalla "Import Git Repository" que ya tenías
abierta): elegí tu cuenta/organización de GitHub, buscá el repo
`bot-audit-dashboard` y tocá **Import**. Vercel detecta el `vercel.json` del
proyecto solo — no hace falta tocar el framework preset ni el build command.
Antes de darle **Deploy**, cargá las variables de entorno que necesites
(las mismas de tu `.env`): como mínimo `DATA_SOURCE`, y si vas a conectar
Zoho ya desde el arranque, también `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` /
`ZOHO_REFRESH_TOKEN` / `ZOHO_ORG_ID` / `ZOHO_DC`. Después tocá **Deploy**.

### 5.3. Conectar la base de datos para que la Auditoría guarde de verdad

Esto es importante: **sin este paso, el Dashboard va a andar perfecto, pero
`audit.html` no va a guardar los cambios de forma confiable**, porque Vercel
no tiene un disco persistente donde guardar `audits.json` como en tu
compu. La app ya está preparada para esto — solo hay que conectar la base:

1. En el proyecto ya desplegado en Vercel, andá a la pestaña **Storage**.
2. **Create Database** → elegí **Postgres** (hoy Vercel lo provisiona vía
   Neon, del Marketplace) → seguí el asistente.
3. **Connect to Project** → elegí este proyecto. Esto agrega automáticamente
   las variables de entorno de conexión (`DATABASE_URL` y similares) al
   proyecto — no hace falta copiarlas a mano.
4. Volvé a la pestaña **Deployments** y hacé **Redeploy** del último deploy
   (para que la función tome las variables nuevas).

A partir de ahí, `server/lib/auditStore/index.js` detecta solo que hay una
base conectada y empieza a guardar cada auditoría ahí (crea la tabla
`bot_audit_records` sola, la primera vez que alguien audita un ticket). Tu
compu, mientras tanto, sigue usando `server/data/audits.json` sin que
tengas que cambiar nada — el switch es automático según si esa variable de
entorno existe o no.

### 5.4. Protegerlo con usuario y contraseña

Por defecto la URL de Vercel queda pública: cualquiera con el link entra al
dashboard y a la auditoría. Para pedir login antes de mostrar nada (todo el
sitio, incluida la API), la app ya trae un login simple compartido —
`server/middleware/basicAuth.js` — que se activa solo con dos variables de
entorno:

1. En Vercel: **Settings → Environment Variables** del proyecto.
2. Agregá `AUTH_USER` (el usuario que van a usar) y `AUTH_PASS` (la
   contraseña) — elegí valores propios, no hace falta que coincidan con tu
   cuenta de GitHub ni de Vercel.
3. **Deployments** → Redeploy del último deploy.

A partir de ahí, al entrar a la URL el navegador va a mostrar el cuadro de
login típico del sistema (usuario/contraseña) antes de dejar ver nada. Es un
único usuario compartido para todo el equipo — alcanza para que no quede
abierto a cualquiera de internet, pero no distingue quién audita cada
ticket (eso ya se ve por separado en cada fila, en la fecha `updatedAt` que
guarda cada auditoría).

Corriendo local (`npm start`) esto NO pide login a menos que vos mismo
completes `AUTH_USER` y `AUTH_PASS` en tu `.env` — si las dejás vacías,
sigue andando como hasta ahora.

### 5.5. Actualizaciones después del primer deploy

Cualquier `git push` a la rama `main` dispara un deploy nuevo solo. Para
correr localmente después de bajar cambios: `git pull && npm install`.

### Alternativa: otro hosting con disco persistente

Si preferís no usar Postgres, esta misma app corre tal cual (sin ningún
cambio, `audits.json` incluido) en cualquier hosting que mantenga un
servidor Node prendido con disco persistente: Render, Railway, un VPS
propio. Ahí el comando de arranque es el de siempre, `npm start` — no usan
`vercel.json` ni la carpeta `api/`, esos son específicos de Vercel.

## 6. Estructura del proyecto

```
bot-audit-dashboard/
├── api/
│   └── index.js                    entrypoint de Vercel (exporta server/app.js)
├── vercel.json                     manda /api/* al entrypoint de arriba
├── server/
│   ├── app.js                      la app de Express (rutas + estáticos, sin listen)
│   ├── index.js                    la levanta con app.listen() para correr local
│   ├── routes/api.js               endpoints /api/*
│   ├── middleware/basicAuth.js     login compartido (AUTH_USER/AUTH_PASS)
│   ├── config/auditOptions.js      opciones de cada desplegable de auditoría
│   ├── lib/
│   │   ├── metrics.js              cálculos (retención, errores, etc.)
│   │   └── auditStore/
│   │       ├── index.js            fachada: sanitiza, mergea, elige backend
│   │       ├── localBackend.js     guarda en server/data/audits.json (local)
│   │       └── postgresBackend.js  guarda en Postgres (Vercel, vía Neon)
│   ├── datasources/
│   │   ├── index.js                elige la fuente según DATA_SOURCE
│   │   ├── schema.js               forma común de un "ticket"
│   │   ├── localDataSource.js      lee server/data/tickets.json
│   │   ├── zohoDataSource.js       conector Zoho (trae tickets en vivo)
│   │   └── chatbaseDataSource.js   conector Chatbase (a completar)
│   └── data/
│       ├── tickets.json            datos base importados de tu Google Sheet
│       └── audits.json             auditoría manual guardada localmente (se crea sola)
├── public/
│   ├── index.html / js/dashboard.js   Dashboard (solo lectura)
│   ├── audit.html / js/audit.js       Auditoría (desplegables, guarda solo)
│   └── css/style.css                  estilos compartidos
├── .env.example
└── package.json
```

`server/app.js` es la app en sí (rutas, middlewares, estáticos) sin
`app.listen()`. Se usa de dos formas: `server/index.js` la levanta con
`app.listen()` para correr local o en un hosting con servidor persistente;
`api/index.js` la exporta tal cual para que Vercel la corra como función
serverless (ver punto 5). El comportamiento es idéntico en los dos casos —
no hay lógica duplicada.

## 7. Actualizar los datos locales

Si mientras tanto seguís auditando en la misma planilla y querés refrescar
`server/data/tickets.json` sin conectar Zoho todavía, exportá la hoja como
CSV/JSON y reemplazá ese archivo respetando el esquema descripto en
`server/datasources/schema.js`. La auditoría cargada desde `audit.html`
vive aparte, en `server/data/audits.json`, así que no se pisa al actualizar
`tickets.json`.
