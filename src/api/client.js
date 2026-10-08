// ── SWAP POINT — DONE ────────────────────────────────────────
// Every marketplace call now goes to the real backend (server/) over /api.
// Signatures and return shapes are unchanged, so pages need no edits.
//
// Switch back to the in-browser mock database any time by setting
//   VITE_USE_API=false      (in a .env file at the project root, then restart Vite)
//
// DB Lab / Query Inspector (`database` below) always runs on the mock database,
// because the plan trees, index toggle and constraint tester are features of
// data/db.js, not of the backend.
// ─────────────────────────────────────────────────────────────
import * as db from '../data/db.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/seed.js';

export { DbError } from '../data/db.js';
const { DbError } = db;

const USE_API = import.meta.env?.VITE_USE_API !== 'false';
const API_BASE = import.meta.env?.VITE_API_BASE || '/api';
const SESSION_KEY = 'studyswap.session';

// ── Session ──────────────────────────────────────────────────
// API mode stores { student_id, token }; mock mode stores { student_id }.
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSession(studentId, remember, token) {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (studentId !== null) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify({ student_id: studentId, token }));
  } catch {
    /* storage unavailable — session lasts until reload */
  }
}

// ── Mock-mode helpers (unchanged from the prototype) ─────────
function sleep(min = 120, max = 350) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}
async function call(fn, latency) {
  await sleep(...(latency || []));
  return fn();
}
const maybeBg = (opts, fn) => (opts?.background ? () => db.background(fn) : fn);

