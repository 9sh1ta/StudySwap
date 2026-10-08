import bcrypt from 'bcryptjs';
import { DbError, rule, insertRow, getRow, one, today } from '../lib/core.js';
import { tx } from '../db/index.js';
import { DEMO_ACCOUNTS } from '../shared/seed.js';
import * as students from './students.js';

export const DEMO_LOGIN_ENABLED = process.env.ALLOW_DEMO_LOGIN !== 'false' && process.env.NODE_ENV !== 'production';

export function verify(db, email, password) {
  const e = String(email || '').trim().toLowerCase();
  const row = one(db, 'SELECT student_id FROM Student WHERE email = ? COLLATE NOCASE', e);
  if (!row) {
    throw new DbError('AUTH', 'No account is registered with that email.', {
      detail: 'Check the address, create an account, or use one of the demo accounts above.',
    });
  }
  const cred = one(db, 'SELECT password_hash FROM Credential WHERE student_id = ?', row.student_id);
  if (!cred || !bcrypt.compareSync(String(password ?? ''), cred.password_hash)) {
    throw new DbError('AUTH', 'That password does not match this account.', {
      detail: 'Seeded demo accounts all use the password shown below the field.',
    });
  }
  return students.getById(db, row.student_id);
}

export function register(db, { name, email, department, semester, password }) {
  if (!password || password.length < 8) throw rule('Password must be at least 8 characters.');
  const id = tx(db, () => {
    const r = insertRow(db, 'Student', {
      name,
      email: String(email || '').trim().toLowerCase(),
      department,
      semester,
      _ui: { reg_no: null, joined: today() },
    });
    db.prepare('INSERT INTO Credential (student_id, password_hash) VALUES (?, ?)').run(r.student_id, bcrypt.hashSync(password, 10));
    return r.student_id;
  });
  return students.getById(db, id);
}

export const emailTaken = (db, email) =>
  !!one(db, 'SELECT 1 AS x FROM Student WHERE email = ? COLLATE NOCASE', String(email || '').trim().toLowerCase());

// One-click demo login: only the seeded demo accounts, and only when enabled.
export function loginAs(db, studentId) {
  if (!DEMO_LOGIN_ENABLED) throw new DbError('AUTH', 'Demo login is disabled on this server.');
  if (!DEMO_ACCOUNTS.some((a) => a.student_id === Number(studentId))) throw new DbError('AUTH', 'That is not a demo account.');
  return students.getById(db, Number(studentId));
}

export const demoAccounts = (db) =>
  DEMO_ACCOUNTS.map((a) => {
    const s = getRow(db, 'Student', a.student_id);
    return s ? { ...a, name: s.name, email: s.email, department: s.department, semester: s.semester } : null;
  }).filter(Boolean);
