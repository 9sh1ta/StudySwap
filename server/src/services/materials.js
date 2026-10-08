import {
  DbError, all, getRow, one, rule, insertRow, deleteRow, nextId, round2, isoDaysAgo, asArray, titleSimilarity,
  subjectMap, studentMap, ratingAgg, requestAgg, credibilityOf, materialView, publicSubject, attachUploaderCredibility, IN, J,
} from '../lib/core.js';
import { tx } from '../db/index.js';
import * as requests from './requests.js';
import * as ratings from './ratings.js';

const SORTS = {
  newest: (a, b) => b.upload_date.localeCompare(a.upload_date) || b.material_id - a.material_id,
  rating: (a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1) || b.rating_count - a.rating_count,
  requested: (a, b) => b.request_count - a.request_count || (b.avg_rating ?? -1) - (a.avg_rating ?? -1),
  credibility: (a, b) => (b.uploader?.credibility_score ?? -1) - (a.uploader?.credibility_score ?? -1) || (b.avg_rating ?? -1) - (a.avg_rating ?? -1),
};
export const SORT_KEYS = Object.keys(SORTS);

export function browse(db, params = {}) {
  const t0 = performance.now();
  const subjectIds = asArray(params.subjectId).map(Number);
  const types = asArray(params.type);
  const minRating = Number(params.minRating) || 0;
  const q = String(params.q || '').trim().toLowerCase();
  const semester = params.semester ? Number(params.semester) : null;
  const minCred = Number(params.minCredibility) || 0;
  const { dateFrom = null, dateTo = null, excludeUploader = null } = params;
  const sortKey = SORTS[params.sort] ? params.sort : 'newest';
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 12));
  const page = Math.max(1, Number(params.page) || 1);
  const needCred = sortKey === 'credibility' || minCred > 0;
  const needReq = sortKey === 'requested';

  const where = [];
  const p = [];
  if (subjectIds.length) { where.push(`m.subject_id ${IN}`); p.push(J(subjectIds)); }
  if (types.length) { where.push(`m.material_type ${IN}`); p.push(J(types)); }
  if (dateFrom) { where.push('m.upload_date >= ?'); p.push(dateFrom); }
  if (dateTo) { where.push('m.upload_date <= ?'); p.push(dateTo); }
  if (excludeUploader) { where.push('m.uploaded_by <> ?'); p.push(Number(excludeUploader)); }

  let rows = all(db, `SELECT m.* FROM Material m ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`, ...p);
  if (q) rows = rows.filter((m) => m.title.toLowerCase().includes(q));
  const subs = subjectMap(db);
  const studs = studentMap(db);
  if (semester) rows = rows.filter((m) => subs.get(m.subject_id)?.semester === semester);
  const ids = rows.map((m) => m.material_id);
  const agg = ratingAgg(db, ids);
  const reqAgg = needReq ? requestAgg(db, ids) : null;
  const creds = needCred ? credibilityOf(db, [...new Set(rows.map((m) => m.uploaded_by))]) : null;
  let out = rows.map((m) => materialView(m, subs, studs, agg, creds, reqAgg));
  if (minRating) out = out.filter((m) => (m.avg_rating ?? 0) >= minRating);
  if (minCred) out = out.filter((m) => (m.uploader?.credibility_score ?? 0) >= minCred);
  out.sort(SORTS[sortKey]);
  const total = out.length;
  const pageRows = out.slice((page - 1) * pageSize, page * pageSize);
  if (!needCred) attachUploaderCredibility(db, pageRows);
  return { rows: pageRows, total, page, pageSize, ms: Math.round((performance.now() - t0) * 100) / 100, queryId: null };
}

export function getById(db, id, { viewerId = null } = {}) {
  const row = getRow(db, 'Material', Number(id));
  if (!row) throw new DbError('NOT_FOUND', `No Material row with material_id = ${id}`);
  const subs = new Map([[row.subject_id, getRow(db, 'Subject', row.subject_id)]]);
  const studs = new Map([[row.uploaded_by, getRow(db, 'Student', row.uploaded_by)]]);
  const agg = ratingAgg(db, [row.material_id]);
  const reqAgg = requestAgg(db, [row.material_id]);
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
  attachUploaderCredibility(db, [view]);
  if (viewerId !== null) {
    view.viewer = {
      is_uploader: view.uploaded_by === viewerId,
      request: requests.latestFor(db, view.material_id, viewerId),
      has_rated: ratings.hasRated(db, view.material_id, viewerId),
    };
  }
  return view;
}

function viewsFor(db, mats, { withRequests = false } = {}) {
  const ids = mats.map((m) => m.material_id);
  const subs = subjectMap(db);
  const studs = studentMap(db);
  const agg = ratingAgg(db, ids);
  const reqAgg = withRequests ? requestAgg(db, ids) : null;
  return attachUploaderCredibility(db, mats.map((m) => materialView(m, subs, studs, agg, null, reqAgg)));
}

export function byUploader(db, studentId, { limit = null, excludeId = null } = {}) {
  let mats = all(db, 'SELECT * FROM Material WHERE uploaded_by = ?', studentId);
  if (excludeId) mats = mats.filter((m) => m.material_id !== Number(excludeId));
  const out = viewsFor(db, mats, { withRequests: true }).sort(SORTS.newest);
  return limit ? out.slice(0, Number(limit)) : out;
}

