// ─────────────────────────────────────────────────────────────
// The fake relational database.
//
//  • Tables are arrays of rows shaped exactly like the DDL (schema.js).
//  • Every write is checked against NOT NULL, VARCHAR length, CHECK,
//    PRIMARY KEY, UNIQUE and FOREIGN KEY constraints, and throws a
//    DbError the UI shows verbatim.
//  • Secondary indexes are real Maps (key → ids). With useIndexes off,
//    the same queries fall back to full-table scans.
//  • credibility_score is never stored; vw_student_credibility computes
//    AVG(Rating.score) over a student's materials on every read.
//  • Every statement is recorded in queryLog.js with its SQL, plan,
//    rows scanned/returned, index used and elapsed time.
//
// Only api/client.js may import this file.
// ─────────────────────────────────────────────────────────────
import { FOREIGN_KEYS, INDEXES, TABLES, TABLE_NAMES, UNIQUE_KEYS } from './schema.js';
import { SUBJECT_CATALOGUE, buildSeed, isoDaysAgo } from './seed.js';
import * as queryLog from './queryLog.js';

const STORAGE_KEY = 'studyswap.db';
const INDEX_FLAG_KEY = 'studyswap.useIndexes';
const FORMAT_VERSION = 1;

// Every heap row a query touches costs this many microseconds, so the
// timing gap between an index scan and a full scan mirrors a disk-backed
// database. Set to 0 to see raw in-memory timings (both near zero).
export const SIMULATED_ROW_READ_US = 25;

// Above this fraction of the table the planner prefers a seq scan over
// many index probes — the same trade-off a real optimizer makes.
const INDEX_SELECTIVITY_CUTOFF = 0.3;

export class DbError extends Error {
  // code: 'CHECK' | 'FOREIGN_KEY' | 'UNIQUE' | 'PRIMARY_KEY' | 'NOT_NULL'
  //       | 'LENGTH' | 'TYPE' | 'DERIVED' | 'UNKNOWN_COLUMN' | 'NOT_FOUND' | 'RULE' | 'AUTH'
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'DbError';
    this.code = code;
    Object.assign(this, extra);
  }
}

// ── Storage ──────────────────────────────────────────────────
let state = null; // { version, seededAt, tables, auth }
const pk = {}; // table → Map(id → row)
const index = {}; // index name → Map(key → id[])
const emailIndex = new Map(); // UNIQUE(Student.email) — always used, like a real unique index
let useIndexes = readIndexFlag();

function readIndexFlag() {
  try {
    const v = localStorage.getItem(INDEX_FLAG_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === FORMAT_VERSION) {
        state = parsed;
        const added = addMissingSubjects();
        rebuildIndexes();
        if (added) persist();
        return;
      }
    }
  } catch {
    /* corrupt or unavailable storage — reseed */
  }
  reseed();
}

// Subjects added to the catalogue after this browser was seeded are
// inserted into the stored copy, so nobody loses their data to get them.
function addMissingSubjects() {
  const have = new Set(state.tables.Subject.map((r) => r.subject_id));
  const missing = SUBJECT_CATALOGUE.filter((r) => !have.has(r.subject_id));
  if (missing.length) state.tables.Subject.push(...structuredClone(missing));
  return missing.length;
}

// Re-seed every table. Accounts registered through the app are carried
// across (their materials and requests are not), so a reset never locks
// anyone out of the app they just signed up for.
function reseed({ keepAccounts = true } = {}) {
  const previous = state;
  const seed = buildSeed(new Date());
  if (keepAccounts && previous) {
    const seededMax = seed.tables.Student.reduce((m, r) => Math.max(m, r.student_id), 0);
    for (const extra of previous.tables.Student.filter((r) => r.student_id > seededMax)) {
      seed.tables.Student.push(structuredClone(extra));
      if (previous.auth[extra.student_id]) seed.auth[extra.student_id] = previous.auth[extra.student_id];
    }
  }
  state = { version: FORMAT_VERSION, seededAt: seed.seededAt, tables: seed.tables, auth: seed.auth };
  rebuildIndexes();
  persist();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — keep working in memory */
  }
}

function ensure() {
  if (!state) load();
}

function rebuildIndexes() {
  for (const t of TABLE_NAMES) {
    const key = TABLES[t].pk;
    pk[t] = new Map(state.tables[t].map((r) => [r[key], r]));
  }
  for (const ix of INDEXES) {
    const map = new Map();
    const key = TABLES[ix.table].pk;
    for (const r of state.tables[ix.table]) {
      const k = r[ix.column];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r[key]);
    }
    index[ix.name] = map;
  }
  emailIndex.clear();
  for (const s of state.tables.Student) emailIndex.set(s.email.toLowerCase(), s.student_id);
}

const today = () => isoDaysAgo(0);
const round2 = (x) => Math.round(x * 100) / 100;
const clone = (v) => (v === undefined ? v : structuredClone(v));

// ── Execution context ────────────────────────────────────────
function spin(rows) {
  if (!SIMULATED_ROW_READ_US || !rows) return;
  const until = performance.now() + (rows * SIMULATED_ROW_READ_US) / 1000;
  while (performance.now() < until) {
    /* simulated heap-page reads */
  }
}

class Exec {
  constructor(indexesOn) {
    this.indexes = indexesOn;
    this.scanned = {};
    this.access = {};
    this.used = [];
  }
  charge(table, n, how) {
    this.scanned[table] = (this.scanned[table] || 0) + n;
    if (!this.access[table] || how.startsWith('Seq')) this.access[table] = how;
    spin(n);
  }
  // Full table scan.
  seq(table) {
    const rows = state.tables[table];
    this.charge(table, rows.length, 'Seq Scan');
    return rows;
  }
  // Index probe: ids for keys, then heap fetch of just those rows.
  probe(indexName, keys) {
    const ids = [];
    for (const k of keys) {
      const hit = index[indexName].get(k);
      if (hit) ids.push(...hit);
    }
    if (!this.used.includes(indexName)) this.used.push(indexName);
    return ids;
  }
  fetch(table, ids, how) {
    this.charge(table, ids.length, how);
    return ids.map((id) => pk[table].get(id)).filter(Boolean);
  }
  lookup(indexName, keys) {
    const ix = INDEXES.find((i) => i.name === indexName);
    return this.fetch(ix.table, this.probe(indexName, keys), `Index Scan (${indexName})`);
  }
  // Primary-key lookup.
  get(table, id) {
    this.charge(table, 1, 'Index Scan (pk)');
    return pk[table].get(id) || null;
  }
  get rowsScanned() {
    return Object.values(this.scanned).reduce((a, b) => a + b, 0);
  }
}

function statsOf(x, ms, base, rowsReturned) {
  const baseIdx = x.used.filter((n) => INDEXES.find((i) => i.name === n)?.table === base);
  return {
    rowsScanned: x.rowsScanned,
    scannedByTable: { ...x.scanned },
    accessByTable: { ...x.access },
    rowsReturned,
    index: baseIdx.length ? baseIdx.join(' + ') : null,
    indexesUsed: [...x.used],
    scan: baseIdx.length ? `Index Scan (${baseIdx.join(' + ')})` : 'Seq Scan (full table)',
    ms: Math.round(ms * 1000) / 1000,
  };
}

const countOf = (r) => (Array.isArray(r) ? r.length : Array.isArray(r?.rows) ? r.rows.length : r == null ? 0 : 1);

// Reads inside background() are logged as secondary, so a sidebar badge
// refreshing itself never replaces the screen's query in the Inspector.
let backgroundDepth = 0;
export function background(fn) {
  backgroundDepth++;
  try {
    return fn();
  } finally {
    backgroundDepth--;
  }
}

// Run a read query, log it, return its result.
function read({ label, sql, tables, base = tables[0], plan, primary: primaryArg = true }, run) {
  ensure();
  const primary = primaryArg && backgroundDepth === 0;
  const exec = (flag) => {
    const x = new Exec(flag);
    const t0 = performance.now();
    const result = run(x);
    const ms = performance.now() - t0;
    return { result, stats: statsOf(x, ms, base, countOf(result)) };
  };
  const { result, stats } = exec(useIndexes);
  queryLog.record({
    kind: 'read',
    label,
    sql,
    tables,
    plan,
    primary,
    useIndexes,
    ...stats,
    // Re-run the identical query with indexes on or off (Inspector toggle).
    replay: (flag) => exec(flag).stats,
  });
  return clone(result);
}

// Run a write inside a transaction: all-or-nothing, then persist + log.
function write({ label, sql, tables }, fn) {
  ensure();
  const snapshot = JSON.stringify(state.tables);
  const t0 = performance.now();
  let result;
  try {
    result = fn();
  } catch (err) {
    state.tables = JSON.parse(snapshot);
    rebuildIndexes();
    queryLog.record({ kind: 'write', label, sql: typeof sql === 'function' ? sql(null) : sql, tables, error: err.message, primary: false, rowsScanned: 0, rowsReturned: 0, ms: round2(performance.now() - t0), scan: 'ROLLBACK', index: null });
    throw err;
  }
  rebuildIndexes();
  persist();
  queryLog.record({
    kind: 'write',
    label,
    sql: typeof sql === 'function' ? sql(result) : sql,
    tables,
    primary: false,
    rowsScanned: 0,
    rowsReturned: countOf(result),
    ms: round2(performance.now() - t0),
    scan: 'COMMIT',
    index: null,
  });
  return clone(result);
}

// ── SQL text helpers ─────────────────────────────────────────
export function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}
const list = (arr) => arr.map(lit).join(', ');
const inOrEq = (col, arr) => (arr.length === 1 ? `${col} = ${lit(arr[0])}` : `${col} IN (${list(arr)})`);

// ── Constraint enforcement ───────────────────────────────────
function nextId(table) {
  const key = TABLES[table].pk;
  return state.tables[table].reduce((m, r) => Math.max(m, r[key]), 0) + 1;
}

