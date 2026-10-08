import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seedDb.js';
import { createApp } from '../src/app.js';
import { DEMO_PASSWORD } from '../src/shared/seed.js';

process.env.NODE_ENV = 'test';
let server, base;
before(() => {
  const db = openDb(':memory:');
  seedDatabase(db);
  server = createApp(db).listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const login = async (id) => (await call('POST', '/auth/login-as', { student_id: id })).body;

test('seed loaded and demo accounts work', async () => {
  const demo = (await call('GET', '/auth/demo-accounts')).body;
  assert.equal(demo.length, 3);
  const a = await login(101);
  assert.equal(a.student.credibility_score, 4.25);
  assert.equal(a.student.rating_count, 12);
  const pw = await call('POST', '/auth/login', { email: a.student.email, password: DEMO_PASSWORD });
  assert.equal(pw.status, 200);
  const bad = await call('POST', '/auth/login', { email: a.student.email, password: 'wrongpass1' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'AUTH');
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/auth/me', null, a.token)).body.student_id, 101);
});

test('registration enforces the schema constraints with DbError codes', async () => {
  const reg = (o) => call('POST', '/auth/register', { name: 'Test User', email: 'test.user25@vitstudent.ac.in', department: 'CSE', semester: 3, password: 'password123', ...o });
  assert.equal((await reg({ email: 'x@gmail.com' })).body.error.code, 'CHECK');
  assert.equal((await reg({ semester: 9 })).body.error.code, 'CHECK');
  assert.equal((await reg({ name: '' })).body.error.code, 'NOT_NULL');
  assert.equal((await reg({ name: 'x'.repeat(101) })).body.error.code, 'LENGTH');
  assert.equal((await reg({ password: 'short' })).body.error.code, 'RULE');
  const ok = await reg({});
  assert.equal(ok.status, 201);
  assert.equal(ok.body.student.credibility_score, null);
  const dup = await reg({ email: 'TEST.USER25@vitstudent.ac.in' });
  assert.equal(dup.body.error.code, 'UNIQUE');
  assert.equal((await call('GET', '/auth/email-taken?email=test.user25@vitstudent.ac.in')).body.taken, true);
});

test('browse: filters, sort, pagination and view shape', async () => {
  const r = (await call('GET', '/materials?pageSize=5&sort=rating')).body;
  assert.equal(r.rows.length, 5);
  assert.ok(r.total > 100);
  const m = r.rows[0];
  for (const k of ['material_id', 'title', 'subject', 'uploader', 'avg_rating', 'rating_count', 'file_link', '_ui']) assert.ok(k in m, k);
  assert.ok('credibility_score' in m.uploader && 'subject_name' in m.subject);
  assert.ok(r.rows[0].avg_rating >= r.rows[4].avg_rating);

  const two = (await call('GET', '/materials?type=Notes&type=PYQ&pageSize=50')).body;
  assert.ok(two.rows.every((x) => ['Notes', 'PYQ'].includes(x.material_type)));
  const q = (await call('GET', '/materials?q=normalization')).body;
  assert.ok(q.total >= 1 && q.rows.every((x) => x.title.toLowerCase().includes('normalization')));
  const p2 = (await call('GET', '/materials?pageSize=5&page=2')).body;
  assert.equal(p2.page, 2);
  const cred = (await call('GET', '/materials?sort=credibility&minCredibility=4&pageSize=20')).body;
  assert.ok(cred.rows.every((x) => x.uploader.credibility_score >= 4));
  const req = (await call('GET', '/materials?sort=requested&pageSize=3')).body;
  assert.ok(req.rows[0].request_count >= req.rows[2].request_count);
});

test('material detail: distribution, sub-scores, viewer block', async () => {
  const a = await login(101);
  const anon = (await call('GET', '/materials/1001')).body;
  assert.equal(anon.distribution.length, 5);
  assert.ok(anon.sub_scores);
  assert.equal(anon.viewer, undefined);
  const mine = (await call('GET', '/materials/1001?viewer=1', null, a.token)).body;
  assert.equal(mine.viewer.is_uploader, true);
  assert.equal((await call('GET', '/materials/999999')).body.error.code, 'NOT_FOUND');
});

test('request → accept → complete+rate changes credibility; rules enforced', async () => {
  const uploader = await login(101); // owns 1001
  const student = (await call('POST', '/auth/register', { name: 'Rita Rao', email: 'rita.rao26@vitstudent.ac.in', department: 'CSE', semester: 5, password: 'password123' })).body;
  const before = (await call('GET', '/students/101')).body;

  assert.equal((await call('POST', '/requests', { material_id: 1001 }, uploader.token)).body.error.code, 'RULE'); // own material
  const created = await call('POST', '/requests', { material_id: 1001, message: 'please' }, student.token);
  assert.equal(created.status, 201);
  const rid = created.body.request_id;
  assert.equal((await call('POST', '/requests', { material_id: 1001 }, student.token)).body.error.code, 'RULE'); // duplicate pending

  const inc = (await call('GET', '/requests/incoming?status=Pending', null, uploader.token)).body;
  const mineReq = inc.find((r) => r.request_id === rid);
  assert.ok(mineReq && mineReq.requester.name === 'Rita Rao' && mineReq.material.subject);

  assert.equal((await call('POST', `/requests/${rid}/respond`, { status: 'Accepted' }, student.token)).body.error.code, 'RULE'); // not uploader
  const acc = await call('POST', `/requests/${rid}/respond`, { status: 'Accepted' }, uploader.token);
  assert.equal(acc.body.status, 'Accepted');
  assert.ok(acc.body.response_date);
  assert.equal((await call('POST', `/requests/${rid}/respond`, { status: 'Rejected' }, uploader.token)).body.error.code, 'RULE'); // already accepted

  assert.equal((await call('POST', `/requests/${rid}/complete`, { rating: { score: 1 } }, uploader.token)).body.error.code, 'RULE'); // not requester
  const done = await call('POST', `/requests/${rid}/complete`, { rating: { completeness: 1, legibility: 1, accuracy: 2, comment: 'meh' } }, student.token);
  assert.equal(done.status, 200);
  assert.equal(done.body.request.status, 'Completed');
  assert.equal(done.body.rating.score, 1);

  const after = (await call('GET', '/students/101')).body;
  assert.equal(after.rating_count, before.rating_count + 1);
  assert.ok(after.credibility_score < before.credibility_score);

  const out = (await call('GET', '/requests/outgoing', null, student.token)).body;
  assert.equal(out[0].has_rated, true);
  const dup = await call('POST', '/ratings', { material_id: 1001, score: 5 }, student.token);
  assert.equal(dup.body.error.code, 'UNIQUE');
  assert.equal((await call('POST', '/ratings', { material_id: 1001, score: 5 }, uploader.token)).body.error.code, 'RULE'); // own material
  assert.equal((await call('POST', '/ratings', { material_id: 1002, score: 9 }, student.token)).body.error.code, 'CHECK');
});

test('withdraw and reject', async () => {
  const u = await login(102);
  const s = await login(107);
  const r1 = (await call('POST', '/requests', { material_id: 1002 }, s.token)).body.request_id; // 1002 is 101's
  assert.equal((await call('DELETE', `/requests/${r1}`, null, u.token)).body.error.code, 'RULE');
  assert.equal((await call('DELETE', `/requests/${r1}`, null, s.token)).body.request_id, r1);
  const r2 = (await call('POST', '/requests', { material_id: 1002 }, s.token)).body.request_id;
  const owner = await login(101);
  const rej = await call('POST', `/requests/${r2}/respond`, { status: 'Rejected', reason: 'not available' }, owner.token);
  assert.equal(rej.body.status, 'Rejected');
  assert.equal(rej.body._ui.reject_reason, 'not available');
});

test('delete is RESTRICTed while rows reference the material', async () => {
  const a = await login(101);
  const refs = (await call('GET', '/materials/1001/references')).body;
  assert.ok(refs.Rating > 0);
  const del = await call('DELETE', '/materials/1001', null, a.token);
  assert.equal(del.body.error.code, 'FOREIGN_KEY');
  assert.ok(del.body.error.refs.length >= 1);

  // a brand-new material has no references and can be deleted
  const m = await call('POST', '/materials', { title: 'Fresh upload', subject_id: 3, material_type: 'Notes', _ui: { tags: ['x'] } }, a.token);
  assert.equal(m.status, 201);
  assert.equal(m.body.uploaded_by, 101);
  assert.match(m.body.file_link, new RegExp(`/${m.body.material_id}\\.pdf$`));
  assert.equal((await call('POST', '/materials', { title: 'Bad', subject_id: 3, material_type: 'Video' }, a.token)).body.error.code, 'CHECK');
  assert.equal((await call('POST', '/materials', { title: 'Bad', subject_id: 9999, material_type: 'Notes' }, a.token)).body.error.code, 'FOREIGN_KEY');
  assert.equal((await call('DELETE', `/materials/${m.body.material_id}`, null, (await login(102)).token)).body.error.code, 'RULE');
  assert.equal((await call('DELETE', `/materials/${m.body.material_id}`, null, a.token)).status, 200);
});

test('students, leaderboard, trend, stats, ratings lists', async () => {
  const lb = (await call('GET', '/leaderboard?limit=5')).body;
  assert.equal(lb.length, 5);
  assert.equal(lb[0].rank, 1);
  assert.ok(lb[0].credibility_score >= lb[4].credibility_score);
  assert.ok((await call('GET', '/leaderboard/departments')).body.length >= 3);
  const st = (await call('GET', '/students/102/stats')).body;
  for (const k of ['uploads', 'ratings_received', 'pending_incoming', 'swaps_completed', 'acceptance_rate']) assert.ok(k in st, k);
  const trend = (await call('GET', '/students/102/credibility-trend?months=6')).body;
  assert.equal(trend.length, 6);
  assert.ok((await call('GET', '/ratings/material/1001')).body[0].rater.name);
  assert.ok((await call('GET', '/ratings/received-by/101')).body.length >= 12);
  assert.ok((await call('GET', '/ratings/by-student/102')).body.length > 0);
});

test('recommended, cram packs, trending, similar, by-subject, by-uploader', async () => {
  const a = await login(101);
  const other = await login(102);
  assert.equal((await call('GET', '/materials/recommended/101', null, other.token)).status, 403);
  const rec = (await call('GET', '/materials/recommended/101?limit=4', null, a.token)).body;
  assert.ok(rec.length <= 4 && rec.every((m) => m.rating_count >= 3 && m.uploaded_by !== 101));
  const cram = (await call('GET', '/materials/cram-packs/101', null, a.token)).body;
  assert.ok(cram.length > 0 && cram[0].items.length === 3 && cram[0].subject.subject_name);
  assert.ok(Array.isArray((await call('GET', '/materials/trending?days=30&limit=3')).body));
  const sim = (await call('GET', `/materials/similar?title=${encodeURIComponent('DBMS Unit 3 Normalization Handwritten')}&subjectId=3`)).body;
  assert.ok(sim.length >= 1 && sim[0].score > 0.7);
  const bs = (await call('GET', '/materials/by-subject/3?limit=2&excludeId=1001')).body;
  assert.ok(bs.length <= 2 && bs.every((m) => m.material_id !== 1001));
  const bu = (await call('GET', '/materials/by-uploader/101')).body;
  assert.equal(bu.length, 5);
  assert.ok('request_count' in bu[0]);
});

test('mutual swaps, propose, activity, search, subjects', async () => {
  const a = await login(101);
  const m = (await call('GET', '/matches/mutual-swaps', null, a.token)).body;
  assert.ok('perfect' in m && 'near' in m);
  if (m.perfect.length) {
    const p = m.perfect[0];
    assert.ok(p.strength > 0 && p.give.length && p.get.length);
    const res = await call('POST', '/matches/propose', { other_id: p.student.student_id, give_material_id: p.give[0].material_id, get_material_id: p.get[0].material_id, message: 'swap?' }, a.token);
    assert.equal(res.status, 201);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0]._ui.linked_request_id, res.body[1].request_id);
    assert.equal(res.body[1]._ui.linked_request_id, res.body[0].request_id);
  }
  const act = (await call('GET', '/activity/recent?limit=5', null, a.token)).body;
  assert.ok(act.length > 0 && act[0].kind && act[0].at);
  const s = (await call('GET', '/search?q=normal&limit=3')).body;
  assert.ok(s.materials.length > 0 && Array.isArray(s.subjects) && Array.isArray(s.students));
  assert.deepEqual((await call('GET', '/search?q=')).body, { materials: [], subjects: [], students: [] });
  const subs = (await call('GET', '/subjects')).body;
  assert.equal(subs.length, 30);
  assert.ok('material_count' in subs[0] && 'code' in subs[0]);
  const add = await call('POST', '/subjects', { subject_name: 'Quantum Computing', department: 'CSE', semester: 7 }, a.token);
  assert.equal(add.status, 201);
  assert.equal((await call('POST', '/subjects', { subject_name: 'Quantum Computing', department: 'CSE', semester: 7 }, a.token)).body.error.code, 'UNIQUE');
  assert.ok((await call('GET', '/subjects/by-department/CSE')).body.length > 0);
});
