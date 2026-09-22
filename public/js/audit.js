/* Pantalla de Auditoría.
 * Los campos base del ticket (fecha, tópico, complejidad, ticket) son
 * de solo lectura: vienen de /api/tickets, que a su vez los trae de la
 * fuente activa (local o Zoho — ver DATA_SOURCE en el servidor).
 * Los 10 campos de auditoría se arman como <select>/<textarea> a partir
 * de /api/audit-options (así, si mañana cambian las opciones de un
 * desplegable, alcanza con tocar server/config/auditOptions.js y esta
 * pantalla se actualiza sola, sin tocar HTML/JS).
 */

const API = '/api';
let AUDIT_FIELDS = {};
let allTickets = [];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

function currentFilters() {
  return {
    from: document.getElementById('fromDate').value,
    to: document.getElementById('toDate').value,
    category: document.getElementById('categorySelect').value,
    pending: document.getElementById('pendingOnly').checked ? 'true' : '',
  };
}

// --- Valor mostrado en un <select> a partir del valor guardado ---
// Los booleans (hadInfo/answeredCorrectly) se guardan como true/false/null;
// el resto de los selects guardan el string tal cual (o null = pendiente).
function toSelectValue(fieldKey, rawValue) {
  if (rawValue === null || rawValue === undefined) return '';
  if (typeof rawValue === 'boolean') return rawValue ? 'si' : 'no';
  return String(rawValue);
}

function buildHeader() {
  const row = document.getElementById('auditHeaderRow');
  const baseHeaders = ['Fecha', 'Tópico', 'Complejidad', 'Ticket'];
  const auditHeaders = Object.values(AUDIT_FIELDS).map((f) => f.label);
  row.innerHTML = [...baseHeaders, ...auditHeaders, 'Guardado']
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('');
}

function buildEditableCell(ticket, fieldKey, fieldDef) {
  const value = ticket[fieldKey];
  const cellId = `f_${ticket.id}_${fieldKey}`;

  if (fieldDef.type === 'text') {
    const safeValue = value === null || value === undefined ? '' : value;
    return `<td><textarea id="${cellId}" data-ticket="${ticket.id}" data-field="${fieldKey}" rows="1">${escapeHtml(safeValue)}</textarea></td>`;
  }

  const selected = toSelectValue(fieldKey, value);
  const options = fieldDef.options
    .map((opt) => `<option value="${escapeHtml(opt.value)}" ${opt.value === selected ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`)
    .join('');
  return `<td><select id="${cellId}" data-ticket="${ticket.id}" data-field="${fieldKey}">${options}</select></td>`;
}

function renderRows(tickets) {
  const body = document.getElementById('auditBody');
  const sorted = [...tickets].sort((a, b) => (a.date < b.date ? 1 : -1));

  body.innerHTML = sorted.map((t) => {
    const isPending = !t.completion;
    const topicLabel = [t.topic.category, t.topic.subcategory].filter(Boolean).join(' :: ') || t.topic.raw || '—';
    const ticketCell = t.ticketUrl
      ? `<a class="ticket-link" href="${escapeHtml(t.ticketUrl)}" target="_blank" rel="noopener">#${escapeHtml(t.ticket || t.id)}</a>`
      : `#${escapeHtml(t.ticket || t.id)}`;

    const editableCells = Object.entries(AUDIT_FIELDS)
      .map(([key, def]) => buildEditableCell(t, key, def))
      .join('');

    return `
      <tr data-row-ticket="${t.id}" class="${isPending ? 'row-pending' : ''}">
        <td class="readonly-cell">${escapeHtml(t.date || '—')}</td>
        <td class="readonly-cell">${escapeHtml(topicLabel)}</td>
        <td class="readonly-cell">${escapeHtml(t.complexity || '—')}</td>
        <td class="readonly-cell">${ticketCell}</td>
        ${editableCells}
        <td><span class="save-indicator" id="status_${t.id}"></span></td>
      </tr>
    `;
  }).join('');

  attachHandlers();
}