// Validates and normalises a row. Throws DbError on the first violation.
// `existing` is the current row for UPDATEs.
function checkRow(table, input, existing = null) {
  const def = TABLES[table];
  if (!def) throw new DbError('NOT_FOUND', `Table does not exist: ${table}`);
  const known = new Set(def.columns.map((c) => c.name).concat('_ui'));
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      throw new DbError('UNKNOWN_COLUMN', `Unknown column: ${table}.${key}`, {
        table,
        column: key,
        detail: `${table} has no column "${key}". Related data lives in its own table and is reached by a JOIN.`,
      });
    }
  }

  const row = existing ? { ...existing, ...input } : { ...input };
  const pkCol = def.pk;

  for (const col of def.columns) {
    const name = col.name;
    const where = `${table}.${name}`;
    let v = row[name];

    if (col.derived) {
      if (input[name] !== undefined && input[name] !== null) {
        throw new DbError('DERIVED', `Cannot write derived column: ${where}`, {
          table,
          column: name,
          detail: 'credibility_score is computed as AVG(Rating.score) by vw_student_credibility on every read.',
        });
      }
      delete row[name];
      continue;
    }

    if (col.pk) {
      if (existing) {
        if (input[name] !== undefined && input[name] !== existing[name]) {
          throw new DbError('PRIMARY_KEY', `Cannot change primary key: ${where}`, { table, column: name });
        }
        continue;
      }
      if (v === undefined || v === null || v === '') {
        row[name] = nextId(table);
        continue;
      }
    }

    if ((v === undefined || v === '') && col.default && !existing) {
      v = row[name] = col.default === 'CURRENT_DATE' ? today() : col.default.replace(/'/g, '');
    }
    if (typeof v === 'string' && col.type === 'VARCHAR') v = row[name] = v.trim();
    if (v === '' || v === undefined) v = row[name] = null; // empty string is treated as NULL

    if (v === null) {
      if (col.notNull) {
        throw new DbError('NOT_NULL', `NOT NULL constraint violated: ${where}`, { table, column: name, detail: `${name} is required.` });
      }
      continue;
    }

    // Types
    if (col.type === 'INT') {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (!Number.isInteger(n)) {
        throw new DbError('TYPE', `Type error: ${where} expects INT`, { table, column: name, detail: `Got ${JSON.stringify(v)}.` });
      }
      v = row[name] = n;
    } else if (col.type === 'DATE') {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        throw new DbError('TYPE', `Type error: ${where} expects DATE (YYYY-MM-DD)`, { table, column: name, detail: `Got ${JSON.stringify(v)}.` });
      }
    } else if (col.type === 'VARCHAR') {
      v = row[name] = String(v);
      if (v.length > col.length) {
        throw new DbError('LENGTH', `Value too long for VARCHAR(${col.length}): ${where}`, {
          table,
          column: name,
          detail: `${v.length} characters; the column holds at most ${col.length}.`,
        });
      }
    }

    // CHECK
    const c = col.check;
    if (c) {
      let ok = true;
      let cond = '';
      if (c.in) {
        ok = c.in.includes(v);
        cond = `${name} IN (${list(c.in)})`;
      } else if (c.min !== undefined) {
        ok = v >= c.min && v <= c.max;
        cond = `${name} BETWEEN ${c.min} AND ${c.max}`;
      } else if (c.endsWith) {
        ok = v.toLowerCase().endsWith(c.endsWith);
        cond = `${name} LIKE '%${c.endsWith}'`;
      } else if (c.notBefore) {
        ok = row[c.notBefore] == null || v >= row[c.notBefore];
        cond = `${name} >= ${c.notBefore}`;
      }
      if (!ok) {
        throw new DbError('CHECK', `CHECK constraint violated: ${name}`, { table, column: name, detail: `${cond} — got ${lit(v)}.` });
      }
    }

    // Single-column UNIQUE (Student.email, case-insensitive)
    if (col.unique) {
      const owner = table === 'Student' && name === 'email' ? emailIndex.get(v.toLowerCase()) : state.tables[table].find((r) => r[name] === v)?.[pkCol];
      if (owner !== undefined && owner !== row[pkCol]) {
        throw new DbError('UNIQUE', `UNIQUE constraint violated: ${where}`, { table, column: name, detail: `${lit(v)} is already registered.` });
      }
    }
  }

  // PRIMARY KEY uniqueness on insert
  if (!existing && pk[table].has(row[pkCol])) {
    throw new DbError('PRIMARY_KEY', `PRIMARY KEY violation: ${table}.${pkCol}`, { table, column: pkCol, detail: `${pkCol} = ${row[pkCol]} already exists.` });
  }

  // FOREIGN KEYS
  for (const fk of FOREIGN_KEYS.filter((f) => f.table === table)) {
    const v = row[fk.column];
    if (v !== null && v !== undefined && !pk[fk.references].has(v)) {
      throw new DbError('FOREIGN_KEY', `FOREIGN KEY violation: ${table}.${fk.column}`, {
        table,
        column: fk.column,
        detail: `${fk.column} = ${lit(v)} is not present in ${fk.references}(${fk.refColumn}).`,
      });
    }
  }

  // Composite UNIQUE
  for (const uq of UNIQUE_KEYS.filter((u) => u.table === table)) {
    const clash = state.tables[table].find((r) => r[pkCol] !== row[pkCol] && uq.columns.every((c) => r[c] === row[c]));
    if (clash) {
      throw new DbError('UNIQUE', `UNIQUE constraint violated: ${uq.name}`, {
        table,
        column: uq.columns.join(', '),
        detail: `(${uq.columns.join(', ')}) = (${uq.columns.map((c) => lit(row[c])).join(', ')}) already exists.`,
      });
    }
  }

  return row;
}

function insertRow(table, input) {
  const row = checkRow(table, input);
  state.tables[table].push(row);
  pk[table].set(row[TABLES[table].pk], row);
  if (table === 'Student') emailIndex.set(row.email.toLowerCase(), row.student_id);
  return row;
}

function updateRow(table, id, patch) {
  const existing = pk[table].get(id);
  if (!existing) throw new DbError('NOT_FOUND', `No ${table} row with ${TABLES[table].pk} = ${id}`);
  const next = checkRow(table, patch, existing);
  Object.assign(existing, next);
  return existing;
}

function deleteRow(table, id) {
  const key = TABLES[table].pk;
  // ON DELETE RESTRICT: refuse while any child row references this one.
  const refs = FOREIGN_KEYS.filter((f) => f.references === table)
    .map((f) => ({ table: f.table, column: f.column, count: state.tables[f.table].filter((r) => r[f.column] === id).length }))
    .filter((r) => r.count > 0);
  if (refs.length) {
    const first = refs[0];
    throw new DbError('FOREIGN_KEY', `FOREIGN KEY violation: ${first.table}.${first.column}`, {
      table,
      refs,
      detail: `${key} ${id} is still referenced by ${refs.map((r) => `${r.count} ${r.table} row${r.count === 1 ? '' : 's'}`).join(' and ')}.`,
    });
  }
  const i = state.tables[table].findIndex((r) => r[key] === id);
  if (i < 0) throw new DbError('NOT_FOUND', `No ${table} row with ${key} = ${id}`);
  state.tables[table].splice(i, 1);
  pk[table].delete(id);
}

const rule = (message, detail) => new DbError('RULE', message, { detail });

// ── Shared query pieces ──────────────────────────────────────
// Hash-join build side for the small dimension tables.
function subjectMap(x) {
  return new Map(x.seq('Subject').map((s) => [s.subject_id, s]));
}
function studentMap(x) {
  return new Map(x.seq('Student').map((s) => [s.student_id, s]));
}

// Rating aggregate per material: { sum, count, dist[1..5], subs }.
// Uses idx_rating_material for selective sets, a seq scan otherwise.
function ratingAgg(x, materialIds) {
  const ids = materialIds === null ? null : new Set(materialIds);
  let ratings;
  if (x.indexes && ids && ids.size <= state.tables.Material.length * INDEX_SELECTIVITY_CUTOFF) {
    ratings = x.lookup('idx_rating_material', [...ids]);
  } else {
    ratings = x.seq('Rating').filter((r) => !ids || ids.has(r.material_id));
  }
  const agg = new Map();
  for (const r of ratings) {
    let a = agg.get(r.material_id);
    if (!a) agg.set(r.material_id, (a = { sum: 0, count: 0, dist: [0, 0, 0, 0, 0], subs: { completeness: 0, legibility: 0, accuracy: 0 }, subCount: 0, recent: 0 }));
    a.sum += r.score;
    a.count += 1;
    a.dist[r.score - 1] += 1;
    if (r._ui?.completeness) {
      a.subs.completeness += r._ui.completeness;
      a.subs.legibility += r._ui.legibility;
      a.subs.accuracy += r._ui.accuracy;
      a.subCount += 1;
    }
  }
  return agg;
}

function requestAgg(x, materialIds, sinceDate = null) {
  const ids = materialIds === null ? null : new Set(materialIds);
  let reqs;
  if (x.indexes && ids && ids.size <= state.tables.Material.length * INDEX_SELECTIVITY_CUTOFF) {
    reqs = x.lookup('idx_request_material', [...ids]);
  } else {
    reqs = x.seq('Swap_Request').filter((r) => !ids || ids.has(r.material_id));
  }
  const agg = new Map();
  for (const r of reqs) {
    if (sinceDate && r.request_date < sinceDate) continue;
    agg.set(r.material_id, (agg.get(r.material_id) || 0) + 1);
  }
  return agg;
}

// vw_student_credibility. studentIds = null → every student.
function credibilityOf(x, studentIds = null) {
  const out = new Map();
  const want = studentIds === null ? null : new Set(studentIds);
  let uploaderOf;
  let ratings;
  if (x.indexes && want && want.size <= 12) {
    const mats = x.lookup('idx_material_uploader', [...want]);
    uploaderOf = new Map(mats.map((m) => [m.material_id, m.uploaded_by]));
    ratings = x.lookup('idx_rating_material', [...uploaderOf.keys()]);
  } else {
    uploaderOf = new Map(x.seq('Material').map((m) => [m.material_id, m.uploaded_by]));
    ratings = x.seq('Rating');
  }
  for (const r of ratings) {
    const sid = uploaderOf.get(r.material_id);
    if (sid === undefined || (want && !want.has(sid))) continue;
    const a = out.get(sid) || { sum: 0, count: 0 };
    a.sum += r.score;
    a.count += 1;
    out.set(sid, a);
  }
  const result = new Map();
  for (const sid of want || state.tables.Student.map((s) => s.student_id)) {
    const a = out.get(sid);
    result.set(sid, { student_id: sid, credibility_score: a ? round2(a.sum / a.count) : null, rating_count: a ? a.count : 0 });
  }
  return result;
}

const publicStudent = (s, cred) => ({
  student_id: s.student_id,
  name: s.name,
  email: s.email,
  department: s.department,
  semester: s.semester,
  credibility_score: cred?.credibility_score ?? null,
  rating_count: cred?.rating_count ?? 0,
  _ui: s._ui,
});

const publicSubject = (s) => ({ subject_id: s.subject_id, subject_name: s.subject_name, department: s.department, semester: s.semester, code: s._ui?.code });

// Material joined to Subject, uploader and its rating aggregate.
function materialView(m, subjects, students, agg, creds, reqAgg) {
  const a = agg?.get(m.material_id);
  const uploader = students.get(m.uploaded_by);
  return {
    ...m,
    subject: publicSubject(subjects.get(m.subject_id)),
    uploader: uploader ? publicStudent(uploader, creds?.get(m.uploaded_by)) : null,
    avg_rating: a ? round2(a.sum / a.count) : null,
    rating_count: a ? a.count : 0,
    request_count: reqAgg ? reqAgg.get(m.material_id) || 0 : undefined,
  };
}

const MATERIAL_SELECT = `SELECT m.material_id, m.title, m.material_type, m.upload_date,
       s.subject_name, st.name AS uploader,
       ROUND(AVG(r.score), 2) AS avg_rating, COUNT(r.rating_id) AS rating_count`;
const MATERIAL_FROM = `FROM Material m
JOIN Subject s     ON m.subject_id  = s.subject_id
JOIN Student st    ON m.uploaded_by = st.student_id
LEFT JOIN Rating r ON r.material_id = m.material_id`;
const MATERIAL_GROUP = 'GROUP BY m.material_id, s.subject_name, st.name';

