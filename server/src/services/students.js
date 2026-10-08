import { DbError, all, getRow, credibilityOf, publicStudent, studentMap, ratingAgg, round2, IN, J } from '../lib/core.js';

export function getById(db, id) {
  const s = getRow(db, 'Student', id);
  if (!s) throw new DbError('NOT_FOUND', `No Student row with student_id = ${id}`);
  return publicStudent(s, credibilityOf(db, [id]).get(id));
}

export const credibility = (db, id) => {
  getById(db, id);
  return credibilityOf(db, [id]).get(id);
};

export function stats(db, id) {
  getById(db, id);
  const q = (sql) => db.prepare(sql).get(id).n;
  const mats = all(db, 'SELECT material_id FROM Material WHERE uploaded_by = ?', id).map((m) => m.material_id);
  const incoming = all(db, `SELECT status FROM Swap_Request WHERE material_id ${IN}`, J(mats));
  const outgoing = all(db, 'SELECT status FROM Swap_Request WHERE requester_id = ?', id);
  const cred = credibilityOf(db, [id]).get(id);
  const responded = incoming.filter((r) => r.status !== 'Pending');
  const accepted = responded.filter((r) => r.status === 'Accepted' || r.status === 'Completed');
  return {
    student_id: id,
    uploads: mats.length,
    ratings_received: cred.rating_count,
    credibility_score: cred.credibility_score,
    ratings_given: q('SELECT COUNT(*) AS n FROM Rating WHERE rated_by = ?'),
    pending_incoming: incoming.filter((r) => r.status === 'Pending').length,
    pending_outgoing: outgoing.filter((r) => r.status === 'Pending').length,
    accepted_outgoing: outgoing.filter((r) => r.status === 'Accepted').length,
    swaps_completed: outgoing.filter((r) => r.status === 'Completed').length + incoming.filter((r) => r.status === 'Completed').length,
    acceptance_rate: responded.length ? round2(accepted.length / responded.length) : null,
  };
}

// Credibility at the end of each of the last `months` months (cumulative).
export function credibilityTrend(db, id, months = 6) {
  const ratings = all(
    db,
    `SELECT r.score, r.rating_date FROM Rating r JOIN Material m ON m.material_id = r.material_id
     WHERE m.uploaded_by = ? ORDER BY r.rating_date`, id);
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

export function leaderboard(db, { department = null, limit = 50, minRatings = 5 } = {}) {
  const creds = credibilityOf(db, null);
  const uploads = new Map(all(db, 'SELECT uploaded_by, COUNT(*) AS n FROM Material GROUP BY uploaded_by').map((r) => [r.uploaded_by, r.n]));
  return [...studentMap(db).values()]
    .filter((s) => (!department || s.department === department) && uploads.get(s.student_id))
    .map((s) => ({ ...publicStudent(s, creds.get(s.student_id)), upload_count: uploads.get(s.student_id) }))
    .filter((s) => s.rating_count >= minRatings)
    .sort((a, b) => (b.credibility_score ?? -1) - (a.credibility_score ?? -1) || b.rating_count - a.rating_count)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

export function departmentLeaderboard(db) {
  const studs = studentMap(db);
  const agg = ratingAgg(db, null);
  const out = new Map();
  for (const m of all(db, 'SELECT material_id, uploaded_by FROM Material')) {
    const dept = studs.get(m.uploaded_by)?.department;
    const d = out.get(dept) || { department: dept, sum: 0, ratings: 0, materials: 0 };
    const a = agg.get(m.material_id);
    d.materials += 1;
    if (a) { d.sum += a.sum; d.ratings += a.count; }
    out.set(dept, d);
  }
  return [...out.values()]
    .map((d) => ({ department: d.department, avg_score: d.ratings ? round2(d.sum / d.ratings) : null, materials: d.materials, ratings: d.ratings }))
    .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0));
}
