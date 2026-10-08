// Loads the frontend's deterministic seed (src/shared/seed.js) into SQLite.
// Rows go in through plain INSERTs, so the database's own constraints validate the seed.
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { TABLES } from '../shared/schema.js';
import { buildSeed, DEMO_PASSWORD } from '../shared/seed.js';
import { openDb, tx, DEFAULT_FILE } from './index.js';

const ORDER = ['Subject', 'Student', 'Material', 'Swap_Request', 'Rating'];

export function seedDatabase(db, now = new Date()) {
  const seed = buildSeed(now);
  const hashes = new Map(); // one bcrypt per distinct password
  const hashOf = (pw) => {
    if (!hashes.has(pw)) hashes.set(pw, bcrypt.hashSync(pw, 10));
    return hashes.get(pw);
  };
  tx(db, () => {
    for (const table of ORDER) {
      const cols = [...TABLES[table].columns.filter((c) => !c.derived).map((c) => c.name), '_ui'];
      const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
      for (const row of seed.tables[table]) {
        stmt.run(...cols.map((c) => (c === '_ui' ? (row._ui ? JSON.stringify(row._ui) : null) : row[c] ?? null)));
      }
    }
    const cred = db.prepare('INSERT INTO Credential (student_id, password_hash) VALUES (?, ?)');
    for (const [id, pw] of Object.entries(seed.auth)) cred.run(Number(id), hashOf(pw));
  });
  return Object.fromEntries(ORDER.map((t) => [t, seed.tables[t].length]));
}

export const isEmpty = (db) => db.prepare('SELECT COUNT(*) AS n FROM Student').get().n === 0;

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.env.DB_FILE || DEFAULT_FILE;
  if (process.argv.includes('--reset')) for (const s of ['', '-wal', '-shm']) fs.rmSync(file + s, { force: true });
  const db = openDb(file);
  if (!isEmpty(db)) console.log('Database already has data. Run `npm run reset` to start over.');
  else console.log('Seeded:', seedDatabase(db), `\nDemo password: ${DEMO_PASSWORD}`);
}
