import { all, getRow, insertRow, rule, studentMap, IN, J } from '../lib/core.js';

// Sub-scores are averaged into the single Rating.score column.
export function scoreFrom(rating) {
  if (!rating) return null;
  const { completeness, legibility, accuracy } = rating;
  if ([completeness, legibility, accuracy].every((v) => v !== undefined && v !== null && v !== '')) {
    return Math.round((Number(completeness) + Number(legibility) + Number(accuracy)) / 3);
  }
  return rating.score;
}

export function insertRating(db, { material_id, rated_by, comment = null, ...rest }) {
  const m = getRow(db, 'Material', Number(material_id));
  if (m && m.uploaded_by === rated_by) throw rule('Uploaders cannot rate their own material.');
  const score = scoreFrom(rest);
  const subs = rest.completeness !== undefined
    ? { completeness: Number(rest.completeness), legibility: Number(rest.legibility), accuracy: Number(rest.accuracy) }
    : {};
  return insertRow(db, 'Rating', {
    material_id: material_id === '' || material_id == null ? null : Number(material_id),
    rated_by,
    score,
    comment,
    _ui: subs,
  });
}

function ratingView(r, studs, mats) {
  const s = studs.get(r.rated_by);
  const m = mats.get(r.material_id);
  return {
    ...r,
    rater: s ? { student_id: s.student_id, name: s.name, department: s.department, semester: s.semester } : null,
    material: m ? { material_id: m.material_id, title: m.title, material_type: m.material_type, subject_id: m.subject_id } : null,
  };
}
const byDateDesc = (a, b) => b.rating_date.localeCompare(a.rating_date) || b.rating_id - a.rating_id;
const matMap = (db, ids) => new Map(all(db, `SELECT * FROM Material WHERE material_id ${IN}`, J(ids)).map((m) => [m.material_id, m]));

export const create = (db, input) => insertRating(db, input);

export function forMaterial(db, materialId) {
  const rows = all(db, 'SELECT * FROM Rating WHERE material_id = ?', Number(materialId));
  const mats = matMap(db, [Number(materialId)]);
  const studs = studentMap(db);
  return rows.map((r) => ratingView(r, studs, mats)).sort(byDateDesc);
}

export function byStudent(db, studentId) {
  const rows = all(db, 'SELECT * FROM Rating WHERE rated_by = ?', studentId);
  const mats = matMap(db, [...new Set(rows.map((r) => r.material_id))]);
  const studs = studentMap(db);
  return rows.map((r) => ratingView(r, studs, mats)).sort(byDateDesc);
}

export function receivedBy(db, studentId) {
  const rows = all(db, 'SELECT r.* FROM Rating r JOIN Material m ON m.material_id = r.material_id WHERE m.uploaded_by = ?', studentId);
  const mats = matMap(db, [...new Set(rows.map((r) => r.material_id))]);
  const studs = studentMap(db);
  return rows.map((r) => ratingView(r, studs, mats)).sort(byDateDesc);
}

export const hasRated = (db, materialId, studentId) =>
  !!db.prepare('SELECT 1 FROM Rating WHERE material_id = ? AND rated_by = ?').get(materialId, studentId);
