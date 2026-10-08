import { Router } from 'express';
import { DbError } from '../lib/core.js';
import { signToken, requireAuth, optionalAuth } from '../middleware/auth.js';
import * as auth from '../services/auth.js';
import * as students from '../services/students.js';
import * as subjects from '../services/subjects.js';
import * as materials from '../services/materials.js';
import * as requests from '../services/requests.js';
import * as ratings from '../services/ratings.js';
import * as matches from '../services/matches.js';
import * as misc from '../services/misc.js';

const num = (v, name = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new DbError('TYPE', `Type error: ${name} expects INT`, { detail: `Got ${JSON.stringify(v)}.`, status: 400 });
  return n;
};
const self = (req, id, what) => {
  if (num(id, 'student_id') !== req.userId) throw new DbError('RULE', `You can only view your own ${what}.`, { status: 403 });
  return req.userId;
};
const opt = (q, ...keys) => Object.fromEntries(keys.filter((k) => q[k] !== undefined).map((k) => [k, q[k]]));

export default function routes(db) {
  const r = Router();
  const session = (student) => ({ token: signToken(student.student_id), student });

  // ── Auth ────────────────────────────────────────────────
  r.post('/auth/login', (req, res) => res.json(session(auth.verify(db, req.body.email, req.body.password))));
  r.post('/auth/login-as', (req, res) => res.json(session(auth.loginAs(db, req.body.student_id))));
  r.post('/auth/register', (req, res) => res.status(201).json(session(auth.register(db, req.body))));
  r.get('/auth/email-taken', (req, res) => res.json({ taken: auth.emailTaken(db, req.query.email) }));
  r.get('/auth/demo-accounts', (_req, res) => res.json(auth.demoAccounts(db)));
  r.get('/auth/me', requireAuth, (req, res) => res.json(students.getById(db, req.userId)));

  // ── Subjects ────────────────────────────────────────────
  r.get('/subjects', (_req, res) => res.json(subjects.list(db)));
  r.post('/subjects', requireAuth, (req, res) => res.status(201).json(subjects.create(db, req.body)));
  r.get('/subjects/by-department/:department', (req, res) => res.json(subjects.byDepartment(db, req.params.department)));

  // ── Materials (static paths before /:id) ────────────────
  r.get('/materials', (req, res) => res.json(materials.browse(db, req.query)));
  r.get('/materials/trending', (req, res) => res.json(materials.trending(db, opt(req.query, 'days', 'limit'))));
  r.get('/materials/similar', (req, res) => res.json(materials.similar(db, req.query.title, req.query.subjectId, opt(req.query, 'threshold', 'limit'))));
  r.get('/materials/by-uploader/:id', (req, res) => res.json(materials.byUploader(db, num(req.params.id), opt(req.query, 'limit', 'excludeId'))));
  r.get('/materials/by-subject/:id', (req, res) => res.json(materials.bySubject(db, num(req.params.id), opt(req.query, 'limit', 'excludeId'))));
  r.get('/materials/recommended/:id', requireAuth, (req, res) => res.json(materials.recommended(db, self(req, req.params.id, 'recommendations'), opt(req.query, 'limit'))));
  r.get('/materials/cram-packs/:id', requireAuth, (req, res) => res.json(materials.cramPacks(db, self(req, req.params.id, 'cram packs'), opt(req.query, 'limit'))));
  r.get('/materials/:id/references', (req, res) => res.json(materials.references(db, num(req.params.id))));
  r.get('/materials/:id', optionalAuth, (req, res) =>
    res.json(materials.getById(db, num(req.params.id), { viewerId: req.query.viewer && req.userId ? req.userId : null })));
  r.post('/materials', requireAuth, (req, res) => res.status(201).json(materials.create(db, { ...req.body, uploaded_by: req.userId })));
  r.delete('/materials/:id', requireAuth, (req, res) => res.json(materials.remove(db, num(req.params.id), req.userId)));

  // ── Swap requests ───────────────────────────────────────
  r.get('/requests/incoming', requireAuth, (req, res) => res.json(requests.incoming(db, req.userId, opt(req.query, 'status'))));
  r.get('/requests/outgoing', requireAuth, (req, res) => res.json(requests.outgoing(db, req.userId, opt(req.query, 'status'))));
  r.post('/requests', requireAuth, (req, res) => res.status(201).json(requests.create(db, { ...req.body, requester_id: req.userId })));
  r.post('/requests/:id/respond', requireAuth, (req, res) =>
    res.json(requests.respond(db, num(req.params.id), req.userId, req.body.status, req.body.reason)));
  r.post('/requests/:id/complete', requireAuth, (req, res) =>
    res.json(requests.complete(db, num(req.params.id), req.userId, req.body.rating)));
  r.delete('/requests/:id', requireAuth, (req, res) => res.json(requests.withdraw(db, num(req.params.id), req.userId)));

  // ── Ratings ─────────────────────────────────────────────
  r.post('/ratings', requireAuth, (req, res) => res.status(201).json(ratings.create(db, { ...req.body, rated_by: req.userId })));
  r.get('/ratings/material/:id', (req, res) => res.json(ratings.forMaterial(db, num(req.params.id))));
  r.get('/ratings/by-student/:id', (req, res) => res.json(ratings.byStudent(db, num(req.params.id))));
  r.get('/ratings/received-by/:id', (req, res) => res.json(ratings.receivedBy(db, num(req.params.id))));

  // ── Students & leaderboards ─────────────────────────────
  r.get('/leaderboard', (req, res) => res.json(students.leaderboard(db, {
    department: req.query.department || null,
    ...(req.query.limit && { limit: num(req.query.limit, 'limit') }),
    ...(req.query.minRatings !== undefined && { minRatings: num(req.query.minRatings, 'minRatings') }),
  })));
  r.get('/leaderboard/departments', (_req, res) => res.json(students.departmentLeaderboard(db)));
  r.get('/students/:id', (req, res) => res.json(students.getById(db, num(req.params.id))));
  r.get('/students/:id/credibility', (req, res) => res.json(students.credibility(db, num(req.params.id))));
  r.get('/students/:id/stats', (req, res) => res.json(students.stats(db, num(req.params.id))));
  r.get('/students/:id/credibility-trend', (req, res) =>
    res.json(students.credibilityTrend(db, num(req.params.id), req.query.months ? num(req.query.months, 'months') : 6)));

  // ── Matches, activity, search ───────────────────────────
  r.get('/matches/mutual-swaps', requireAuth, (req, res) => res.json(matches.findMutualSwaps(db, req.userId, req.query.limit ? { limit: num(req.query.limit, 'limit') } : {})));
  r.post('/matches/propose', requireAuth, (req, res) => {
    const { other_id, give_material_id, get_material_id, message } = req.body;
    res.status(201).json(matches.propose(db, req.userId, num(other_id, 'other_id'), give_material_id, get_material_id, message ?? null));
  });
  r.get('/activity/recent', requireAuth, (req, res) => res.json(misc.recent(db, req.userId, opt(req.query, 'limit'))));
  r.get('/search', (req, res) => res.json(misc.searchAll(db, req.query.q, opt(req.query, 'limit'))));

  return r;
}
