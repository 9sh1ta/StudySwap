import { all, insertRow, publicSubject } from '../lib/core.js';

export const list = (db) =>
  all(db, `SELECT s.*, (SELECT COUNT(*) FROM Material m WHERE m.subject_id = s.subject_id) AS material_count FROM Subject s`)
    .map((s) => ({ ...publicSubject(s), material_count: s.material_count }))
    .sort((a, b) => a.department.localeCompare(b.department) || a.semester - b.semester || a.subject_name.localeCompare(b.subject_name));

export const create = (db, { subject_name, department, semester }) =>
  insertRow(db, 'Subject', {
    subject_name,
    department,
    semester: semester === '' || semester == null ? null : Number(semester),
    _ui: { code: null, added_by_user: true },
  });

export const byDepartment = (db, department) =>
  all(db, 'SELECT * FROM Subject WHERE department = ? ORDER BY semester, subject_name', department).map(publicSubject);
