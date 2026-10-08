// ─────────────────────────────────────────────────────────────
// Query log. db.js records every statement it runs here:
//   { id, at, kind: 'read'|'write', label, sql, tables, rowsScanned,
//     scannedByTable, rowsReturned, index, scan, ms, useIndexes,
//     plan: { optimized, unoptimized }, primary, replay(useIndexes) }
// The Query Inspector and the DB Lab subscribe to it (through
// api/client.js — UI code never imports this file directly).
// ─────────────────────────────────────────────────────────────

const MAX_ENTRIES = 50;
const entries = [];
const listeners = new Set();
let nextId = 1;

export function record(entry) {
  const e = { id: nextId++, at: Date.now(), ...entry };
  entries.unshift(e);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  for (const fn of listeners) {
    try {
      fn(e);
    } catch (err) {
      console.error('queryLog listener failed', err);
    }
  }
  return e;
}

export function history(limit = 20) {
  return entries.slice(0, limit);
}

// Most recent entry the current screen cares about. Secondary queries
// (e.g. the per-page credibility lookup) are skipped unless asked for.
export function latest({ primaryOnly = true } = {}) {
  return entries.find((e) => !primaryOnly || e.primary !== false) || null;
}

export function getById(id) {
  return entries.find((e) => e.id === id) || null;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clear() {
  entries.length = 0;
}

// ── Plan trees ───────────────────────────────────────────────
// Relational-algebra plans for the Inspector's plan diagram.
// Node: { op, label, access?, children: [] }
//   op: 'τ' sort/limit · 'γ' group · 'σ' select · 'π' project
//       '⋈' join · '⟕' left outer join · 'scan' base relation
//
// optimized   — selections pushed below the joins, onto the scan
// unoptimized — join everything first, then filter (the naive tree)
export function buildPlan({ project, base, access, filters = [], joins = [], group, having, order, limit }) {
  const scan = (label, acc) => ({ op: 'scan', label, access: acc, children: [] });
  const sel = (conds, child) => (conds.length ? { op: 'σ', label: conds.join(' ∧ '), children: [child] } : child);

  const wrapTop = (node, optimizedAccess) => {
    let n = node;
    if (group) n = { op: 'γ', label: group + (having ? ` · HAVING ${having}` : ''), children: [n] };
    if (order || limit) n = { op: 'τ', label: [order && `ORDER BY ${order}`, limit && `LIMIT ${limit}`].filter(Boolean).join(' · '), children: [n] };
    if (project) n = { op: 'π', label: project, children: [n] };
    return n;
  };

  // Optimized: σ sits directly on each relation it constrains.
  let opt = sel(filters, scan(base, access));
  for (const j of joins) {
    const right = sel(j.filters || [], scan(j.table, j.access || 'Seq Scan'));
    opt = { op: j.outer ? '⟕' : '⋈', label: j.on, children: [opt, right] };
  }

  // Unoptimized: every join over full scans, then one big σ.
  let naive = scan(base, 'Seq Scan (full table)');
  for (const j of joins) {
    naive = { op: j.outer ? '⟕' : '⋈', label: j.on, children: [naive, scan(j.table, 'Seq Scan')] };
  }
  naive = sel([...filters, ...joins.flatMap((j) => j.filters || [])], naive);

  return { optimized: wrapTop(opt), unoptimized: wrapTop(naive) };
}