export function bySubject(db, subjectId, { excludeId = null, limit = 4 } = {}) {
  let mats = all(db, 'SELECT * FROM Material WHERE subject_id = ?', subjectId);
  if (excludeId) mats = mats.filter((m) => m.material_id !== Number(excludeId));
  return viewsFor(db, mats).sort(SORTS.rating).slice(0, Number(limit));
}

// Matched on the student's department + semester through a Subject join.
export function recommended(db, studentId, { limit = 6 } = {}) {
  const me = getRow(db, 'Student', studentId);
  if (!me) throw new DbError('NOT_FOUND', `No Student row with student_id = ${studentId}`);
  const mats = all(
    db,
    `SELECT m.* FROM Material m JOIN Subject s ON s.subject_id = m.subject_id
     WHERE s.department = ? AND s.semester = ? AND m.uploaded_by <> ?`, me.department, me.semester, studentId);
  return viewsFor(db, mats).filter((m) => m.rating_count >= 3).sort(SORTS.rating).slice(0, Number(limit));
}

// Trending: most ratings received in the last `days` days.
export function trending(db, { days = 7, limit = 5 } = {}) {
  const since = isoDaysAgo(Number(days));
  const counts = new Map();
  for (const r of all(db, 'SELECT material_id FROM Rating WHERE rating_date >= ?', since)) counts.set(r.material_id, (counts.get(r.material_id) || 0) + 1);
  const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(limit) * 3).map(([id]) => id);
  const mats = all(db, `SELECT * FROM Material WHERE material_id ${IN}`, J(topIds));
  return viewsFor(db, mats)
    .map((m) => ({ ...m, ratings_this_week: counts.get(m.material_id) }))
    .sort((a, b) => b.ratings_this_week - a.ratings_this_week || (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
    .slice(0, Number(limit));
}

// Duplicate detection: titles in the same subject above `threshold`.
export function similar(db, title, subjectId, { threshold = 0.7, limit = 5 } = {}) {
  if (!title || !subjectId) return [];
  return all(db, 'SELECT * FROM Material WHERE subject_id = ?', Number(subjectId))
    .map((m) => ({ material_id: m.material_id, title: m.title, material_type: m.material_type, uploaded_by: m.uploaded_by, score: round2(titleSimilarity(title, m.title)) }))
    .filter((m) => m.score > Number(threshold))
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(limit));
}

// Exam Mode: best Notes, PYQ and Summary per subject in the student's dept + semester.
export function cramPacks(db, studentId, { limit = 6 } = {}) {
  const me = getRow(db, 'Student', studentId);
  if (!me) throw new DbError('NOT_FOUND', `No Student row with student_id = ${studentId}`);
  const subs = subjectMap(db);
  const mine = [...subs.values()].filter((s) => s.department === me.department && s.semester === me.semester);
  const mats = all(db, `SELECT * FROM Material WHERE subject_id ${IN}`, J(mine.map((s) => s.subject_id)));
  const studs = studentMap(db);
  const agg = ratingAgg(db, mats.map((m) => m.material_id));
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
    .slice(0, Number(limit));
}

export function create(db, input) {
  const id = tx(db, () => {
    const newId = nextId(db, 'Material');
    return insertRow(db, 'Material', {
      material_id: newId,
      title: input.title,
      subject_id: input.subject_id === '' || input.subject_id == null ? null : Number(input.subject_id),
      uploaded_by: input.uploaded_by,
      material_type: input.material_type,
      upload_date: input.upload_date,
      // The form sends a template ('…/m/{material_id}.pdf'); the id is known only here.
      file_link: (input.file_link || 'https://files.studyswap.in/m/{material_id}.pdf').replace('{material_id}', newId),
      _ui: {
        thumbnail: null,
        pageCount: input._ui?.pageCount ?? 1,
        fileSize: input._ui?.fileSize ?? 0,
        tags: input._ui?.tags ?? [],
        description: input._ui?.description ?? '',
        syllabus_year: input._ui?.syllabus_year ?? new Date().getFullYear(),
        anonymous: !!input._ui?.anonymous,
      },
    }).material_id;
  });
  return getById(db, id);
}

// Rows that would block a DELETE (ON DELETE RESTRICT).
export function references(db, id) {
  const n = (sql) => db.prepare(sql).get(Number(id)).n;
  return {
    Rating: n('SELECT COUNT(*) AS n FROM Rating WHERE material_id = ?'),
    Swap_Request: n('SELECT COUNT(*) AS n FROM Swap_Request WHERE material_id = ?'),
  };
}

export function remove(db, id, actorId) {
  return tx(db, () => {
    const m = getRow(db, 'Material', Number(id));
    if (!m) throw new DbError('NOT_FOUND', `No Material row with material_id = ${id}`);
    if (m.uploaded_by !== actorId) throw rule('Only the uploader can delete this material.');
    deleteRow(db, 'Material', Number(id));
    return { material_id: Number(id) };
  });
}