function setStatus(ticketId, state, text) {
  const el = document.getElementById(`status_${ticketId}`);
  if (!el) return;
  el.className = `save-indicator ${state}`;
  el.textContent = text;
}

async function saveField(ticketId, field, value) {
  setStatus(ticketId, 'saving', 'Guardando…');
  try {
    const res = await fetch(`${API}/tickets/${encodeURIComponent(ticketId)}/audit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) throw new Error(await res.text());
    setStatus(ticketId, 'saved', 'Guardado ✓');

    // Si cambió "Finalización" puede que la fila deba salir del filtro
    // "solo pendientes" — la actualizamos en memoria y, si corresponde,
    // la sacamos de la vista sin tener que recargar todo.
    const ticket = allTickets.find((t) => String(t.id) === String(ticketId));
    if (ticket) ticket[field] = value;
    if (field === 'completion' && document.getElementById('pendingOnly').checked && value) {
      const row = document.querySelector(`tr[data-row-ticket="${ticketId}"]`);
      if (row) row.style.opacity = '0.4';
      setTimeout(applyFiltersAndRender, 600);
    }
  } catch (err) {
    setStatus(ticketId, 'error', 'Error al guardar');
    console.error(err);
  }
}

const debouncedSaveText = debounce((ticketId, field, value) => saveField(ticketId, field, value), 700);

function attachHandlers() {
  document.querySelectorAll('#auditBody select').forEach((el) => {
    el.addEventListener('change', (e) => {
      const { ticket, field } = e.target.dataset;
      saveField(ticket, field, e.target.value);
    });
  });
  document.querySelectorAll('#auditBody textarea').forEach((el) => {
    el.addEventListener('input', (e) => {
      const { ticket, field } = e.target.dataset;
      setStatus(ticket, 'saving', 'Escribiendo…');
      debouncedSaveText(ticket, field, e.target.value);
    });
  });
}

async function loadCategories() {
  const cats = await getJSON(`${API}/categories`);
  const select = document.getElementById('categorySelect');
  const current = select.value;
  select.innerHTML = '<option value="">Todas</option>' +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = current;
}

async function loadHealth() {
  try {
    const health = await getJSON(`${API}/health`);
    document.getElementById('sourceBadge').textContent = `fuente: ${health.dataSource}`;
    if (health.dataSource === 'zoho' && health.configured === false) {
      document.getElementById('subtitle').textContent =
        'Zoho no está configurado todavía (ver .env) — usando la fuente de respaldo mientras tanto.';
    }
  } catch {
    document.getElementById('sourceBadge').textContent = 'fuente: desconocida';
  }
}

function applyFiltersAndRender() {
  const search = document.getElementById('searchInput').value.trim();
  let rows = allTickets;
  if (search) {
    rows = rows.filter((t) => String(t.ticket || '').includes(search) || String(t.id).includes(search));
  }
  document.getElementById('auditCount').textContent = `${rows.length} tickets`;
  renderRows(rows);
}

async function loadTickets() {
  const filters = currentFilters();
  const { tickets, count } = await getJSON(`${API}/tickets${qs(filters)}`);
  allTickets = tickets;
  document.getElementById('auditCount').textContent = `${count} tickets`;
  applyFiltersAndRender();
}

function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem('theme'); } catch { /* ignore */ }
  if (stored) document.documentElement.setAttribute('data-theme', stored);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
  });
}

function initFilters() {
  ['fromDate', 'toDate', 'categorySelect', 'pendingOnly'].forEach((id) => {
    document.getElementById(id).addEventListener('change', loadTickets);
  });
  document.getElementById('searchInput').addEventListener('input', debounce(applyFiltersAndRender, 250));
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('categorySelect').value = '';
    document.getElementById('searchInput').value = '';
    loadTickets();
  });
  document.getElementById('refreshBtn').addEventListener('click', loadTickets);
}

(async function init() {
  initTheme();
  initFilters();
  AUDIT_FIELDS = await getJSON(`${API}/audit-options`);
  buildHeader();
  await Promise.all([loadHealth(), loadCategories()]);
  await loadTickets();
})();
