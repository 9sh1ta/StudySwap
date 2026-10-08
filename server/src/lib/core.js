// Shared helpers: DbError, constraint checking, row access, aggregates and views.
// Behaviour is ported from the frontend's mock db.js so error codes/messages and
// response shapes stay identical.
import { TABLES, FOREIGN_KEYS, UNIQUE_KEYS } from '../shared/schema.js';
import { isoDaysAgo } from '../shared/seed.js';

export { isoDaysAgo };
export const today = () => isoDaysAgo(0);
export const round2 = (x) => Math.round(x * 100) / 100;

export class DbError extends Error {
  // code: CHECK | FOREIGN_KEY | UNIQUE | PRIMARY_KEY | NOT_NULL | LENGTH | TYPE | DERIVED
  //       | UNKNOWN_COLUMN | NOT_FOUND | RULE | AUTH
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'DbError';
    this.code = code;
    Object.assign(this, extra);
  }
}
export const rule = (message, detail) => new DbError('RULE', message, { detail });

export function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}
const list = (arr) => arr.map(lit).join(', ');

// ── Row access ───────────────────────────────────────────────
export function parseRow(r) {
  if (!r) return r;
  const o = { ...r };
  if (o._ui === null || o._ui === undefined) delete o._ui;
  else o._ui = JSON.parse(o._ui);
  return o;
}
export const all = (db, sql, ...p) => db.prepare(sql).all(...p).map(parseRow);
export const one = (db, sql, ...p) => parseRow(db.prepare(sql).get(...p)) ?? null;
export const getRow = (db, table, id) => one(db, `SELECT * FROM ${table} WHERE ${TABLES[table].pk} = ?`, id);
export const exists = (db, table, col, v) => !!db.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ? LIMIT 1`).get(v);
export const J = (arr) => JSON.stringify(arr);
export const IN = 'IN (SELECT value FROM json_each(?))';
export const nextId = (db, table) => db.prepare(`SELECT COALESCE(MAX(${TABLES[table].pk}), 0) + 1 AS n FROM ${table}`).get().n;

// ── Constraint enforcement (mirrors the mock's checkRow) ─────
export function checkRow(db, table, input, existing = null) {
  const def = TABLES[table];
  if (!def) throw new DbError('NOT_FOUND', `Table does not exist: ${table}`);
  const known = new Set(def.columns.map((c) => c.name).concat('_ui'));
  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      throw new DbError('UNKNOWN_COLUMN', `Unknown column: ${table}.${key}`, {
        table, column: key,
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
          table, column: name,
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
      if (v === undefined || v === null || v === '') { row[name] = nextId(db, table); continue; }
    }
    if ((v === undefined || v === '') && col.default && !existing) {
      v = row[name] = col.default === 'CURRENT_DATE' ? today() : col.default.replace(/'/g, '');
    }
    if (typeof v === 'string' && col.type === 'VARCHAR') v = row[name] = v.trim();
    if (v === '' || v === undefined) v = row[name] = null;

    if (v === null) {
      if (col.notNull) throw new DbError('NOT_NULL', `NOT NULL constraint violated: ${where}`, { table, column: name, detail: `${name} is required.` });
      continue;
    }

    if (col.type === 'INT') {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (!Number.isInteger(n)) throw new DbError('TYPE', `Type error: ${where} expects INT`, { table, column: name, detail: `Got ${JSON.stringify(v)}.` });
      v = row[name] = n;
    } else if (col.type === 'DATE') {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        throw new DbError('TYPE', `Type error: ${where} expects DATE (YYYY-MM-DD)`, { table, column: name, detail: `Got ${JSON.stringify(v)}.` });
      }
    } else if (col.type === 'VARCHAR') {
      v = row[name] = String(v);
      if (v.length > col.length) {
        throw new DbError('LENGTH', `Value too long for VARCHAR(${col.length}): ${where}`, {
          table, column: name, detail: `${v.length} characters; the column holds at most ${col.length}.`,
        });
      }
    }

    const c = col.check;
    if (c) {
      let ok = true;
      let cond = '';
      if (c.in) { ok = c.in.includes(v); cond = `${name} IN (${list(c.in)})`; }
      else if (c.min !== undefined) { ok = v >= c.min && v <= c.max; cond = `${name} BETWEEN ${c.min} AND ${c.max}`; }
      else if (c.endsWith) { ok = v.toLowerCase().endsWith(c.endsWith); cond = `${name} LIKE '%${c.endsWith}'`; }
      else if (c.notBefore) { ok = row[c.notBefore] == null || v >= row[c.notBefore]; cond = `${name} >= ${c.notBefore}`; }
      if (!ok) throw new DbError('CHECK', `CHECK constraint violated: ${name}`, { table, column: name, detail: `${cond} — got ${lit(v)}.` });
    }

    if (col.unique) {
      const owner = db.prepare(`SELECT ${pkCol} AS id FROM ${table} WHERE ${name} = ? COLLATE NOCASE`).get(v)?.id;
      if (owner !== undefined && owner !== row[pkCol]) {
        throw new DbError('UNIQUE', `UNIQUE constraint violated: ${where}`, { table, column: name, detail: `${lit(v)} is already registered.` });
      }
    }
  }

  if (!existing && exists(db, table, pkCol, row[pkCol])) {
    throw new DbError('PRIMARY_KEY', `PRIMARY KEY violation: ${table}.${pkCol}`, { table, column: pkCol, detail: `${pkCol} = ${row[pkCol]} already exists.` });
  }
  for (const fk of FOREIGN_KEYS.filter((f) => f.table === table)) {
    const v = row[fk.column];
    if (v !== null && v !== undefined && !exists(db, fk.references, fk.refColumn, v)) {
      throw new DbError('FOREIGN_KEY', `FOREIGN KEY violation: ${table}.${fk.column}`, {
        table, column: fk.column, detail: `${fk.column} = ${lit(v)} is not present in ${fk.references}(${fk.refColumn}).`,
      });
    }
  }
  for (const uq of UNIQUE_KEYS.filter((u) => u.table === table)) {
    const sql = `SELECT 1 FROM ${table} WHERE ${pkCol} <> ? AND ${uq.columns.map((c) => `${c} = ?`).join(' AND ')} LIMIT 1`;
    if (db.prepare(sql).get(row[pkCol], ...uq.columns.map((c) => row[c]))) {
      throw new DbError('UNIQUE', `UNIQUE constraint violated: ${uq.name}`, {
        table, column: uq.columns.join(', '),
        detail: `(${uq.columns.join(', ')}) = (${uq.columns.map((c) => lit(row[c])).join(', ')}) already exists.`,
      });
    }
  }
  return row;
}

const writableColumns = (table) => TABLES[table].columns.filter((c) => !c.derived).map((c) => c.name);
const uiJson = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

export function insertRow(db, table, input) {
  const row = checkRow(db, table, input);
  const cols = [...writableColumns(table), '_ui'];
  const vals = cols.map((c) => (c === '_ui' ? uiJson(row._ui) : row[c] ?? null));
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...vals);
  return getRow(db, table, row[TABLES[table].pk]);
}

export function updateRow(db, table, id, patch) {
  const existing = getRow(db, table, id);
  if (!existing) throw new DbError('NOT_FOUND', `No ${table} row with ${TABLES[table].pk} = ${id}`);
  const next = checkRow(db, table, patch, existing);
  const cols = [...writableColumns(table).filter((c) => c !== TABLES[table].pk), '_ui'];
  const vals = cols.map((c) => (c === '_ui' ? uiJson(next._ui) : next[c] ?? null));
  db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE ${TABLES[table].pk} = ?`).run(...vals, id);
  return getRow(db, table, id);
}

