import { DbError, all, getRow, one, rule, insertRow, updateRow, deleteRow, today, asArray, subjectMap, studentMap, credibilityOf, publicStudent, publicSubject, IN, J } from '../lib/core.js';
import { tx } from '../db/index.js';
import { insertRating } from './ratings.js';

function requestView(r, mats, subs, studs, creds) {
  const m = mats.get(r.material_id);
  const requester = studs.get(r.requester_id);
  const owner = m ? studs.get(m.uploaded_by) : null;
  const offerId = r._ui?.offer_material_id;
  return {
    ...r,
    material: m ? { material_id: m.material_id, title: m.title, material_type: m.material_type, subject: publicSubject(subs.get(m.subject_id)), uploaded_by: m.uploaded_by } : null,
    requester: requester ? publicStudent(requester, creds?.get(r.requester_id)) : null,
    owner: owner ? publicStudent(owner, creds?.get(owner.student_id)) : null,
    offer: offerId ? (({ material_id, title, material_type }) => ({ material_id, title, material_type }))(mats.get(offerId) || {}) : null,
  };
}
const allMaterials = (db) => new Map(all(db, 'SELECT * FROM Material').map((m) => [m.material_id, m]));
const newestFirst = (a, b) => b.request_date.localeCompare(a.request_date) || b.request_id - a.request_id;

export function incoming(db, studentId, { status = null } = {}) {
  const statuses = asArray(status);
  const ids = all(db, 'SELECT material_id FROM Material WHERE uploaded_by = ?', studentId).map((m) => m.material_id);
  let reqs = all(db, `SELECT * FROM Swap_Request WHERE material_id ${IN}`, J(ids));
  if (statuses.length) reqs = reqs.filter((r) => statuses.includes(r.status));
  const creds = credibilityOf(db, [...new Set(reqs.map((r) => r.requester_id))]);
  const mats = allMaterials(db), studs = studentMap(db), subs = subjectMap(db);
  return reqs.map((r) => requestView(r, mats, subs, studs, creds)).sort(newestFirst);
}

export function outgoing(db, studentId, { status = null } = {}) {
  const statuses = asArray(status);
  let reqs = all(db, 'SELECT * FROM Swap_Request WHERE requester_id = ?', studentId);
  if (statuses.length) reqs = reqs.filter((r) => statuses.includes(r.status));
  const mats = allMaterials(db), studs = studentMap(db), subs = subjectMap(db);
  const owners = [...new Set(reqs.map((r) => mats.get(r.material_id)?.uploaded_by).filter(Boolean))];
  const creds = credibilityOf(db, owners);
  const myRatings = new Set(all(db, 'SELECT material_id FROM Rating WHERE rated_by = ?', studentId).map((r) => r.material_id));
  return reqs.map((r) => ({ ...requestView(r, mats, subs, studs, creds), has_rated: myRatings.has(r.material_id) })).sort(newestFirst);
}

export const latestFor = (db, materialId, requesterId) =>
  one(db, 'SELECT * FROM Swap_Request WHERE material_id = ? AND requester_id = ? ORDER BY request_id DESC LIMIT 1', materialId, requesterId);

export function create(db, { requester_id, material_id, message = null, offer_material_id = null }) {
  return tx(db, () => {
    const m = getRow(db, 'Material', Number(material_id));
    if (m && m.uploaded_by === requester_id) throw rule('You cannot request your own material.', 'Swap_Request.requester_id must differ from Material.uploaded_by.');
    if (m && db.prepare("SELECT 1 FROM Swap_Request WHERE material_id = ? AND requester_id = ? AND status = 'Pending'").get(m.material_id, requester_id)) {
      throw rule('You already have a Pending request for this material.', 'Wait for the uploader to respond before requesting again.');
    }
    if (offer_material_id) {
      const o = getRow(db, 'Material', Number(offer_material_id));
      if (!o) throw new DbError('FOREIGN_KEY', 'FOREIGN KEY violation: offer references a missing Material', { detail: `material_id = ${offer_material_id} is not present in Material.` });
      if (o.uploaded_by !== requester_id) throw rule('You can only offer your own materials.');
    }
    return insertRow(db, 'Swap_Request', {
      requester_id,
      material_id: material_id === '' || material_id == null ? null : Number(material_id),
      status: 'Pending',
      message,
      response_date: null,
      _ui: { offer_material_id: offer_material_id ? Number(offer_material_id) : null, reject_reason: null, linked_request_id: null },
    });
  });
}

function loadRequest(db, requestId) {
  const r = getRow(db, 'Swap_Request', requestId);
  if (!r) throw new DbError('NOT_FOUND', `No Swap_Request row with request_id = ${requestId}`);
  return r;
}

// Uploader accepts or rejects a Pending request.
export function respond(db, requestId, actorId, status, reason = null) {
  return tx(db, () => {
    const r = loadRequest(db, requestId);
    const m = getRow(db, 'Material', r.material_id);
    if (m.uploaded_by !== actorId) throw rule('Only the uploader can respond to this request.');
    if (r.status !== 'Pending') throw rule(`This request is already ${r.status}.`, 'Only Pending requests can be accepted or rejected.');
    if (status !== 'Accepted' && status !== 'Rejected') return updateRow(db, 'Swap_Request', requestId, { status }); // let CHECK speak
    return updateRow(db, 'Swap_Request', requestId, {
      status, response_date: today(), _ui: { ...r._ui, reject_reason: status === 'Rejected' ? reason || null : null },
    });
  });
}

// Requester marks an Accepted request received and rates it — one transaction.
export function complete(db, requestId, actorId, rating) {
  return tx(db, () => {
    const r = loadRequest(db, requestId);
    if (r.requester_id !== actorId) throw rule('Only the requester can mark this request received.');
    if (r.status !== 'Accepted' && !(r.status === 'Completed' && rating)) throw rule(`This request is ${r.status}; only Accepted requests can be completed.`);
    if (r.status !== 'Completed') updateRow(db, 'Swap_Request', requestId, { status: 'Completed' });
    const inserted = rating ? insertRating(db, { material_id: r.material_id, rated_by: actorId, ...rating }) : null;
    return { request: getRow(db, 'Swap_Request', requestId), rating: inserted };
  });
}

// Requester withdraws a Pending request.
export function withdraw(db, requestId, actorId) {
  return tx(db, () => {
    const r = loadRequest(db, requestId);
    if (r.requester_id !== actorId) throw rule('Only the requester can withdraw this request.');
    if (r.status !== 'Pending') throw rule('Only Pending requests can be withdrawn.');
    deleteRow(db, 'Swap_Request', requestId);
    return { request_id: requestId };
  });
}