// Credibility for the uploaders on a result page — its own small query,
// the way the real app would batch it.
function attachUploaderCredibility(rows) {
  const ids = [...new Set(rows.map((r) => r.uploaded_by))];
  if (!ids.length) return rows;
  const creds = read(
    {
      label: 'Uploader credibility for this page',
      sql: `SELECT student_id, credibility_score, rating_count\nFROM vw_student_credibility\nWHERE ${inOrEq('student_id', ids)};`,
      tables: ['Student', 'Material', 'Rating'],
      base: 'Material',
      primary: false,
    },
    (x) => [...credibilityOf(x, ids).values()]
  );
  const byId = new Map(creds.map((c) => [c.student_id, c]));
  for (const r of rows) {
    if (r.uploader) {
      r.uploader.credibility_score = byId.get(r.uploaded_by)?.credibility_score ?? null;
      r.uploader.rating_count = byId.get(r.uploaded_by)?.rating_count ?? 0;
    }
  }
  return rows;
}

// ── Title similarity (duplicate detection, §7.7) ─────────────
function bigrams(s) {
  const t = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const out = new Map();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}
export function titleSimilarity(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  for (const [g, n] of A) {
    inter += Math.min(n, B.get(g) || 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

// ══════════════════════════════════════════════════════════════
// Public API (called only by api/client.js)
// ══════════════════════════════════════════════════════════════

// ── Views ────────────────────────────────────────────────────
export const views = {
  vw_student_credibility(studentId = null) {
    const ids = studentId === null ? null : [studentId];
    const rows = read(
      {
        label: 'vw_student_credibility',
        sql: `SELECT student_id, credibility_score, rating_count\nFROM vw_student_credibility${ids ? `\nWHERE student_id = ${studentId}` : ''};`,
        tables: ['Student', 'Material', 'Rating'],
        base: 'Material',
        plan: queryLog.buildPlan({
          project: 'student_id, ROUND(AVG(r.score), 2), COUNT(r.rating_id)',
          base: 'Material m',
          access: useIndexes && ids ? 'Index Scan (idx_material_uploader)' : 'Seq Scan (full table)',
          filters: ids ? [`m.uploaded_by = ${studentId}`] : [],
          joins: [{ table: 'Rating r', on: 'r.material_id = m.material_id', outer: true, access: useIndexes && ids ? 'Index Scan (idx_rating_material)' : 'Seq Scan' }],
          group: 'GROUP BY m.uploaded_by',
        }),
      },
      (x) => [...credibilityOf(x, ids).values()]
    );
    return studentId === null ? rows : rows[0];
  },
};

// ── Auth (prototype-only credential store) ───────────────────
export const auth = {
  verify(email, password) {
    const e = String(email || '').trim().toLowerCase();
    const id = read(
      { label: 'Sign in', sql: `SELECT student_id FROM Student\nWHERE email = ${lit(e)};  -- UNIQUE index on email`, tables: ['Student'], primary: false },
      (x) => {
        x.charge('Student', 1, 'Index Scan (Student_email_key)');
        return emailIndex.get(e) ?? null;
      }
    );
    // A prototype for a demo, not a public login: saying which half is wrong
    // is more useful here than hiding whether an account exists.
    if (id === null) {
      throw new DbError('AUTH', 'No account is registered with that email.', {
        detail: 'Check the address, create an account, or use one of the demo accounts above.',
      });
    }
    if (state.auth[id] !== password) {
      throw new DbError('AUTH', 'That password does not match this account.', { detail: 'Seeded demo accounts all use the password shown below the field.' });
    }
    return students.getById(id);
  },

  register({ name, email, department, semester, password }) {
    if (!password || password.length < 8) throw rule('Password must be at least 8 characters.');
    const row = write(
      {
        label: 'Register student',
        tables: ['Student'],
        sql: (r) =>
          `INSERT INTO Student (student_id, name, email, department, semester)\nVALUES (${r ? r.student_id : 'DEFAULT'}, ${lit(name)}, ${lit(email)}, ${lit(department)}, ${lit(Number(semester))});`,
      },
      () => {
        const r = insertRow('Student', {
          name,
          email: String(email || '').trim().toLowerCase(),
          department,
          semester,
          _ui: { reg_no: null, joined: today() },
        });
        state.auth[r.student_id] = password;
        return r;
      }
    );
    return students.getById(row.student_id);
  },

  emailTaken(email) {
    const e = String(email || '').trim().toLowerCase();
    return read(
      { label: 'Check email is unique', sql: `SELECT 1 FROM Student\nWHERE email = ${lit(e)};`, tables: ['Student'], primary: false },
      (x) => {
        x.charge('Student', 1, 'Index Scan (Student_email_key)');
        return emailIndex.has(e);
      }
    );
  },
};

// ── Students ─────────────────────────────────────────────────
export const students = {
  getById(id) {
    const row = read(
      {
        label: 'Student profile',
        sql: `SELECT st.*, c.credibility_score, c.rating_count\nFROM Student st\nLEFT JOIN vw_student_credibility c ON c.student_id = st.student_id\nWHERE st.student_id = ${lit(id)};`,
        tables: ['Student', 'Material', 'Rating'],
        base: 'Material',
      },
      (x) => {
        const s = x.get('Student', id);
        return s ? publicStudent(s, credibilityOf(x, [id]).get(id)) : null;
      }
    );
    if (!row) throw new DbError('NOT_FOUND', `No Student row with student_id = ${id}`);
    return row;
  },

  credibility(id) {
    return views.vw_student_credibility(id);
  },

  // Aggregates for the dashboard and profile stat rows.
  stats(id) {
    return read(
      {
        label: 'Student activity summary',
        sql: `SELECT
  (SELECT COUNT(*) FROM Material WHERE uploaded_by = ${id})                         AS uploads,
  (SELECT COUNT(*) FROM Swap_Request sr JOIN Material m ON sr.material_id = m.material_id
     WHERE m.uploaded_by = ${id} AND sr.status = 'Pending')                         AS pending_incoming,
  (SELECT COUNT(*) FROM Swap_Request WHERE requester_id = ${id} AND status = 'Completed')
                                                                                   AS swaps_completed,
  (SELECT COUNT(*) FROM Rating WHERE rated_by = ${id})                              AS ratings_given;`,
        tables: ['Material', 'Swap_Request', 'Rating'],
        base: 'Material',
      },
      (x) => {
        const mats = x.indexes ? x.lookup('idx_material_uploader', [id]) : x.seq('Material').filter((m) => m.uploaded_by === id);
        const matIds = new Set(mats.map((m) => m.material_id));
        const incoming = x.indexes ? x.lookup('idx_request_material', [...matIds]) : x.seq('Swap_Request').filter((r) => matIds.has(r.material_id));
        const outgoing = x.indexes ? x.lookup('idx_request_requester', [id]) : x.seq('Swap_Request').filter((r) => r.requester_id === id);
        const given = x.seq('Rating').filter((r) => r.rated_by === id).length;
        const cred = credibilityOf(x, [id]).get(id);
        const responded = incoming.filter((r) => r.status !== 'Pending');
        const accepted = responded.filter((r) => r.status === 'Accepted' || r.status === 'Completed');
        return {
          student_id: id,
          uploads: mats.length,
          ratings_received: cred.rating_count,
          credibility_score: cred.credibility_score,
          ratings_given: given,
          pending_incoming: incoming.filter((r) => r.status === 'Pending').length,
          pending_outgoing: outgoing.filter((r) => r.status === 'Pending').length,
          accepted_outgoing: outgoing.filter((r) => r.status === 'Accepted').length,
          swaps_completed: outgoing.filter((r) => r.status === 'Completed').length + incoming.filter((r) => r.status === 'Completed').length,
          acceptance_rate: responded.length ? round2(accepted.length / responded.length) : null,
        };
      }
    );
  },

  // Credibility at the end of each of the last `months` months (cumulative).
  credibilityTrend(id, months = 6) {
    return read(
      {
        label: 'Credibility trend',
        sql: `SELECT DATE_TRUNC('month', r.rating_date) AS month,
       ROUND(AVG(r.score) OVER (ORDER BY r.rating_date), 2) AS credibility_score
FROM Rating r
JOIN Material m ON r.material_id = m.material_id
WHERE m.uploaded_by = ${id}
ORDER BY month;`,
        tables: ['Rating', 'Material'],
        base: 'Material',
      },
      (x) => {
        const mats = x.indexes ? x.lookup('idx_material_uploader', [id]) : x.seq('Material').filter((m) => m.uploaded_by === id);
        const ids = mats.map((m) => m.material_id);
        const ratings = (x.indexes ? x.lookup('idx_rating_material', ids) : x.seq('Rating').filter((r) => ids.includes(r.material_id))).sort((a, b) =>
          a.rating_date.localeCompare(b.rating_date)
        );
        const out = [];
        const now = new Date();
        for (let k = months - 1; k >= 0; k--) {
          const end = new Date(now.getFullYear(), now.getMonth() - k + 1, 0);
          const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
          const upto = ratings.filter((r) => r.rating_date <= endIso);
          out.push({
            month: endIso.slice(0, 7),
            credibility_score: upto.length ? round2(upto.reduce((s, r) => s + r.score, 0) / upto.length) : null,
            rating_count: upto.length,
          });
        }
        return out;
      }
    );
  },

  // Ranked by credibility; HAVING rating_count >= minRatings keeps a
  // single 5★ from topping the table (same bar as the Trusted tier).
  leaderboard({ department = null, limit = 50, minRatings = 5 } = {}) {
    return read(
      {
        label: 'Leaderboard',
        sql: `SELECT st.student_id, st.name, st.department,
       c.credibility_score, c.rating_count, COUNT(m.material_id) AS upload_count
FROM Student st
JOIN vw_student_credibility c ON c.student_id = st.student_id
JOIN Material m               ON m.uploaded_by = st.student_id${department ? `\nWHERE st.department = ${lit(department)}` : ''}
GROUP BY st.student_id, st.name, st.department, c.credibility_score, c.rating_count
HAVING c.rating_count >= ${minRatings}
ORDER BY c.credibility_score DESC, c.rating_count DESC
LIMIT ${limit};`,
        tables: ['Student', 'Material', 'Rating'],
        base: 'Material',
      },
      (x) => {
        const creds = credibilityOf(x, null);
        const uploads = new Map();
        for (const m of state.tables.Material) uploads.set(m.uploaded_by, (uploads.get(m.uploaded_by) || 0) + 1); // same Material scan as the view
        return x
          .seq('Student')
          .filter((s) => (!department || s.department === department) && uploads.get(s.student_id))
          .map((s) => ({ ...publicStudent(s, creds.get(s.student_id)), upload_count: uploads.get(s.student_id) }))
          .filter((s) => s.rating_count >= minRatings)
          .sort((a, b) => (b.credibility_score ?? -1) - (a.credibility_score ?? -1) || b.rating_count - a.rating_count)
          .slice(0, limit)
          .map((r, i) => ({ rank: i + 1, ...r }));
      }
    );
  },

  departmentLeaderboard() {
    return read(
      {
        label: 'Department ranking',
        sql: `SELECT st.department,
       ROUND(AVG(r.score), 2)       AS avg_score,
       COUNT(DISTINCT m.material_id) AS materials,
       COUNT(r.rating_id)            AS ratings
FROM Student st
JOIN Material m    ON m.uploaded_by = st.student_id
LEFT JOIN Rating r ON r.material_id = m.material_id
GROUP BY st.department
ORDER BY avg_score DESC;`,
        tables: ['Student', 'Material', 'Rating'],
        base: 'Material',
      },
      (x) => {
        const studs = studentMap(x);
        const mats = x.seq('Material');
        const agg = ratingAgg(x, null);
        const out = new Map();
        for (const m of mats) {
          const dept = studs.get(m.uploaded_by)?.department;
          const d = out.get(dept) || { department: dept, sum: 0, ratings: 0, materials: 0 };
          const a = agg.get(m.material_id);
          d.materials += 1;
          if (a) {
            d.sum += a.sum;
            d.ratings += a.count;
          }
          out.set(dept, d);
        }
        return [...out.values()]
          .map((d) => ({ department: d.department, avg_score: d.ratings ? round2(d.sum / d.ratings) : null, materials: d.materials, ratings: d.ratings }))
          .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0));
      }
    );
  },
};

// ── Subjects ─────────────────────────────────────────────────
export const subjects = {
  list() {
    return read(
      {
        label: 'Subjects with material counts',
        sql: `SELECT s.*, COUNT(m.material_id) AS material_count
FROM Subject s
LEFT JOIN Material m ON m.subject_id = s.subject_id
GROUP BY s.subject_id
ORDER BY s.department, s.semester, s.subject_name;`,
        tables: ['Subject', 'Material'],
        base: 'Material',
        primary: false,
      },
      (x) => {
        const subs = x.seq('Subject');
        return subs
          .map((s) => ({
            ...publicSubject(s),
            // idx_material_subject already holds the per-subject id lists.
            material_count: x.indexes ? (x.probe('idx_material_subject', [s.subject_id]).length) : x.seq('Material').filter((m) => m.subject_id === s.subject_id).length,
          }))
          .sort((a, b) => a.department.localeCompare(b.department) || a.semester - b.semester || a.subject_name.localeCompare(b.subject_name));
      }
    );
  },

  // Add a subject that is not in the catalogue yet (Upload screen).
  create({ subject_name, department, semester }) {
    return write(
      {
        label: 'Insert subject',
        tables: ['Subject'],
        sql: (r) =>
          `INSERT INTO Subject (subject_id, subject_name, department, semester)
VALUES (${r ? r.subject_id : 'DEFAULT'}, ${lit(subject_name)}, ${lit(department)}, ${lit(Number(semester))});`,
      },
      () =>
        insertRow('Subject', {
          subject_name,
          department,
          semester: semester === '' || semester == null ? null : Number(semester),
          _ui: { code: null, added_by_user: true },
        })
    );
  },

  byDepartment(department) {
    return read(
      {
        label: 'Subjects by department',
        sql: `SELECT * FROM Subject\nWHERE department = ${lit(department)}\nORDER BY semester, subject_name;`,
        tables: ['Subject'],
        primary: false,
      },
      (x) => x.seq('Subject').filter((s) => s.department === department).map(publicSubject)
    );
  },
};

// ── Materials ────────────────────────────────────────────────
const SORTS = {
  newest: { sql: 'm.upload_date DESC, m.material_id DESC', cmp: (a, b) => b.upload_date.localeCompare(a.upload_date) || b.material_id - a.material_id },
  rating: { sql: 'avg_rating DESC NULLS LAST, rating_count DESC', cmp: (a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1) || b.rating_count - a.rating_count },
  requested: { sql: 'request_count DESC, avg_rating DESC', cmp: (a, b) => b.request_count - a.request_count || (b.avg_rating ?? -1) - (a.avg_rating ?? -1) },
  credibility: {
    sql: 'c.credibility_score DESC NULLS LAST, avg_rating DESC',
    cmp: (a, b) => (b.uploader?.credibility_score ?? -1) - (a.uploader?.credibility_score ?? -1) || (b.avg_rating ?? -1) - (a.avg_rating ?? -1),
  },
};
export const SORT_KEYS = Object.keys(SORTS);

function asArray(v) {
  if (v === null || v === undefined || v === '') return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => x !== '' && x !== null && x !== undefined);
}

