import { DbError, all, getRow, rule, insertRow, round2, subjectMap, studentMap, ratingAgg, credibilityOf, materialView, publicStudent } from '../lib/core.js';
import { tx } from '../db/index.js';

// B "needs" a subject if it is in B's department + semester, or B has already
// requested material in it. A perfect match: each side uploaded something the
// other needs and hasn't requested yet.
export function findMutualSwaps(db, studentId, { limit = 8 } = {}) {
  if (!getRow(db, 'Student', studentId)) throw new DbError('NOT_FOUND', `No Student row with student_id = ${studentId}`);
  const subs = subjectMap(db);
  const studs = studentMap(db);
  const mats = all(db, 'SELECT * FROM Material');
  const reqs = all(db, 'SELECT requester_id, material_id FROM Swap_Request');
  const needs = new Map();
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
  const agg = ratingAgg(db, null);
  const avg = (m) => { const a = agg.get(m.material_id); return a ? a.sum / a.count : 0; };
  const best = (list) => [...list].sort((p, q) => avg(q) - avg(p)).slice(0, 3);
  const myMats = byUploader.get(studentId) || [];
  const myNeeds = needs.get(studentId);
  const creds = credibilityOf(db, null);

  const perfect = [];
  const near = [];
  for (const other of studs.values()) {
    if (other.student_id === studentId) continue;
    const theirNeeds = needs.get(other.student_id);
    const give = myMats.filter((m) => theirNeeds.has(m.subject_id) && !requested.has(`${other.student_id}:${m.material_id}`));
    const get = (byUploader.get(other.student_id) || []).filter((m) => myNeeds.has(m.subject_id) && !requested.has(`${studentId}:${m.material_id}`));
    if (!give.length && !get.length) continue;
    const view = (m) => materialView(m, subs, studs, agg);
    const entry = { student: publicStudent(other, creds.get(other.student_id)), give: best(give).map(view), get: best(get).map(view) };
    if (give.length && get.length) {
      const q = (avg(entry.give[0]) + avg(entry.get[0])) / 10;
      const c = (creds.get(other.student_id)?.credibility_score ?? 3) / 5;
      entry.strength = round2(Math.min(1, 0.35 * Math.min(1, (give.length + get.length) / 6) + 0.4 * q + 0.25 * c));
      perfect.push(entry);
    } else if (get.length) {
      entry.strength = null;
      entry.missing = 'give';
      near.push(entry);
    }
  }
  perfect.sort((a, b) => b.strength - a.strength);
  near.sort((a, b) => (b.student.credibility_score ?? 0) - (a.student.credibility_score ?? 0));
  return { perfect: perfect.slice(0, limit), near: near.slice(0, limit) };
}

// Two linked Swap_Request rows, one in each direction (one transaction).
export function propose(db, studentId, otherId, giveMaterialId, getMaterialId, message = null) {
  return tx(db, () => {
    const give = getRow(db, 'Material', Number(giveMaterialId));
    const get = getRow(db, 'Material', Number(getMaterialId));
    if (give && give.uploaded_by !== studentId) throw rule('You can only offer your own material.');
    if (get && get.uploaded_by !== Number(otherId)) throw rule('That material does not belong to the other student.');
    const a = insertRow(db, 'Swap_Request', { requester_id: studentId, material_id: Number(getMaterialId), status: 'Pending', message, _ui: { offer_material_id: Number(giveMaterialId), reject_reason: null, linked_request_id: null } });
    const b = insertRow(db, 'Swap_Request', { requester_id: Number(otherId), material_id: Number(giveMaterialId), status: 'Pending', message, _ui: { offer_material_id: Number(getMaterialId), reject_reason: null, linked_request_id: a.request_id } });
    db.prepare('UPDATE Swap_Request SET _ui = ? WHERE request_id = ?').run(JSON.stringify({ ...a._ui, linked_request_id: b.request_id }), a.request_id);
    return [getRow(db, 'Swap_Request', a.request_id), b];
  });
}