// ON DELETE RESTRICT: refuse while any child row references this one.
export function deleteRow(db, table, id) {
  const key = TABLES[table].pk;
  const refs = FOREIGN_KEYS.filter((f) => f.references === table)
    .map((f) => ({ table: f.table, column: f.column, count: db.prepare(`SELECT COUNT(*) AS n FROM ${f.table} WHERE ${f.column} = ?`).get(id).n }))
    .filter((r) => r.count > 0);
  if (refs.length) {
    const first = refs[0];
    throw new DbError('FOREIGN_KEY', `FOREIGN KEY violation: ${first.table}.${first.column}`, {
      table, refs,
      detail: `${key} ${id} is still referenced by ${refs.map((r) => `${r.count} ${r.table} row${r.count === 1 ? '' : 's'}`).join(' and ')}.`,
    });
  }
  const { changes } = db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).run(id);
  if (!changes) throw new DbError('NOT_FOUND', `No ${table} row with ${key} = ${id}`);
}

// ── Shared query pieces ──────────────────────────────────────
export const subjectMap = (db) => new Map(all(db, 'SELECT * FROM Subject').map((s) => [s.subject_id, s]));
export const studentMap = (db) => new Map(all(db, 'SELECT * FROM Student').map((s) => [s.student_id, s]));

