import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { DbError } from './lib/core.js';

const STATUS = { AUTH: 401, NOT_FOUND: 404, UNIQUE: 409, PRIMARY_KEY: 409, FOREIGN_KEY: 409, RULE: 409 };

export function createApp(db) {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', routes(db));
  app.use('/api', (_req, _res, next) => next(new DbError('NOT_FOUND', 'No such API route.', { status: 404 })));

  // Every failure leaves as { error: { code, message, detail, ... } } — the shape
  // the frontend turns back into a DbError.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') err = new DbError('TYPE', 'Request body is not valid JSON.', { status: 400 });
    if (!(err instanceof DbError)) {
      const msg = String(err.message || '');
      if (/constraint failed/i.test(msg)) {
        const code = /UNIQUE/i.test(msg) ? 'UNIQUE' : /FOREIGN KEY/i.test(msg) ? 'FOREIGN_KEY' : /NOT NULL/i.test(msg) ? 'NOT_NULL' : 'CHECK';
        err = new DbError(code, msg, { detail: 'Rejected by the database.' });
      } else {
        console.error(err);
        err = new DbError('SERVER', 'Something went wrong on the server.', { status: 500 });
      }
    }
    const { code, message, detail, table, column, refs } = err;
    res.status(err.status ?? STATUS[code] ?? 400).json({ error: { code, message, detail, table, column, refs } });
  });
  return app;
}
