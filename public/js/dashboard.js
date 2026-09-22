/* Dashboard de Auditoría del Bot
 * Todo lo que ves acá viene de /api/* — no hay datos embebidos en el HTML.
 * Cuando conectes Zoho o Chatbase como fuente (ver README.md), este archivo
 * no necesita cambios: sigue pegándole a los mismos endpoints.
 */

const API = '/api';

const palette = {
  series1: getVar('--series-1'),
  series2: getVar('--series-2'),
  series3: getVar('--series-3'),
  series4: getVar('--series-4'),
  series5: getVar('--series-5'),
  series6: getVar('--series-6'),
  series7: getVar('--series-7'),
  series8: getVar('--series-8'),
  good: getVar('--good'),
  critical: getVar('--critical'),
  muted: getVar('--text-muted'),
  grid: getVar('--gridline'),
  text: getVar('--text-secondary'),
};

function getVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
    complexity: document.getElementById('complexitySelect').value,
  };
}

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

let charts = {};

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
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
  } catch {
    document.getElementById('sourceBadge').textContent = 'fuente: desconocida';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function pillFor(value, kind) {
  if (value === null || value === undefined) return `<span class="pill pill-neutral">—</span>`;
  if (kind === 'bool') {
    return value
      ? `<span class="pill pill-good">Sí</span>`
      : `<span class="pill pill-bad">No</span>`;
  }
  return escapeHtml(value);
}

async function refreshSummary(filters) {
  const summary = await getJSON(`${API}/summary${qs(filters)}`);
  document.getElementById('kpiTotal').textContent = summary.total;
  document.getElementById('kpiRange').textContent = summary.dateRange.from
    ? `${summary.dateRange.from} → ${summary.dateRange.to}`
    : 'sin datos';
  document.getElementById('kpiPending').textContent = summary.pending;
  document.getElementById('kpiPendingCard').classList.toggle('row-pending', summary.pending > 0);
  document.getElementById('kpiRetention').textContent = `${summary.retention.rate}%`;
  document.getElementById('kpiCorrect').textContent = `${summary.answeredCorrectly.rate}%`;
  document.getElementById('kpiCorrectSub').textContent =
    `${summary.answeredCorrectly.count} de ${summary.audited} auditados`;
  document.getElementById('kpiError').textContent = `${summary.errorRate.rate}%`;

  renderCompletionChart(summary.completion);
}

function renderCompletionChart(completion) {
  const ctx = document.getElementById('completionChart');
  destroyChart('completion');
  const labels = ['Retenido', 'Handover', 'Perdido', 'Otro'];
  const data = [completion.retenido, completion.handover, completion.perdido, completion.otro];
  const colors = [palette.good, palette.series4, palette.critical, palette.muted];

  charts.completion = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: getVar('--surface-1'), borderWidth: 2 }],
    },
    options: {
      plugins: { legend: { display: false } },
      cutout: '65%',
    },
  });

  const legend = document.getElementById('completionLegend');
  legend.innerHTML = labels
    .map((l, i) => `<span><span class="dot" style="background:${colors[i]}"></span>${l}: ${data[i]}</span>`)
    .join('');
}

async function refreshTimeseries(filters) {
  const series = await getJSON(`${API}/timeseries${qs({ ...filters, granularity: 'week' })}`);
  const ctx = document.getElementById('timeseriesChart');
  destroyChart('timeseries');

  charts.timeseries = new Chart(ctx, {
    type: 'line',
    data: {
      labels: series.map((s) => s.period),
      datasets: [
        {
          label: 'Volumen',
          data: series.map((s) => s.total),
          borderColor: palette.series1,
          backgroundColor: palette.series1,
          yAxisID: 'y',
          tension: 0.25,
          pointRadius: 3,
          borderWidth: 2,
        },
        {
          label: '% Retención',
          data: series.map((s) => s.retentionRate),
          borderColor: palette.series3,
          backgroundColor: palette.series3,
          yAxisID: 'y1',
          tension: 0.25,
          pointRadius: 3,
          borderWidth: 2,
        },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: palette.grid }, ticks: { color: palette.text } },
        y: {
          position: 'left',
          title: { display: true, text: 'Tickets', color: palette.text },
          grid: { color: palette.grid },
          ticks: { color: palette.text },
        },
        y1: {
          position: 'right',
          title: { display: true, text: '% Retención', color: palette.text },
          grid: { display: false },
          ticks: { color: palette.text },
          min: 0,
          max: 100,
        },
      },
    },
  });

  document.getElementById('tsLegend').innerHTML = `
    <span><span class="dot" style="background:${palette.series1}"></span>Volumen</span>
    <span><span class="dot" style="background:${palette.series3}"></span>% Retención</span>`;
}

