import { all, getRow, studentMap, publicSubject, IN, J } from '../lib/core.js';

// Dashboard feed: requests on my materials, responses to my requests, ratings on my materials.
export function recent(db, studentId, { limit = 8 } = {}) {
  const mine = new Map(all(db, 'SELECT * FROM Material WHERE uploaded_by = ?', studentId).map((m) => [m.material_id, m]));
  const ids = J([...mine.keys()]);
  const studs = studentMap(db);
  const incoming = all(db, `SELECT * FROM Swap_Request WHERE material_id ${IN}`, ids);
  const outgoing = all(db, 'SELECT * FROM Swap_Request WHERE requester_id = ?', studentId);
  const rated = all(db, `SELECT * FROM Rating WHERE material_id ${IN}`, ids);
  const titleOf = (id) => mine.get(id)?.title || getRow(db, 'Material', id)?.title;
  const items = [
    ...incoming.map((r) => ({ kind: 'request', at: r.request_date, ref: r.request_id, actor: studs.get(r.requester_id)?.name, material_id: r.material_id, title: titleOf(r.material_id), status: r.status })),
    ...outgoing.filter((r) => r.response_date).map((r) => ({
      kind: 'response', at: r.response_date, ref: r.request_id,
      actor: studs.get(getRow(db, 'Material', r.material_id)?.uploaded_by)?.name,
      material_id: r.material_id, title: titleOf(r.material_id), status: r.status,
    })),
    ...rated.map((r) => ({ kind: 'rating', at: r.rating_date, ref: r.rating_id, actor: studs.get(r.rated_by)?.name, material_id: r.material_id, title: titleOf(r.material_id), score: r.score })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at) || b.ref - a.ref).slice(0, Number(limit));
}

// Global search (command palette): substring hits first, then in-order subsequence matches.
export function searchAll(db, q, { limit = 5 } = {}) {
  const term = String(q || '').trim().toLowerCase();
  if (!term) return { materials: [], subjects: [], students: [] };
  const score = (text) => {
    const t = text.toLowerCase();
    const i = t.indexOf(term);
    if (i >= 0) return 100 - i;
    let j = 0;
    for (const ch of t) if (ch === term[j]) j++;
    return j === term.length ? 10 : -1;
  };
  const rank = (rows, get) =>
    rows.map((r) => [r, score(get(r))]).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1]).slice(0, Number(limit)).map(([r]) => r);
  return {
    materials: rank(all(db, 'SELECT * FROM Material'), (m) => m.title).map((m) => ({ material_id: m.material_id, title: m.title, material_type: m.material_type, subject_id: m.subject_id })),
    subjects: rank(all(db, 'SELECT * FROM Subject'), (s) => `${s.subject_name} ${s._ui?.code || ''}`).map(publicSubject),
    students: rank(all(db, 'SELECT * FROM Student'), (s) => s.name).map((s) => ({ student_id: s.student_id, name: s.name, department: s.department, semester: s.semester })),
  };
}
