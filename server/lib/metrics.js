/**
 * Funciones puras de agregación: reciben la lista de tickets (ya
 * normalizada, venga de donde venga) y devuelven las métricas que pide
 * cada endpoint. Separarlo así permite testear las cuentas sin levantar
 * el servidor ni depender de ninguna fuente de datos en particular.
 */

const RESOLVED = new Set(['Retenido']);
const HANDOVER = new Set(['Handover - pidío humano', 'Handover - no pudo solucionar']);
const LOST = new Set(['perdido']);

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10; // 1 decimal
}

function classifyCompletion(completion) {
  if (RESOLVED.has(completion)) return 'retenido';
  if (HANDOVER.has(completion)) return 'handover';
  if (LOST.has(completion)) return 'perdido';
  return 'otro';
}

function filterTickets(tickets, { from, to, category, complexity, pending } = {}) {
  return tickets.filter((t) => {
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (category && t.topic.category !== category) return false;
    if (complexity && t.complexity !== complexity) return false;
    if (pending === 'true' || pending === true) {
      if (!isPending(t)) return false;
    }
    return true;
  });
}

// Un ticket se considera "pendiente de auditar" si todavía no se cargó
// ninguna decisión de finalización para él (típicamente: recién llegó de
// Zoho y nadie lo completó en la pantalla de Auditoría).
function isPending(t) {
  return t.completion === null || t.completion === undefined;
}

function buildSummary(tickets) {
  const total = tickets.length;
  const pending = tickets.filter(isPending).length;
  const audited = total - pending;
  const retained = tickets.filter((t) => t.retained).length;
  const answeredCorrectly = tickets.filter((t) => t.answeredCorrectly === true).length;
  const answeredWrong = tickets.filter((t) => t.answeredCorrectly === false).length;
  const hadInfo = tickets.filter((t) => t.hadInfo === true).length;
  const withError = tickets.filter((t) => t.errorType && t.errorType !== 'TU').length;

  const completionCounts = {};
  for (const t of tickets) {
    const bucket = classifyCompletion(t.completion);
    completionCounts[bucket] = (completionCounts[bucket] || 0) + 1;
  }

  const dates = tickets.map((t) => t.date).filter(Boolean).sort();

  return {
    total,
    pending,
    audited,
    // Las tasas se calculan sobre lo YA auditado, no sobre el total: si
    // conectaste Zoho en vivo vas a tener tickets recién llegados sin
    // auditar todavía, y no queremos que "diluyan" las tasas de calidad.
    retention: { count: retained, rate: pct(retained, audited) },
    answeredCorrectly: { count: answeredCorrectly, rate: pct(answeredCorrectly, audited) },
    answeredWrong: { count: answeredWrong, rate: pct(answeredWrong, audited) },
    hadInfo: { count: hadInfo, rate: pct(hadInfo, audited) },
    errorRate: { count: withError, rate: pct(withError, audited) },
    completion: {
      retenido: completionCounts.retenido || 0,
      handover: completionCounts.handover || 0,
      perdido: completionCounts.perdido || 0,
      otro: (completionCounts.otro || 0) - pending, // "otro" real, sin contar los pendientes
    },
    dateRange: { from: dates[0] || null, to: dates[dates.length - 1] || null },
  };
}

function buildTopics(tickets) {
  const byCategory = new Map();

  for (const t of tickets) {
    const key = t.topic.category || 'Sin categoría';
    if (!byCategory.has(key)) {
      byCategory.set(key, { category: key, total: 0, retained: 0, correct: 0, withError: 0, subcategories: new Map() });
    }
    const bucket = byCategory.get(key);
    bucket.total += 1;
    if (t.retained) bucket.retained += 1;
    if (t.answeredCorrectly) bucket.correct += 1;
    if (t.errorType && t.errorType !== 'TU') bucket.withError += 1;

    const subKey = t.topic.subcategory || '(general)';
    bucket.subcategories.set(subKey, (bucket.subcategories.get(subKey) || 0) + 1);
  }

  const result = [...byCategory.values()]
    .map((b) => ({
      category: b.category,
      total: b.total,
      retentionRate: pct(b.retained, b.total),
      correctRate: pct(b.correct, b.total),
      errorRate: pct(b.withError, b.total),
      topSubcategories: [...b.subcategories.entries()]
        .sort((a, b2) => b2[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    }))
    .sort((a, b) => b.total - a.total);

  return result;
}

function buildErrors(tickets) {
  const byType = new Map();
  const bySpec = new Map();
  const byTypeAndCategory = new Map();

  for (const t of tickets) {
    const type = t.errorType || 'Sin dato';
    byType.set(type, (byType.get(type) || 0) + 1);

    if (type !== 'TU') {
      const spec = t.errorSpec || 'Sin especificar';
      bySpec.set(spec, (bySpec.get(spec) || 0) + 1);

      const cat = t.topic.category || 'Sin categoría';
      const key = `${type}|${cat}`;
      byTypeAndCategory.set(key, (byTypeAndCategory.get(key) || 0) + 1);
    }
  }

  return {
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    bySpec: [...bySpec.entries()].map(([spec, count]) => ({ spec, count })).sort((a, b) => b.count - a.count),
    topErrorCategories: [...byTypeAndCategory.entries()]
      .map(([key, count]) => {
        const [type, category] = key.split('|');
        return { type, category, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

function buildComplexity(tickets) {
  const byComplexity = new Map();
  for (const t of tickets) {
    const key = t.complexity || 'Sin dato';
    if (!byComplexity.has(key)) {
      byComplexity.set(key, { complexity: key, total: 0, retained: 0 });
    }
    const bucket = byComplexity.get(key);
    bucket.total += 1;
    if (t.retained) bucket.retained += 1;
  }
  return [...byComplexity.values()].map((b) => ({
    complexity: b.complexity,
    total: b.total,
    retentionRate: pct(b.retained, b.total),
  }));
}

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  // ISO week (lunes a domingo)
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

function buildTimeseries(tickets, granularity = 'week') {
  const buckets = new Map();

  for (const t of tickets) {
    if (!t.date) continue;
    const key = granularity === 'month' ? t.date.slice(0, 7) : weekKey(t.date);
    if (!buckets.has(key)) {
      buckets.set(key, { period: key, total: 0, retained: 0, correct: 0 });
    }
    const bucket = buckets.get(key);
    bucket.total += 1;
    if (t.retained) bucket.retained += 1;
    if (t.answeredCorrectly) bucket.correct += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => (a.period > b.period ? 1 : -1))
    .map((b) => ({
      period: b.period,
      total: b.total,
      retentionRate: pct(b.retained, b.total),
      correctRate: pct(b.correct, b.total),
    }));
}

module.exports = {
  filterTickets,
  buildSummary,
  buildTopics,
  buildErrors,
  buildComplexity,
  buildTimeseries,
};