export const materials = {
  // Browse & search (§4.5).
  //   subjectId: id | id[]      type: 'Notes' | string[]     minRating: 0–5
  //   q: title substring        semester: 1–8                minCredibility: 0–5
  //   dateFrom / dateTo: 'YYYY-MM-DD'    sort: newest|rating|requested|credibility
  //   page (1-based), pageSize, excludeUploader: student_id
  browse(params = {}) {
    const subjectIds = asArray(params.subjectId).map(Number);
    const types = asArray(params.type);
    const minRating = Number(params.minRating) || 0;
    const q = String(params.q || '').trim();
    const semester = params.semester ? Number(params.semester) : null;
    const minCred = Number(params.minCredibility) || 0;
    const { dateFrom = null, dateTo = null, excludeUploader = null } = params;
    const sortKey = SORTS[params.sort] ? params.sort : 'newest';
    const pageSize = Math.max(1, Number(params.pageSize) || 12);
    const page = Math.max(1, Number(params.page) || 1);
    const needCred = sortKey === 'credibility' || minCred > 0;
    const needReq = sortKey === 'requested' || sortKey === 'requested_week';

    const where = [];
    if (subjectIds.length) where.push(inOrEq('m.subject_id', subjectIds));
    if (types.length) where.push(inOrEq('m.material_type', types));
    if (q) where.push(`LOWER(m.title) LIKE ${lit(`%${q.toLowerCase()}%`)}`);
    if (dateFrom) where.push(`m.upload_date >= ${lit(dateFrom)}`);
    if (dateTo) where.push(`m.upload_date <= ${lit(dateTo)}`);
    if (excludeUploader) where.push(`m.uploaded_by <> ${lit(Number(excludeUploader))}`);
    const subjWhere = semester ? [`s.semester = ${semester}`] : [];
    const credWhere = minCred ? [`c.credibility_score >= ${minCred}`] : [];
    const allWhere = [...where, ...subjWhere, ...credWhere];

    const sql = [
      needReq ? `${MATERIAL_SELECT},\n       COUNT(DISTINCT sr.request_id) AS request_count` : MATERIAL_SELECT,
      MATERIAL_FROM +
        (needReq ? `\nLEFT JOIN Swap_Request sr ON sr.material_id = m.material_id${sortKey === 'requested_week' ? ` AND sr.request_date >= ${lit(isoDaysAgo(7))}` : ''}` : '') +
        (needCred ? '\nJOIN vw_student_credibility c ON c.student_id = m.uploaded_by' : ''),
      allWhere.length ? `WHERE ${allWhere.join('\n  AND ')}` : null,
      MATERIAL_GROUP + (needCred ? ', c.credibility_score' : ''),
      minRating ? `HAVING AVG(r.score) >= ${minRating}` : null,
      `ORDER BY ${SORTS[sortKey].sql}`,
      `LIMIT ${pageSize}${page > 1 ? ` OFFSET ${(page - 1) * pageSize}` : ''};`,
    ]
      .filter(Boolean)
      .join('\n');

    const indexable = subjectIds.length || types.length;
    const idxNames = [subjectIds.length && 'idx_material_subject', types.length && 'idx_material_type'].filter(Boolean);
    const joins = [
      { table: 'Subject s', on: 'm.subject_id = s.subject_id', filters: subjWhere },
      { table: 'Student st', on: 'm.uploaded_by = st.student_id' },
      { table: 'Rating r', on: 'r.material_id = m.material_id', outer: true, access: useIndexes && indexable ? 'Index Scan (idx_rating_material)' : 'Seq Scan' },
    ];
    if (needReq) joins.push({ table: 'Swap_Request sr', on: 'sr.material_id = m.material_id', outer: true });
    if (needCred) joins.push({ table: 'vw_student_credibility c', on: 'c.student_id = m.uploaded_by', filters: credWhere });

    const plan = queryLog.buildPlan({
      project: 'm.material_id, m.title, s.subject_name, st.name, avg_rating',
      base: 'Material m',
      access: useIndexes && indexable ? `Index Scan (${idxNames.join(' + ')})` : 'Seq Scan (full table)',
      filters: where.map((w) => w.replace(/^m\./, '').replace(/ AND m\./g, ' AND ')),
      joins,
      group: 'GROUP BY m.material_id · AVG(r.score)',
      having: minRating ? `AVG(r.score) ≥ ${minRating}` : null,
      order: SORTS[sortKey].sql,
      limit: pageSize,
    });

    const tables = ['Material', 'Subject', 'Student', 'Rating', ...(needReq ? ['Swap_Request'] : [])];

    const result = read({ label: 'Browse materials', sql, tables, base: 'Material', plan }, (x) => {
      // 1. Access path for Material
      let rows;
      if (x.indexes && indexable) {
        let ids = null;
        if (subjectIds.length) ids = new Set(x.probe('idx_material_subject', subjectIds));
        if (types.length) {
          const t = x.probe('idx_material_type', types);
          ids = ids ? new Set(t.filter((id) => ids.has(id))) : new Set(t);
        }
        rows = x.fetch('Material', [...ids], `Index Scan (${idxNames.join(' + ')})`);
      } else {
        rows = x.seq('Material').filter((m) => (!subjectIds.length || subjectIds.includes(m.subject_id)) && (!types.length || types.includes(m.material_type)));
      }
      // 2. Residual predicates (no index can serve LIKE '%…%')
      const ql = q.toLowerCase();
      rows = rows.filter(
        (m) =>
          (!ql || m.title.toLowerCase().includes(ql)) &&
          (!dateFrom || m.upload_date >= dateFrom) &&
          (!dateTo || m.upload_date <= dateTo) &&
          (!excludeUploader || m.uploaded_by !== Number(excludeUploader))
      );
      // 3. Joins
      const subs = subjectMap(x);
      const studs = studentMap(x);
      if (semester) rows = rows.filter((m) => subs.get(m.subject_id)?.semester === semester);
      const ids = rows.map((m) => m.material_id);
      const agg = ratingAgg(x, ids);
      const reqAgg = needReq ? requestAgg(x, ids, sortKey === 'requested_week' ? isoDaysAgo(7) : null) : null;
      const creds = needCred ? credibilityOf(x, [...new Set(rows.map((m) => m.uploaded_by))]) : null;
      let out = rows.map((m) => materialView(m, subs, studs, agg, creds, reqAgg));
      // 4. HAVING and credibility filter
      if (minRating) out = out.filter((m) => (m.avg_rating ?? 0) >= minRating);
      if (minCred) out = out.filter((m) => (m.uploader?.credibility_score ?? 0) >= minCred);
      // 5. ORDER BY / LIMIT
      out.sort(SORTS[sortKey].cmp);
      const total = out.length;
      return { rows: out.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
    });

    if (!needCred) attachUploaderCredibility(result.rows);
    const entry = queryLog.latest();
    return { ...result, ms: entry?.ms ?? null, queryId: entry?.id ?? null };
  },

  getById(id, { viewerId = null } = {}) {
    const m = read(
      {
        label: 'Material detail',
        sql: `${MATERIAL_SELECT},
       st.department AS uploader_department
${MATERIAL_FROM}
WHERE m.material_id = ${lit(id)}
${MATERIAL_GROUP}, st.department;`,
        tables: ['Material', 'Subject', 'Student', 'Rating'],
        base: 'Material',
        plan: queryLog.buildPlan({
          project: 'm.*, s.subject_name, st.name, AVG(r.score)',
          base: 'Material m',
          access: 'Index Scan (pk)',
          filters: [`material_id = ${id}`],
          joins: [
            { table: 'Subject s', on: 'm.subject_id = s.subject_id', access: 'Index Scan (pk)' },
            { table: 'Student st', on: 'm.uploaded_by = st.student_id', access: 'Index Scan (pk)' },
            { table: 'Rating r', on: 'r.material_id = m.material_id', outer: true, access: useIndexes ? 'Index Scan (idx_rating_material)' : 'Seq Scan' },
          ],
          group: 'GROUP BY m.material_id',
        }),
      },
      (x) => {
        const row = x.get('Material', Number(id));
        if (!row) return null;
        const subs = new Map([[row.subject_id, x.get('Subject', row.subject_id)]]);
        const studs = new Map([[row.uploaded_by, x.get('Student', row.uploaded_by)]]);
        const agg = ratingAgg(x, [row.material_id]);
        const reqAgg = requestAgg(x, [row.material_id]);
        const view = materialView(row, subs, studs, agg, null, reqAgg);
        const a = agg.get(row.material_id);
        view.distribution = a ? [...a.dist].reverse() : [0, 0, 0, 0, 0]; // [5★ … 1★]
        view.sub_scores = a?.subCount
          ? {
              completeness: round2(a.subs.completeness / a.subCount),
              legibility: round2(a.subs.legibility / a.subCount),
              accuracy: round2(a.subs.accuracy / a.subCount),
            }
          : null;
        return view;
      }
    );
    if (!m) throw new DbError('NOT_FOUND', `No Material row with material_id = ${id}`);
    attachUploaderCredibility([m]);
    if (viewerId !== null) {
      const existing = requests.latestFor(m.material_id, viewerId);
      m.viewer = {
        is_uploader: m.uploaded_by === viewerId,
        request: existing,
        has_rated: ratings.hasRated(m.material_id, viewerId),
      };
    }
    return m;
  },

  byUploader(studentId, { limit = null, excludeId = null } = {}) {
    const rows = read(
      {
        label: 'Materials by uploader',
        sql: `${MATERIAL_SELECT},
       COUNT(DISTINCT sr.request_id) AS request_count
${MATERIAL_FROM}
LEFT JOIN Swap_Request sr ON sr.material_id = m.material_id
WHERE m.uploaded_by = ${lit(studentId)}${excludeId ? ` AND m.material_id <> ${excludeId}` : ''}
${MATERIAL_GROUP}
ORDER BY m.upload_date DESC${limit ? `\nLIMIT ${limit}` : ''};`,
        tables: ['Material', 'Subject', 'Student', 'Rating', 'Swap_Request'],
        base: 'Material',
      },
      (x) => {
        let mats = x.indexes ? x.lookup('idx_material_uploader', [studentId]) : x.seq('Material').filter((m) => m.uploaded_by === studentId);
        if (excludeId) mats = mats.filter((m) => m.material_id !== excludeId);
        const subs = subjectMap(x);
        const studs = studentMap(x);
        const ids = mats.map((m) => m.material_id);
        const agg = ratingAgg(x, ids);
        const reqAgg = requestAgg(x, ids);
        const out = mats.map((m) => materialView(m, subs, studs, agg, null, reqAgg)).sort(SORTS.newest.cmp);
        return limit ? out.slice(0, limit) : out;
      }
    );
    return attachUploaderCredibility(rows);
  },

  bySubject(subjectId, { excludeId = null, limit = 4 } = {}) {
    const rows = read(
      {
        label: 'More from this subject',
        sql: `${MATERIAL_SELECT}
${MATERIAL_FROM}
WHERE m.subject_id = ${lit(subjectId)}${excludeId ? ` AND m.material_id <> ${excludeId}` : ''}
${MATERIAL_GROUP}
ORDER BY avg_rating DESC NULLS LAST
LIMIT ${limit};`,
        tables: ['Material', 'Subject', 'Student', 'Rating'],
        base: 'Material',
        primary: false,
      },
      (x) => {
        let mats = x.indexes ? x.lookup('idx_material_subject', [subjectId]) : x.seq('Material').filter((m) => m.subject_id === subjectId);
        if (excludeId) mats = mats.filter((m) => m.material_id !== excludeId);
        const subs = subjectMap(x);
        const studs = studentMap(x);
        const agg = ratingAgg(x, mats.map((m) => m.material_id));
        return mats
          .map((m) => materialView(m, subs, studs, agg))
          .sort(SORTS.rating.cmp)
          .slice(0, limit);
      }
    );
    return attachUploaderCredibility(rows);
  },

  // Matched on the student's department + semester through a Subject join.
  recommended(studentId, { limit = 6 } = {}) {
    ensure();
    const me = pk.Student.get(studentId);
    if (!me) throw new DbError('NOT_FOUND', `No Student row with student_id = ${studentId}`);
    const rows = read(
      {
        label: 'Recommended for you',
        sql: `${MATERIAL_SELECT}
${MATERIAL_FROM}
WHERE s.department = ${lit(me.department)}
  AND s.semester   = ${me.semester}
  AND m.uploaded_by <> ${studentId}
${MATERIAL_GROUP}
HAVING COUNT(r.rating_id) >= 3
ORDER BY avg_rating DESC, rating_count DESC
LIMIT ${limit};`,
        tables: ['Material', 'Subject', 'Student', 'Rating'],
        base: 'Material',
        plan: queryLog.buildPlan({
          project: 'm.material_id, m.title, s.subject_name, avg_rating',
          base: 'Material m',
          access: useIndexes ? 'Index Scan (idx_material_subject)' : 'Seq Scan (full table)',
          filters: [`uploaded_by ≠ ${studentId}`],
          joins: [
            { table: 'Subject s', on: 'm.subject_id = s.subject_id', filters: [`s.department = '${me.department}'`, `s.semester = ${me.semester}`] },
            { table: 'Student st', on: 'm.uploaded_by = st.student_id' },
            { table: 'Rating r', on: 'r.material_id = m.material_id', outer: true },
          ],
          group: 'GROUP BY m.material_id',
          having: 'COUNT(r.rating_id) ≥ 3',
          order: 'avg_rating DESC',
          limit,
        }),
      },
      (x) => {
        const subs = subjectMap(x);
        const mine = [...subs.values()].filter((s) => s.department === me.department && s.semester === me.semester).map((s) => s.subject_id);
        let mats = x.indexes ? x.lookup('idx_material_subject', mine) : x.seq('Material').filter((m) => mine.includes(m.subject_id));
        mats = mats.filter((m) => m.uploaded_by !== studentId);
        const studs = studentMap(x);
        const agg = ratingAgg(x, mats.map((m) => m.material_id));
        return mats
          .map((m) => materialView(m, subs, studs, agg))
          .filter((m) => m.rating_count >= 3)
          .sort(SORTS.rating.cmp)
          .slice(0, limit);
      }
    );
    return attachUploaderCredibility(rows);
  },

  // Trending: most ratings received in the last `days` days.
  trending({ days = 7, limit = 5 } = {}) {
    const since = isoDaysAgo(days);
    const rows = read(
      {
        label: 'Trending this week',
        sql: `SELECT m.material_id, m.title, s.subject_name,
       COUNT(r.rating_id) AS ratings_this_week, ROUND(AVG(r.score), 2) AS avg_rating
FROM Rating r
JOIN Material m ON r.material_id = m.material_id
JOIN Subject s  ON m.subject_id  = s.subject_id
WHERE r.rating_date >= ${lit(since)}
GROUP BY m.material_id, m.title, s.subject_name
ORDER BY ratings_this_week DESC, avg_rating DESC
LIMIT ${limit};`,
        tables: ['Rating', 'Material', 'Subject', 'Student'],
        base: 'Rating',
        primary: false,
      },
      (x) => {
        const recent = x.seq('Rating').filter((r) => r.rating_date >= since);
        const counts = new Map();
        for (const r of recent) counts.set(r.material_id, (counts.get(r.material_id) || 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 3);
        const subs = subjectMap(x);
        const studs = studentMap(x);
        const mats = top.map(([id]) => x.get('Material', id));
        const agg = ratingAgg(x, mats.map((m) => m.material_id));
        return mats
          .map((m) => ({ ...materialView(m, subs, studs, agg), ratings_this_week: counts.get(m.material_id) }))
          .sort((a, b) => b.ratings_this_week - a.ratings_this_week || (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
          .slice(0, limit);
      }
    );
    return attachUploaderCredibility(rows);
  },

  // Duplicate detection (§7.7): titles in the same subject above `threshold`.
  similar(title, subjectId, { threshold = 0.7, limit = 5 } = {}) {
    if (!title || !subjectId) return [];
    return read(
      {
        label: 'Duplicate check',
        sql: `SELECT m.material_id, m.title, similarity(m.title, ${lit(title)}) AS score
FROM Material m
WHERE m.subject_id = ${lit(Number(subjectId))}
  AND similarity(m.title, ${lit(title)}) > ${threshold}
ORDER BY score DESC
LIMIT ${limit};  -- similarity = bigram Dice coefficient`,
        tables: ['Material'],
        base: 'Material',
      },
      (x) => {
        const mats = x.indexes ? x.lookup('idx_material_subject', [Number(subjectId)]) : x.seq('Material').filter((m) => m.subject_id === Number(subjectId));
        return mats
          .map((m) => ({ material_id: m.material_id, title: m.title, material_type: m.material_type, uploaded_by: m.uploaded_by, score: round2(titleSimilarity(title, m.title)) }))
          .filter((m) => m.score > threshold)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }
    );
  },

  // Exam Mode (§7.6): the best Notes, PYQ and Summary for each subject in
  // the student's department and semester, bundled per subject.
  cramPacks(studentId, { limit = 6 } = {}) {
    ensure();
    const me = pk.Student.get(studentId);
    if (!me) throw new DbError('NOT_FOUND', `No Student row with student_id = ${studentId}`);
    return read(
      {
        label: 'Cram packs for your semester',
        sql: `SELECT s.subject_id, s.subject_name, m.material_type, m.material_id, m.title,
       ROUND(AVG(r.score), 2) AS avg_rating
FROM Subject s
JOIN Material m    ON m.subject_id  = s.subject_id
LEFT JOIN Rating r ON r.material_id = m.material_id
WHERE s.department = ${lit(me.department)} AND s.semester = ${me.semester}
  AND m.material_type IN ('Notes', 'PYQ', 'Summary')
GROUP BY s.subject_id, m.material_type, m.material_id
HAVING COUNT(r.rating_id) > 0
ORDER BY s.subject_name, m.material_type, avg_rating DESC;
-- the app keeps the best-rated row per (subject, material_type)`,
        tables: ['Subject', 'Material', 'Rating', 'Student'],
        base: 'Material',
      },
      (x) => {
        const subs = subjectMap(x);
        const mine = [...subs.values()].filter((s) => s.department === me.department && s.semester === me.semester);
        const ids = mine.map((s) => s.subject_id);
        const mats = x.indexes ? x.lookup('idx_material_subject', ids) : x.seq('Material').filter((m) => ids.includes(m.subject_id));
        const studs = studentMap(x);
        const agg = ratingAgg(x, mats.map((m) => m.material_id));
        const best = new Map();
        for (const m of mats) {
          if (!agg.get(m.material_id)) continue;
          const key = `${m.subject_id}:${m.material_type}`;
          const view = materialView(m, subs, studs, agg);
          const held = best.get(key);
          if (!held || (view.avg_rating ?? 0) > (held.avg_rating ?? 0)) best.set(key, view);
        }
        return mine
          .map((s) => ({ subject: publicSubject(s), items: ['Notes', 'PYQ', 'Summary'].map((t) => best.get(`${s.subject_id}:${t}`) || null) }))
          .filter((p) => p.items.some(Boolean))
          .slice(0, limit);
      }
    );
  },

  create(input) {
    const row = write(
      {
        label: 'Insert material',
        tables: ['Material'],
        sql: (r) =>
          `INSERT INTO Material (material_id, title, subject_id, uploaded_by, material_type, upload_date, file_link)
VALUES (${r ? r.material_id : 'DEFAULT'}, ${lit(input.title)}, ${lit(input.subject_id)}, ${lit(input.uploaded_by)},
        ${lit(input.material_type)}, ${r ? lit(r.upload_date) : 'CURRENT_DATE'}, ${r ? lit(r.file_link) : lit(input.file_link)});`,
      },
      () => {
        const id = nextId('Material');
        return insertRow('Material', {
          material_id: id,
          title: input.title,
          subject_id: input.subject_id === '' || input.subject_id == null ? null : Number(input.subject_id),
          uploaded_by: input.uploaded_by,
          material_type: input.material_type,
          upload_date: input.upload_date,
          // The form sends a template ('…/m/{material_id}.pdf'); the id is known only here.
          file_link: (input.file_link || 'https://files.studyswap.in/m/{material_id}.pdf').replace('{material_id}', id),
          _ui: {
            thumbnail: null,
            pageCount: input._ui?.pageCount ?? 1,
            fileSize: input._ui?.fileSize ?? 0,
            tags: input._ui?.tags ?? [],
            description: input._ui?.description ?? '',
            syllabus_year: input._ui?.syllabus_year ?? new Date().getFullYear(),
            anonymous: !!input._ui?.anonymous,
          },
        });
      }
    );
    return materials.getById(row.material_id);
  },

  // Rows that would block a DELETE (ON DELETE RESTRICT).
  references(id) {
    return read(
      {
        label: 'Rows referencing this material',
        sql: `SELECT 'Rating' AS tbl, COUNT(*) FROM Rating WHERE material_id = ${id}
UNION ALL
SELECT 'Swap_Request', COUNT(*) FROM Swap_Request WHERE material_id = ${id};`,
        tables: ['Rating', 'Swap_Request'],
        base: 'Rating',
        primary: false,
      },
      (x) => {
        const r = x.indexes ? x.lookup('idx_rating_material', [id]) : x.seq('Rating').filter((row) => row.material_id === id);
        const s = x.indexes ? x.lookup('idx_request_material', [id]) : x.seq('Swap_Request').filter((row) => row.material_id === id);
        return { Rating: r.length, Swap_Request: s.length };
      }
    );
  },

  remove(id, actorId) {
    ensure();
    const m = pk.Material.get(id);
    if (!m) throw new DbError('NOT_FOUND', `No Material row with material_id = ${id}`);
    if (actorId !== undefined && m.uploaded_by !== actorId) throw rule('Only the uploader can delete this material.');
    return write({ label: 'Delete material', tables: ['Material'], sql: `DELETE FROM Material\nWHERE material_id = ${id};` }, () => {
      deleteRow('Material', id);
      return { material_id: id };
    });
  },
};

// ── Swap requests ────────────────────────────────────────────
function requestView(r, mats, subs, studs, creds) {
  const m = mats.get(r.material_id);
  const requester = studs.get(r.requester_id);
  const owner = m ? studs.get(m.uploaded_by) : null;
  return {
    ...r,
    material: m ? { material_id: m.material_id, title: m.title, material_type: m.material_type, subject: publicSubject(subs.get(m.subject_id)), uploaded_by: m.uploaded_by } : null,
    requester: requester ? publicStudent(requester, creds?.get(r.requester_id)) : null,
    owner: owner ? publicStudent(owner, creds?.get(owner.student_id)) : null,
    offer: r._ui?.offer_material_id ? (({ material_id, title, material_type }) => ({ material_id, title, material_type }))(mats.get(r._ui.offer_material_id) || {}) : null,
  };
}

const REQUEST_SELECT = `SELECT sr.request_id, sr.status, sr.request_date, sr.response_date, sr.message,
       m.material_id, m.title, rq.name AS requester, ow.name AS owner
FROM Swap_Request sr
JOIN Material m ON sr.material_id  = m.material_id
JOIN Student rq ON sr.requester_id = rq.student_id
JOIN Student ow ON m.uploaded_by   = ow.student_id`;

export const requests = {
  incoming(studentId, { status = null } = {}) {
    const statuses = asArray(status);
    return read(
      {
        label: 'Incoming swap requests',
        sql: `${REQUEST_SELECT}
WHERE m.uploaded_by = ${lit(studentId)}${statuses.length ? `\n  AND ${inOrEq('sr.status', statuses)}` : ''}
ORDER BY sr.request_date DESC;`,
        tables: ['Swap_Request', 'Material', 'Student', 'Subject'],
        base: 'Swap_Request',
      },
      (x) => {
        const mine = x.indexes ? x.lookup('idx_material_uploader', [studentId]) : x.seq('Material').filter((m) => m.uploaded_by === studentId);
        const ids = mine.map((m) => m.material_id);
        let reqs = x.indexes ? x.lookup('idx_request_material', ids) : x.seq('Swap_Request').filter((r) => ids.includes(r.material_id));
        if (statuses.length) reqs = reqs.filter((r) => statuses.includes(r.status));
        const mats = new Map(state.tables.Material.map((m) => [m.material_id, m])); // offer lookups by pk
        const studs = studentMap(x);
        const creds = credibilityOf(x, [...new Set(reqs.map((r) => r.requester_id))]);
        const subs = subjectMap(x);
        return reqs.map((r) => requestView(r, mats, subs, studs, creds)).sort((a, b) => b.request_date.localeCompare(a.request_date) || b.request_id - a.request_id);
      }
    );
  },

  outgoing(studentId, { status = null } = {}) {
    const statuses = asArray(status);
    return read(
      {
        label: 'Outgoing swap requests',
        sql: `${REQUEST_SELECT}
WHERE sr.requester_id = ${lit(studentId)}${statuses.length ? `\n  AND ${inOrEq('sr.status', statuses)}` : ''}
ORDER BY sr.request_date DESC;`,
        tables: ['Swap_Request', 'Material', 'Student', 'Subject', 'Rating'],
        base: 'Swap_Request',
      },
      (x) => {
        let reqs = x.indexes ? x.lookup('idx_request_requester', [studentId]) : x.seq('Swap_Request').filter((r) => r.requester_id === studentId);
        if (statuses.length) reqs = reqs.filter((r) => statuses.includes(r.status));
        const mats = new Map(state.tables.Material.map((m) => [m.material_id, m]));
        const studs = studentMap(x);
        const subs = subjectMap(x);
        const owners = [...new Set(reqs.map((r) => mats.get(r.material_id)?.uploaded_by).filter(Boolean))];
        const creds = credibilityOf(x, owners);
        const myRatings = new Set(x.seq('Rating').filter((r) => r.rated_by === studentId).map((r) => r.material_id));
        return reqs
          .map((r) => ({ ...requestView(r, mats, subs, studs, creds), has_rated: myRatings.has(r.material_id) }))
          .sort((a, b) => b.request_date.localeCompare(a.request_date) || b.request_id - a.request_id);
      }
    );
  },

  latestFor(materialId, requesterId) {
    return read(
      {
        label: 'Existing request check',
        sql: `SELECT * FROM Swap_Request\nWHERE material_id = ${materialId} AND requester_id = ${requesterId}\nORDER BY request_date DESC\nLIMIT 1;`,
        tables: ['Swap_Request'],
        base: 'Swap_Request',
        primary: false,
      },
      (x) => {
        const rows = x.indexes ? x.lookup('idx_request_material', [materialId]) : x.seq('Swap_Request').filter((r) => r.material_id === materialId);
        return rows.filter((r) => r.requester_id === requesterId).sort((a, b) => b.request_id - a.request_id)[0] || null;
      }
    );
  },

  create({ requester_id, material_id, message = null, offer_material_id = null }) {
    ensure();
    const m = pk.Material.get(Number(material_id));
    if (m && m.uploaded_by === requester_id) throw rule('You cannot request your own material.', 'Swap_Request.requester_id must differ from Material.uploaded_by.');
    if (m && state.tables.Swap_Request.some((r) => r.material_id === m.material_id && r.requester_id === requester_id && r.status === 'Pending')) {
      throw rule('You already have a Pending request for this material.', 'Wait for the uploader to respond before requesting again.');
    }
    if (offer_material_id) {
      const o = pk.Material.get(Number(offer_material_id));
      if (!o) throw new DbError('FOREIGN_KEY', 'FOREIGN KEY violation: offer references a missing Material', { detail: `material_id = ${offer_material_id} is not present in Material.` });
      if (o.uploaded_by !== requester_id) throw rule('You can only offer your own materials.');
    }
    return write(
      {
        label: 'Insert swap request',
        tables: ['Swap_Request'],
        sql: (r) =>
          `INSERT INTO Swap_Request (request_id, requester_id, material_id, status, request_date, message)
VALUES (${r ? r.request_id : 'DEFAULT'}, ${lit(requester_id)}, ${lit(material_id)}, 'Pending', ${r ? lit(r.request_date) : 'CURRENT_DATE'}, ${lit(message)});`,
      },
      () =>
        insertRow('Swap_Request', {
          requester_id,
          material_id: material_id === '' || material_id == null ? null : Number(material_id),
          status: 'Pending',
          message,
          response_date: null,
          _ui: { offer_material_id: offer_material_id ? Number(offer_material_id) : null, reject_reason: null, linked_request_id: null },
        })
    );
  },

  // Uploader accepts or rejects a Pending request.
  respond(requestId, actorId, status, reason = null) {
    ensure();
    const r = pk.Swap_Request.get(requestId);
    if (!r) throw new DbError('NOT_FOUND', `No Swap_Request row with request_id = ${requestId}`);
    const m = pk.Material.get(r.material_id);
    if (m.uploaded_by !== actorId) throw rule('Only the uploader can respond to this request.');
    if (r.status !== 'Pending') throw rule(`This request is already ${r.status}.`, 'Only Pending requests can be accepted or rejected.');
    if (status !== 'Accepted' && status !== 'Rejected') {
      // Let the CHECK constraint speak for anything else.
      return write({ label: 'Update swap request', tables: ['Swap_Request'], sql: `UPDATE Swap_Request SET status = ${lit(status)}\nWHERE request_id = ${requestId};` }, () =>
        updateRow('Swap_Request', requestId, { status })
      );
    }
    return write(
      {
        label: status === 'Accepted' ? 'Accept swap request' : 'Reject swap request',
        tables: ['Swap_Request'],
        sql: `UPDATE Swap_Request\nSET status = ${lit(status)}, response_date = CURRENT_DATE\nWHERE request_id = ${requestId} AND status = 'Pending';`,
      },
      () => updateRow('Swap_Request', requestId, { status, response_date: today(), _ui: { ...r._ui, reject_reason: status === 'Rejected' ? reason || null : null } })
    );
  },

  // Requester marks an Accepted request received and rates it — one transaction.
  complete(requestId, actorId, rating) {
    ensure();
    const r = pk.Swap_Request.get(requestId);
    if (!r) throw new DbError('NOT_FOUND', `No Swap_Request row with request_id = ${requestId}`);
    if (r.requester_id !== actorId) throw rule('Only the requester can mark this request received.');
    if (r.status !== 'Accepted' && !(r.status === 'Completed' && rating)) throw rule(`This request is ${r.status}; only Accepted requests can be completed.`);
    const score = scoreFrom(rating);
    return write(
      {
        label: 'Complete swap and rate',
        tables: ['Swap_Request', 'Rating'],
        sql: `BEGIN;
UPDATE Swap_Request SET status = 'Completed'
WHERE request_id = ${requestId} AND status = 'Accepted';
INSERT INTO Rating (material_id, rated_by, score, comment, rating_date)
VALUES (${r.material_id}, ${actorId}, ${lit(score)}, ${lit(rating?.comment || null)}, CURRENT_DATE);
COMMIT;`,
      },
      () => {
        if (r.status !== 'Completed') updateRow('Swap_Request', requestId, { status: 'Completed' });
        let inserted = null;
        if (rating) inserted = insertRating({ material_id: r.material_id, rated_by: actorId, ...rating });
        return { request: pk.Swap_Request.get(requestId), rating: inserted };
      }
    );
  },

  // Requester withdraws a Pending request (used for Undo).
  withdraw(requestId, actorId) {
    ensure();
    const r = pk.Swap_Request.get(requestId);
    if (!r) throw new DbError('NOT_FOUND', `No Swap_Request row with request_id = ${requestId}`);
    if (r.requester_id !== actorId) throw rule('Only the requester can withdraw this request.');
    if (r.status !== 'Pending') throw rule('Only Pending requests can be withdrawn.');
    return write({ label: 'Withdraw swap request', tables: ['Swap_Request'], sql: `DELETE FROM Swap_Request\nWHERE request_id = ${requestId} AND status = 'Pending';` }, () => {
      deleteRow('Swap_Request', requestId);
      return { request_id: requestId };
    });
  },
};

// ── Ratings ──────────────────────────────────────────────────
// Sub-scores (§7.5) are averaged into the single Rating.score column.
function scoreFrom(rating) {
  if (!rating) return null;
  const { completeness, legibility, accuracy } = rating;
  if ([completeness, legibility, accuracy].every((v) => v !== undefined && v !== null && v !== '')) {
    return Math.round((Number(completeness) + Number(legibility) + Number(accuracy)) / 3);
  }
  return rating.score;
}

function insertRating({ material_id, rated_by, comment = null, ...rest }) {
  const m = pk.Material.get(Number(material_id));
  if (m && m.uploaded_by === rated_by) throw rule('Uploaders cannot rate their own material.');
  const score = scoreFrom(rest);
  const subs = rest.completeness !== undefined ? { completeness: Number(rest.completeness), legibility: Number(rest.legibility), accuracy: Number(rest.accuracy) } : {};
  return insertRow('Rating', {
    material_id: material_id === '' || material_id == null ? null : Number(material_id),
    rated_by,
    score,
    comment,
    _ui: subs,
  });
}

const RATING_SELECT = `SELECT r.rating_id, r.score, r.comment, r.rating_date,
       st.student_id, st.name AS rater, m.material_id, m.title
FROM Rating r
JOIN Student st ON r.rated_by    = st.student_id
JOIN Material m ON r.material_id = m.material_id`;

function ratingView(r, studs, mats) {
  const s = studs.get(r.rated_by);
  const m = mats.get(r.material_id);
  return {
    ...r,
    rater: s ? { student_id: s.student_id, name: s.name, department: s.department, semester: s.semester } : null,
    material: m ? { material_id: m.material_id, title: m.title, material_type: m.material_type, subject_id: m.subject_id } : null,
  };
}

export const ratings = {
  create(input) {
    return write(
      {
        label: 'Insert rating',
        tables: ['Rating'],
        sql: `INSERT INTO Rating (material_id, rated_by, score, comment, rating_date)
VALUES (${lit(input.material_id)}, ${lit(input.rated_by)}, ${lit(scoreFrom(input))}, ${lit(input.comment ?? null)}, CURRENT_DATE);`,
      },
      () => insertRating(input)
    );
  },

  forMaterial(materialId) {
    return read(
      {
        label: 'Ratings for material',
        sql: `${RATING_SELECT}\nWHERE r.material_id = ${lit(materialId)}\nORDER BY r.rating_date DESC;`,
        tables: ['Rating', 'Student', 'Material'],
        base: 'Rating',
      },
      (x) => {
        const rows = x.indexes ? x.lookup('idx_rating_material', [Number(materialId)]) : x.seq('Rating').filter((r) => r.material_id === Number(materialId));
        const studs = studentMap(x);
        const mats = new Map([[Number(materialId), x.get('Material', Number(materialId))]]);
        return rows.map((r) => ratingView(r, studs, mats)).sort((a, b) => b.rating_date.localeCompare(a.rating_date) || b.rating_id - a.rating_id);
      }
    );
  },

  // Ratings a student has given.
  byStudent(studentId) {
    return read(
      {
        label: 'Ratings given',
        sql: `${RATING_SELECT}\nWHERE r.rated_by = ${lit(studentId)}\nORDER BY r.rating_date DESC;`,
        tables: ['Rating', 'Student', 'Material'],
        base: 'Rating',
      },
      (x) => {
        const rows = x.seq('Rating').filter((r) => r.rated_by === studentId);
        const studs = studentMap(x);
        const mats = new Map(rows.map((r) => [r.material_id, x.get('Material', r.material_id)]));
        return rows.map((r) => ratingView(r, studs, mats)).sort((a, b) => b.rating_date.localeCompare(a.rating_date));
      }
    );
  },

  // Ratings on materials a student uploaded.
  receivedBy(studentId) {
    return read(
      {
        label: 'Ratings received',
        sql: `${RATING_SELECT}\nWHERE m.uploaded_by = ${lit(studentId)}\nORDER BY r.rating_date DESC;`,
        tables: ['Rating', 'Student', 'Material'],
        base: 'Material',
      },
      (x) => {
        const mats = x.indexes ? x.lookup('idx_material_uploader', [studentId]) : x.seq('Material').filter((m) => m.uploaded_by === studentId);
        const matMap = new Map(mats.map((m) => [m.material_id, m]));
        const rows = x.indexes ? x.lookup('idx_rating_material', [...matMap.keys()]) : x.seq('Rating').filter((r) => matMap.has(r.material_id));
        const studs = studentMap(x);
        return rows.map((r) => ratingView(r, studs, matMap)).sort((a, b) => b.rating_date.localeCompare(a.rating_date));
      }
    );
  },

  hasRated(materialId, studentId) {
    ensure();
    return state.tables.Rating.some((r) => r.material_id === materialId && r.rated_by === studentId);
  },
};

// ── Mutual swap matcher (§7.4) ───────────────────────────────
// B "needs" a subject if it is in B's department + semester, or B has
// already requested material in it. A perfect match is a pair where each
// side has uploaded something the other needs and hasn't requested yet.
export const matches = {
  findMutualSwaps(studentId, { limit = 8 } = {}) {
    ensure();
    const me = pk.Student.get(studentId);
    if (!me) throw new DbError('NOT_FOUND', `No Student row with student_id = ${studentId}`);
    return read(
      {
        label: 'Mutual swap matches',
        sql: `WITH needs AS (
  SELECT st.student_id, s.subject_id
  FROM Student st JOIN Subject s
    ON s.department = st.department AND s.semester = st.semester
  UNION
  SELECT sr.requester_id, m.subject_id
  FROM Swap_Request sr JOIN Material m ON sr.material_id = m.material_id
)
SELECT b.student_id, a_gives.material_id AS you_give, b_gives.material_id AS you_get
FROM Material a_gives
JOIN needs nb   ON nb.subject_id = a_gives.subject_id
JOIN Student b  ON b.student_id  = nb.student_id AND b.student_id <> ${studentId}
JOIN Material b_gives ON b_gives.uploaded_by = b.student_id
JOIN needs na   ON na.student_id = ${studentId} AND na.subject_id = b_gives.subject_id
WHERE a_gives.uploaded_by = ${studentId};`,
        tables: ['Student', 'Subject', 'Material', 'Swap_Request', 'Rating'],
        base: 'Material',
      },
      (x) => {
        const subs = subjectMap(x);
        const studs = studentMap(x);
        const mats = x.seq('Material');
        const reqs = x.seq('Swap_Request');
        const needs = new Map(); // student_id → Set(subject_id)
        for (const s of studs.values()) {
          needs.set(s.student_id, new Set([...subs.values()].filter((sub) => sub.department === s.department && sub.semester === s.semester).map((sub) => sub.subject_id)));
        }
        const matById = new Map(mats.map((m) => [m.material_id, m]));
        const requested = new Set();
        for (const r of reqs) {
          const m = matById.get(r.material_id);
          if (m) needs.get(r.requester_id)?.add(m.subject_id);
          requested.add(`${r.requester_id}:${r.material_id}`);
        }
        const byUploader = new Map();
        for (const m of mats) {
          if (!byUploader.has(m.uploaded_by)) byUploader.set(m.uploaded_by, []);
          byUploader.get(m.uploaded_by).push(m);
        }
        const agg = ratingAgg(x, null);
        const avg = (m) => {
          const a = agg.get(m.material_id);
          return a ? a.sum / a.count : 0;
        };
        const best = (list) => [...list].sort((p, q) => avg(q) - avg(p)).slice(0, 3);
        const myMats = byUploader.get(studentId) || [];
        const myNeeds = needs.get(studentId);
        const creds = credibilityOf(x, null);

        const perfect = [];
        const near = [];
        for (const other of studs.values()) {
          if (other.student_id === studentId) continue;
          const theirNeeds = needs.get(other.student_id);
          const give = myMats.filter((m) => theirNeeds.has(m.subject_id) && !requested.has(`${other.student_id}:${m.material_id}`));
          const get = (byUploader.get(other.student_id) || []).filter((m) => myNeeds.has(m.subject_id) && !requested.has(`${studentId}:${m.material_id}`));
          if (!give.length && !get.length) continue;
          const view = (m) => materialView(m, subs, studs, agg);
          const entry = {
            student: publicStudent(other, creds.get(other.student_id)),
            give: best(give).map(view),
            get: best(get).map(view),
          };
          if (give.length && get.length) {
            // Strength: overlap on both sides, weighted by quality and credibility.
            const q = (avg(entry.give[0]) + avg(entry.get[0])) / 10;
            const c = (creds.get(other.student_id)?.credibility_score ?? 3) / 5;
            entry.strength = round2(Math.min(1, 0.35 * Math.min(1, (give.length + get.length) / 6) + 0.4 * q + 0.25 * c));
            perfect.push(entry);
          } else if (get.length) {
            entry.strength = null;
            entry.missing = 'give'; // they have what you need; upload something they need
            near.push(entry);
          }
        }
        perfect.sort((a, b) => b.strength - a.strength);
        near.sort((a, b) => (b.student.credibility_score ?? 0) - (a.student.credibility_score ?? 0));
        return { perfect: perfect.slice(0, limit), near: near.slice(0, limit) };
      }
    );
  },

  // Two linked Swap_Request rows, one in each direction.
  propose(studentId, otherId, giveMaterialId, getMaterialId, message = null) {
    ensure();
    const give = pk.Material.get(Number(giveMaterialId));
    const get = pk.Material.get(Number(getMaterialId));
    if (give && give.uploaded_by !== studentId) throw rule('You can only offer your own material.');
    if (get && get.uploaded_by !== otherId) throw rule('That material does not belong to the other student.');
    return write(
      {
        label: 'Propose mutual swap',
        tables: ['Swap_Request'],
        sql: `BEGIN;
INSERT INTO Swap_Request (requester_id, material_id, status, request_date, message)
VALUES (${studentId}, ${getMaterialId}, 'Pending', CURRENT_DATE, ${lit(message)});
INSERT INTO Swap_Request (requester_id, material_id, status, request_date, message)
VALUES (${otherId}, ${giveMaterialId}, 'Pending', CURRENT_DATE, ${lit(message)});
COMMIT;`,
      },
      () => {
        const a = insertRow('Swap_Request', { requester_id: studentId, material_id: Number(getMaterialId), status: 'Pending', message, _ui: { offer_material_id: Number(giveMaterialId), reject_reason: null, linked_request_id: null } });
        const b = insertRow('Swap_Request', { requester_id: otherId, material_id: Number(giveMaterialId), status: 'Pending', message, _ui: { offer_material_id: Number(getMaterialId), reject_reason: null, linked_request_id: a.request_id } });
        a._ui.linked_request_id = b.request_id;
        return [a, b];
      }
    );
  },
};

// ── Activity feed (dashboard) ────────────────────────────────
export const activity = {
  recent(studentId, { limit = 8 } = {}) {
    return read(
      {
        label: 'Recent activity',
        sql: `SELECT 'request' AS kind, sr.request_date AS at, sr.request_id AS ref
FROM Swap_Request sr JOIN Material m ON sr.material_id = m.material_id
WHERE m.uploaded_by = ${studentId}
UNION ALL
SELECT 'response', sr.response_date, sr.request_id
FROM Swap_Request sr WHERE sr.requester_id = ${studentId} AND sr.response_date IS NOT NULL
UNION ALL
SELECT 'rating', r.rating_date, r.rating_id
FROM Rating r JOIN Material m ON r.material_id = m.material_id
WHERE m.uploaded_by = ${studentId}
ORDER BY at DESC
LIMIT ${limit};`,
        tables: ['Swap_Request', 'Material', 'Rating', 'Student'],
        base: 'Material',
        primary: false,
      },
      (x) => {
        const mine = x.indexes ? x.lookup('idx_material_uploader', [studentId]) : x.seq('Material').filter((m) => m.uploaded_by === studentId);
        const matMap = new Map(mine.map((m) => [m.material_id, m]));
        const studs = studentMap(x);
        const incoming = x.indexes ? x.lookup('idx_request_material', [...matMap.keys()]) : x.seq('Swap_Request').filter((r) => matMap.has(r.material_id));
        const outgoing = x.indexes ? x.lookup('idx_request_requester', [studentId]) : x.seq('Swap_Request').filter((r) => r.requester_id === studentId);
        const rated = x.indexes ? x.lookup('idx_rating_material', [...matMap.keys()]) : x.seq('Rating').filter((r) => matMap.has(r.material_id));
        const title = (id) => matMap.get(id)?.title || pk.Material.get(id)?.title;
        const items = [
          ...incoming.map((r) => ({ kind: 'request', at: r.request_date, ref: r.request_id, actor: studs.get(r.requester_id)?.name, material_id: r.material_id, title: title(r.material_id), status: r.status })),
          ...outgoing
            .filter((r) => r.response_date)
            .map((r) => ({ kind: 'response', at: r.response_date, ref: r.request_id, actor: studs.get(pk.Material.get(r.material_id)?.uploaded_by)?.name, material_id: r.material_id, title: title(r.material_id), status: r.status })),
          ...rated.map((r) => ({ kind: 'rating', at: r.rating_date, ref: r.rating_id, actor: studs.get(r.rated_by)?.name, material_id: r.material_id, title: title(r.material_id), score: r.score })),
        ];
        return items.sort((a, b) => b.at.localeCompare(a.at) || b.ref - a.ref).slice(0, limit);
      }
    );
  },
};

// ── Global search (command palette) ──────────────────────────
export const search = {
  all(q, { limit = 5 } = {}) {
    const term = String(q || '').trim().toLowerCase();
    if (!term) return { materials: [], subjects: [], students: [] };
    return read(
      {
        label: 'Global search',
        sql: `SELECT 'Material', material_id, title FROM Material WHERE LOWER(title) LIKE ${lit(`%${term}%`)}
UNION ALL
SELECT 'Subject', subject_id, subject_name FROM Subject WHERE LOWER(subject_name) LIKE ${lit(`%${term}%`)}
UNION ALL
SELECT 'Student', student_id, name FROM Student WHERE LOWER(name) LIKE ${lit(`%${term}%`)};`,
        tables: ['Material', 'Subject', 'Student'],
        base: 'Material',
        primary: false,
      },
      (x) => {
        // Fuzzy: substring hits first, then in-order subsequence matches.
        const score = (text) => {
          const t = text.toLowerCase();
          const i = t.indexOf(term);
          if (i >= 0) return 100 - i;
          let j = 0;
          for (const ch of t) if (ch === term[j]) j++;
          return j === term.length ? 10 : -1;
        };
        const rank = (rows, get) =>
          rows
            .map((r) => [r, score(get(r))])
            .filter(([, s]) => s >= 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([r]) => r);
        const subs = x.seq('Subject');
        return {
          materials: rank(x.seq('Material'), (m) => m.title).map((m) => ({ material_id: m.material_id, title: m.title, material_type: m.material_type, subject_id: m.subject_id })),
          subjects: rank(subs, (s) => `${s.subject_name} ${s._ui?.code || ''}`).map(publicSubject),
          students: rank(x.seq('Student'), (s) => s.name).map((s) => ({ student_id: s.student_id, name: s.name, department: s.department, semester: s.semester })),
        };
      }
    );
  },
};

// ── Database administration (DB Lab, Inspector) ──────────────
export const admin = {
  getUseIndexes() {
    return useIndexes;
  },
  setUseIndexes(on) {
    useIndexes = !!on;
    try {
      localStorage.setItem(INDEX_FLAG_KEY, String(useIndexes));
    } catch {
      /* ignore */
    }
    return useIndexes;
  },
  counts() {
    ensure();
    return Object.fromEntries(TABLE_NAMES.map((t) => [t, state.tables[t].length]));
  },
  indexStats() {
    ensure();
    return INDEXES.map((ix) => ({ ...ix, keys: index[ix.name].size, entries: [...index[ix.name].values()].reduce((s, a) => s + a.length, 0) }));
  },
  // Raw rows of a table, for the DB Lab table browser.
  rows(table, { limit = 50, offset = 0 } = {}) {
    if (!TABLES[table]) throw new DbError('NOT_FOUND', `Table does not exist: ${table}`);
    return read(
      { label: `Browse ${table}`, sql: `SELECT * FROM ${table}\nORDER BY ${TABLES[table].pk}\nLIMIT ${limit} OFFSET ${offset};`, tables: [table] },
      (x) => {
        const all = x.seq(table);
        return { rows: all.slice(offset, offset + limit).map((r) => ({ ...r })), total: all.length };
      }
    );
  },
  // Constraint tester: run the INSERT inside a transaction and always
  // roll back. Returns the row that would be stored, or throws.
  tryInsert(table, row) {
    ensure();
    const snapshot = JSON.stringify(state.tables);
    try {
      const stored = clone(insertRow(table, row));
      queryLog.record({ kind: 'write', label: `Constraint test on ${table}`, sql: `INSERT INTO ${table} (${Object.keys(row).join(', ')})\nVALUES (${Object.values(row).map(lit).join(', ')});\nROLLBACK;  -- test only`, tables: [table], primary: false, rowsScanned: 0, rowsReturned: 1, ms: 0, scan: 'ROLLBACK', index: null });
      return stored;
    } catch (err) {
      queryLog.record({ kind: 'write', label: `Constraint test on ${table}`, sql: `INSERT INTO ${table} (${Object.keys(row).join(', ')})\nVALUES (${Object.values(row).map(lit).join(', ')});`, tables: [table], primary: false, error: err.message, rowsScanned: 0, rowsReturned: 0, ms: 0, scan: 'ROLLBACK', index: null });
      throw err;
    } finally {
      state.tables = JSON.parse(snapshot);
      rebuildIndexes();
    }
  },
  reset(opts) {
    reseed(opts);
    queryLog.clear();
    queryLog.record({ kind: 'write', label: 'Reseed database', sql: '-- DROP and re-seed all five tables\nTRUNCATE Student, Subject, Material, Swap_Request, Rating CASCADE;', tables: [...TABLE_NAMES], primary: false, rowsScanned: 0, rowsReturned: 0, ms: 0, scan: 'COMMIT', index: null });
    return admin.counts();
  },
  seededAt() {
    ensure();
    return state.seededAt;
  },
  queryLog: queryLog.history,
  latestQuery: queryLog.latest,
  subscribe: queryLog.subscribe,
  rerun(queryId, flag) {
    const e = queryLog.getById(queryId);
    return e?.replay ? e.replay(flag) : null;
  },
};