// ── API-mode helpers ─────────────────────────────────────────
function queryString(query) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '') continue;
    for (const item of Array.isArray(v) ? v : [v]) if (item !== '' && item !== null && item !== undefined) p.append(k, item);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function http(method, path, { query, body } = {}) {
  const token = readSession()?.token;
  let res;
  try {
    res = await fetch(API_BASE + path + queryString(query), {
      method,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new DbError('NETWORK', 'Cannot reach the StudySwap server.', {
      detail: 'Start the backend (npm run dev inside the server folder), or set VITE_USE_API=false to use the built-in mock database.',
    });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error || {};
    throw new DbError(e.code || 'SERVER', e.message || `Request failed (${res.status}).`, { detail: e.detail, table: e.table, column: e.column, refs: e.refs });
  }
  return data;
}
const get = (path, query) => http('GET', path, { query });
const post = (path, body = {}) => http('POST', path, { body });
const del = (path) => http('DELETE', path);
const pick = (obj, ...keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

// Writes made through the API announce themselves so badges and the header
// credibility refresh (this replaces the mock DB's commit notifications).
const writeListeners = new Set();
function committed(tables, result) {
  const entry = { kind: 'write', scan: 'COMMIT', tables };
  // After the response, so listeners re-read fresh data.
  queueMicrotask(() => writeListeners.forEach((fn) => fn(entry)));
  return result;
}

// ── Auth ─────────────────────────────────────────────────────
export const auth = {
  // → Student (with credibility_score). Throws DbError('AUTH') on bad credentials.
  login: (email, password, { remember = true } = {}) =>
    USE_API
      ? post('/auth/login', { email, password }).then(({ token, student }) => (writeSession(student.student_id, remember, token), student))
      : call(() => {
          const student = db.auth.verify(email, password);
          writeSession(student.student_id, remember);
          return student;
        }),

  // One-click demo login (Login screen).
  loginAs: (studentId) =>
    USE_API
      ? post('/auth/login-as', { student_id: studentId }).then(({ token, student }) => (writeSession(student.student_id, true, token), student))
      : call(() => {
          const student = db.students.getById(studentId);
          writeSession(student.student_id, true);
          return student;
        }),

  // { name, email, department, semester, password } → Student
  register: (input) =>
    USE_API
      ? post('/auth/register', input).then(({ token, student }) => (writeSession(student.student_id, true, token), committed(['Student'], student)))
      : call(() => {
          const student = db.auth.register(input);
          writeSession(student.student_id, true);
          return student;
        }),

  // Live UNIQUE check for the register form → boolean
  emailTaken: (email) => (USE_API ? get('/auth/email-taken', { email }).then((r) => r.taken) : call(() => db.auth.emailTaken(email), [150, 300])),

  // → Student | null
  currentUser: (opts) =>
    USE_API
      ? (async () => {
          if (!readSession()?.token) return null;
          try {
            return await get('/auth/me');
          } catch (e) {
            if (e.code === 'AUTH') {
              writeSession(null);
              return null;
            }
            throw e;
          }
        })()
      : call(() => {
          const s = readSession();
          if (!s) return null;
          try {
            return maybeBg(opts, () => db.students.getById(s.student_id))();
          } catch {
            writeSession(null);
            return null;
          }
        }, [60, 120]),

  // Synchronous peek for first render → student_id | null
  sessionId: () => {
    const s = readSession();
    if (!s) return null;
    if (USE_API && !s.token) return null; // a mock-mode session can't be used against the API
    return s.student_id ?? null;
  },

  logout: () => (USE_API ? Promise.resolve(writeSession(null)) : call(() => writeSession(null), [60, 120])),

  // → [{ student_id, label, note, name, department, semester }]
  demoAccounts: () =>
    USE_API
      ? get('/auth/demo-accounts')
      : call(
          () =>
            db.background(() =>
              DEMO_ACCOUNTS.map((a) => {
                const s = db.students.getById(a.student_id);
                return { ...a, name: s.name, email: s.email, department: s.department, semester: s.semester };
              })
            ),
          [60, 120]
        ),
  demoPassword: DEMO_PASSWORD,
};

// ── Materials ────────────────────────────────────────────────
export const materials = {
  // ({ subjectId, type, minRating, q, sort, page, pageSize, semester,
  //    minCredibility, dateFrom, dateTo, excludeUploader })
  // → { rows, total, page, pageSize, ms, queryId }
  browse: (params) =>
    USE_API
      ? get('/materials', pick(params, 'subjectId', 'type', 'minRating', 'q', 'sort', 'page', 'pageSize', 'semester', 'minCredibility', 'dateFrom', 'dateTo', 'excludeUploader'))
      : call(() => db.materials.browse(params)),
  // → Material view + distribution, sub_scores, viewer { is_uploader, request, has_rated }
  getById: (id, opts) =>
    USE_API ? get(`/materials/${Number(id)}`, { viewer: opts?.viewerId != null ? 1 : undefined }) : call(() => db.materials.getById(Number(id), opts)),
  // ({ title, subject_id, uploaded_by, material_type, file_link?, _ui }) → Material view
  create: (input) => (USE_API ? post('/materials', input).then((r) => committed(['Material'], r)) : call(() => db.materials.create(input), [350, 600])),
  byUploader: (studentId, opts) =>
    USE_API ? get(`/materials/by-uploader/${Number(studentId)}`, pick(opts, 'limit', 'excludeId')) : call(() => db.materials.byUploader(Number(studentId), opts)),
  bySubject: (subjectId, opts) =>
    USE_API ? get(`/materials/by-subject/${Number(subjectId)}`, pick(opts, 'limit', 'excludeId')) : call(() => db.materials.bySubject(Number(subjectId), opts)),
  recommended: (studentId, opts) =>
    USE_API ? get(`/materials/recommended/${Number(studentId)}`, pick(opts, 'limit')) : call(() => db.materials.recommended(Number(studentId), opts)),
  trending: (opts) => (USE_API ? get('/materials/trending', pick(opts, 'days', 'limit')) : call(() => db.materials.trending(opts))),
  // Exam Mode: best Notes + PYQ + Summary per subject for this student
  cramPacks: (studentId, opts) =>
    USE_API ? get(`/materials/cram-packs/${Number(studentId)}`, pick(opts, 'limit')) : call(() => db.materials.cramPacks(Number(studentId), opts)),
  similar: (title, subjectId, opts) =>
    USE_API ? get('/materials/similar', { title, subjectId, ...pick(opts, 'threshold', 'limit') }) : call(() => db.materials.similar(title, subjectId, opts), [100, 200]),
  // → { Rating: n, Swap_Request: n } — rows that would block a DELETE
  references: (id) => (USE_API ? get(`/materials/${Number(id)}/references`) : call(() => db.materials.references(Number(id)))),
  remove: (id, actorId) =>
    USE_API ? del(`/materials/${Number(id)}`).then((r) => committed(['Material'], r)) : call(() => db.materials.remove(Number(id), actorId)),
};

export const subjects = {
  list: () => (USE_API ? get('/subjects') : call(() => db.subjects.list())),
  // ({ subject_name, department, semester }) → Subject
  create: (input) => (USE_API ? post('/subjects', input).then((r) => committed(['Subject'], r)) : call(() => db.subjects.create(input))),
  byDepartment: (department) =>
    USE_API ? get(`/subjects/by-department/${encodeURIComponent(department)}`) : call(() => db.subjects.byDepartment(department)),
};

// ── Requests ─────────────────────────────────────────────────
export const requests = {
  // ({ requester_id, material_id, message, offer_material_id }) → Swap_Request
  create: (input) => (USE_API ? post('/requests', input).then((r) => committed(['Swap_Request'], r)) : call(() => db.requests.create(input))),
  incoming: (studentId, opts) =>
    USE_API ? get('/requests/incoming', pick(opts, 'status')) : call(() => db.requests.incoming(Number(studentId), opts)),
  outgoing: (studentId, opts) =>
    USE_API ? get('/requests/outgoing', pick(opts, 'status')) : call(() => db.requests.outgoing(Number(studentId), opts)),
  // (request_id, actor_id, 'Accepted' | 'Rejected', reason?) → Swap_Request
  respond: (requestId, actorId, status, reason) =>
    USE_API
      ? post(`/requests/${requestId}/respond`, { status, reason }).then((r) => committed(['Swap_Request'], r))
      : call(() => db.requests.respond(requestId, actorId, status, reason)),
  // → { request, rating } — status='Completed' + Rating insert in one transaction
  complete: (requestId, actorId, rating) =>
    USE_API
      ? post(`/requests/${requestId}/complete`, { rating }).then((r) => committed(['Swap_Request', 'Rating'], r))
      : call(() => db.requests.complete(requestId, actorId, rating)),
  withdraw: (requestId, actorId) =>
    USE_API ? del(`/requests/${requestId}`).then((r) => committed(['Swap_Request'], r)) : call(() => db.requests.withdraw(requestId, actorId)),
};

export const ratings = {
  // ({ material_id, rated_by, score | completeness+legibility+accuracy, comment }) → Rating
  create: (input) => (USE_API ? post('/ratings', input).then((r) => committed(['Rating'], r)) : call(() => db.ratings.create(input))),
  forMaterial: (materialId) => (USE_API ? get(`/ratings/material/${Number(materialId)}`) : call(() => db.ratings.forMaterial(Number(materialId)))),
  byStudent: (studentId) => (USE_API ? get(`/ratings/by-student/${Number(studentId)}`) : call(() => db.ratings.byStudent(Number(studentId)))),
  receivedBy: (studentId) => (USE_API ? get(`/ratings/received-by/${Number(studentId)}`) : call(() => db.ratings.receivedBy(Number(studentId)))),
};

export const students = {
  getById: (id) => (USE_API ? get(`/students/${Number(id)}`) : call(() => db.students.getById(Number(id)))),
  // → { student_id, credibility_score, rating_count } from vw_student_credibility
  credibility: (id) => (USE_API ? get(`/students/${Number(id)}/credibility`) : call(() => db.students.credibility(Number(id)))),
  stats: (id, opts) => (USE_API ? get(`/students/${Number(id)}/stats`) : call(maybeBg(opts, () => db.students.stats(Number(id))))),
  credibilityTrend: (id, months) =>
    USE_API ? get(`/students/${Number(id)}/credibility-trend`, { months }) : call(() => db.students.credibilityTrend(Number(id), months)),
  leaderboard: (opts) => (USE_API ? get('/leaderboard', pick(opts, 'department', 'limit', 'minRatings')) : call(() => db.students.leaderboard(opts))),
  departmentLeaderboard: () => (USE_API ? get('/leaderboard/departments') : call(() => db.students.departmentLeaderboard())),
};

export const matches = {
  // → { perfect: [{ student, give[], get[], strength }], near: [...] }
  findMutualSwaps: (studentId, opts) =>
    USE_API ? get('/matches/mutual-swaps', pick(opts, 'limit')) : call(() => db.matches.findMutualSwaps(Number(studentId), opts)),
  // Creates two linked Swap_Request rows → [Swap_Request, Swap_Request]
  propose: (studentId, otherId, giveMaterialId, getMaterialId, message) =>
    USE_API
      ? post('/matches/propose', { other_id: Number(otherId), give_material_id: giveMaterialId, get_material_id: getMaterialId, message }).then((r) => committed(['Swap_Request'], r))
      : call(() => db.matches.propose(Number(studentId), Number(otherId), giveMaterialId, getMaterialId, message)),
};

export const activity = {
  recent: (studentId, opts) =>
    USE_API ? get('/activity/recent', pick(opts, 'limit')) : call(maybeBg(opts, () => db.activity.recent(Number(studentId), opts))),
};

export const search = {
  all: (q, opts) => (USE_API ? get('/search', { q, ...pick(opts, 'limit') }) : call(() => db.search.all(q, opts), [60, 140])),
};

// Database introspection for the Query Inspector and DB Lab (always the mock DB).
export const database = {
  queryLog: (limit) => db.admin.queryLog(limit),
  latestQuery: (opts) => db.admin.latestQuery(opts),
  subscribe: (fn) => db.admin.subscribe(fn),
  // Committed writes from BOTH sources: the real backend (API mode) and the mock DB (DB Lab).
  onWrite: (fn) => {
    writeListeners.add(fn);
    const off = db.admin.subscribe((entry) => {
      if (entry.kind === 'write' && entry.scan === 'COMMIT') fn(entry);
    });
    return () => {
      writeListeners.delete(fn);
      off?.();
    };
  },
  rerun: (queryId, useIndexes) => db.admin.rerun(queryId, useIndexes),
  useIndexes: () => db.admin.getUseIndexes(),
  toggleIndexes: (on) => db.admin.setUseIndexes(on === undefined ? !db.admin.getUseIndexes() : on),
  counts: () => db.admin.counts(),
  indexStats: () => db.admin.indexStats(),
  rows: (table, opts) => call(() => db.admin.rows(table, opts)),
  tryInsert: (table, row) => call(() => db.admin.tryInsert(table, row), [150, 300]),
  views: { vw_student_credibility: (id) => call(() => db.views.vw_student_credibility(id ?? null)) },
  seededAt: () => db.admin.seededAt(),
  reset: (opts) => call(() => db.admin.reset(opts), [300, 500]),
};

// The spec names this group `db`; `database` is the same object.
export { database as db };