// Rating aggregate per material: { sum, count, dist[1..5], subs }.
export function ratingAgg(db, materialIds) {
  const rows = materialIds === null
    ? all(db, 'SELECT * FROM Rating')
    : all(db, `SELECT * FROM Rating WHERE material_id ${IN}`, J(materialIds));
  const agg = new Map();
  for (const r of rows) {
    let a = agg.get(r.material_id);
    if (!a) agg.set(r.material_id, (a = { sum: 0, count: 0, dist: [0, 0, 0, 0, 0], subs: { completeness: 0, legibility: 0, accuracy: 0 }, subCount: 0 }));
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

export function requestAgg(db, materialIds, sinceDate = null) {
  const rows = materialIds === null
    ? all(db, 'SELECT material_id, request_date FROM Swap_Request')
    : all(db, `SELECT material_id, request_date FROM Swap_Request WHERE material_id ${IN}`, J(materialIds));
  const agg = new Map();
  for (const r of rows) {
    if (sinceDate && r.request_date < sinceDate) continue;
    agg.set(r.material_id, (agg.get(r.material_id) || 0) + 1);
  }
  return agg;
}

// vw_student_credibility. studentIds = null → every student.
export function credibilityOf(db, studentIds = null) {
  const rows = studentIds === null
    ? all(db, 'SELECT * FROM vw_student_credibility')
    : all(db, `SELECT * FROM vw_student_credibility WHERE student_id ${IN}`, J(studentIds));
  return new Map(rows.map((r) => [r.student_id, { student_id: r.student_id, credibility_score: r.credibility_score ?? null, rating_count: r.rating_count }]));
}

export const publicStudent = (s, cred) => ({
  student_id: s.student_id,
  name: s.name,
  email: s.email,
  department: s.department,
  semester: s.semester,
  credibility_score: cred?.credibility_score ?? null,
  rating_count: cred?.rating_count ?? 0,
  _ui: s._ui,
});

export const publicSubject = (s) => ({ subject_id: s.subject_id, subject_name: s.subject_name, department: s.department, semester: s.semester, code: s._ui?.code });

export function materialView(m, subjects, students, agg, creds, reqAgg) {
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

// Fills uploader credibility on a page of material views.
export function attachUploaderCredibility(db, rows) {
  const ids = [...new Set(rows.map((r) => r.uploaded_by))];
  if (!ids.length) return rows;
  const byId = credibilityOf(db, ids);
  for (const r of rows) {
    if (r.uploader) {
      r.uploader.credibility_score = byId.get(r.uploaded_by)?.credibility_score ?? null;
      r.uploader.rating_count = byId.get(r.uploaded_by)?.rating_count ?? 0;
    }
  }
  return rows;
}

export const asArray = (v) => (v === null || v === undefined || v === '' ? [] : (Array.isArray(v) ? v : [v]).filter((x) => x !== '' && x !== null && x !== undefined));

export function titleSimilarity(a, b) {
  const bigrams = (s) => {
    const t = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const out = new Map();
    for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); out.set(g, (out.get(g) || 0) + 1); }
    return out;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  for (const [g, n] of A) { inter += Math.min(n, B.get(g) || 0); total += n; }
  for (const n of B.values()) total += n;
  return total ? (2 * inter) / total : 0;
}
