import jwt from 'jsonwebtoken';
import { DbError } from '../lib/core.js';

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') console.warn('[auth] JWT_SECRET not set — using an insecure dev secret.');

export const signToken = (studentId) => jwt.sign({ sub: studentId }, SECRET, { expiresIn: '7d' });

const readToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

export function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(new DbError('AUTH', 'Please sign in to continue.', { status: 401 }));
  try {
    req.userId = Number(jwt.verify(token, SECRET).sub);
    next();
  } catch {
    next(new DbError('AUTH', 'Your session has expired. Please sign in again.', { status: 401 }));
  }
}

export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) { try { req.userId = Number(jwt.verify(token, SECRET).sub); } catch { /* anonymous */ } }
  next();
}