async function refreshErrors(filters) {
  const errors = await getJSON(`${API}/errors${qs(filters)}`);
  const ctx = document.getElementById('errorChart');
  destroyChart('errors');

  // Excluimos "TU" (sin error) del gráfico para enfocarnos en lo que hay que arreglar.
  const rows = errors.byType.filter((e) => e.type !== 'TU');
  const seriesColors = [palette.series2, palette.series4, palette.series5, palette.series7, palette.series8, palette.series6];

  charts.errors = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.type),
      datasets: [{
        data: rows.map((r) => r.count),
        backgroundColor: rows.map((_, i) => seriesColors[i % seriesColors.length]),
        borderRadius: 4,
        maxBarThickness: 40,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: palette.text } },
        y: { grid: { color: palette.grid }, ticks: { color: palette.text, precision: 0 } },
      },
    },
  });
}

async function refreshTopics(filters) {
  const topics = await getJSON(`${API}/topics${qs(filters)}`);
  const ctx = document.getElementById('topicsChart');
  destroyChart('topics');

  const top = topics.slice(0, 8);

  charts.topics = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map((t) => t.category),
      datasets: [{
        label: 'Tickets',
        data: top.map((t) => t.total),
        backgroundColor: palette.series1,
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: palette.grid }, ticks: { color: palette.text, precision: 0 } },
        y: { grid: { display: false }, ticks: { color: palette.text } },
      },
    },
  });
}

async function refreshTable(filters) {
  const { tickets, count } = await getJSON(`${API}/tickets${qs(filters)}`);
  document.getElementById('tableCount').textContent = `${count} tickets`;
  const body = document.getElementById('ticketsBody');
  const sorted = [...tickets].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 200);

  body.innerHTML = sorted.map((t) => `
    <tr>
      <td>${escapeHtml(t.date || '—')}</td>
      <td>${escapeHtml(t.topic.category || '—')}</td>
      <td>${escapeHtml(t.complexity || '—')}</td>
      <td>${t.ticket ? `#${escapeHtml(t.ticket)}` : '—'}</td>
      <td>${pillFor(t.hadInfo, 'bool')}</td>
      <td>${pillFor(t.answeredCorrectly, 'bool')}</td>
      <td>${escapeHtml(t.completion || '—')}</td>
      <td>${escapeHtml(t.errorType || '—')}</td>
    </tr>
  `).join('');
}

async function refreshAll() {
  const filters = currentFilters();
  await Promise.all([
    refreshSummary(filters),
    refreshTimeseries(filters),
    refreshErrors(filters),
    refreshTopics(filters),
    refreshTable(filters),
  ]);
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
    // Re-read CSS vars (palette) and redraw charts with the new theme's colors.
    Object.assign(palette, {
      series1: getVar('--series-1'), series2: getVar('--series-2'), series3: getVar('--series-3'),
      series4: getVar('--series-4'), series5: getVar('--series-5'), series6: getVar('--series-6'),
      series7: getVar('--series-7'), series8: getVar('--series-8'), good: getVar('--good'),
      critical: getVar('--critical'), muted: getVar('--text-muted'), grid: getVar('--gridline'),
      text: getVar('--text-secondary'),
    });
    refreshAll();
  });
}

function initFilters() {
  ['fromDate', 'toDate', 'categorySelect', 'complexitySelect'].forEach((id) => {
    document.getElementById(id).addEventListener('change', refreshAll);
  });
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('categorySelect').value = '';
    document.getElementById('complexitySelect').value = '';
    refreshAll();
  });
  document.getElementById('refreshBtn').addEventListener('click', refreshAll);
}

(async function init() {
  initTheme();
  initFilters();
  await Promise.all([loadHealth(), loadCategories()]);
  await refreshAll();
})();
