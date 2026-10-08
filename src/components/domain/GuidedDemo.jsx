import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Play, RotateCcw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '../ui';
import { useAuth } from '../../context/AuthContext.jsx';
import { db, materials, requests, students } from '../../api/client.js';

// The three-minute path, driven by the app itself: browse → filter (watch
// the index engage) → open → request → switch account → accept → mark
// received & rate → credibility recomputes.
//
// Each step narrates, highlights an element, and performs its own database
// work, so a nervous presentation cannot mistype anything.
// The demo picks an uploader whose average will visibly move when one more
// rating lands: a heavy contributor with 200 ratings would not budge.
async function pickUploader() {
  const board = await students.leaderboard({ limit: 50 });
  const candidates = board.filter((s) => s.student_id !== 101 && s.upload_count > 0);
  return candidates.find((s) => s.rating_count >= 5 && s.rating_count <= 12) || candidates.find((s) => s.rating_count <= 30) || candidates[0];
}

export default function GuidedDemo({ open, onClose }) {
  const navigate = useNavigate();
  const { user, loginAs } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rect, setRect] = useState(null);
  const [notes, setNotes] = useState({});
  const startUser = useRef(null);
  const ctx = useRef({}); // material, request, credibility before/after

  const STEPS = [
    {
      title: 'Every screen is a query',
      body: 'This walks the full swap: find a material, request it, switch to the uploader to accept, then receive and rate it — and watch a credibility score recompute at the end.',
      target: null,
      go: async () => {
        startUser.current = user.student_id;
        if (user.student_id !== 101) await loginAs(101);
        navigate('/browse');
      },
    },
    {
      title: 'Filter, and the index engages',
      body: 'Database Systems + Notes. The Query Inspector at the bottom shows the same statement run both ways: an index scan reading a few dozen rows, and a sequential scan reading the whole table.',
      target: '.qi__bar',
      go: async () => {
        navigate('/browse?subject=3&type=Notes');
      },
    },
    {
      title: 'Open something worth swapping for',
      body: `Uploaded by ${ctx.current.uploader?.name || 'another student'}. Their credibility is the average of every rating on everything they have uploaded — computed on read, never stored.`,
      target: '.detail__side',
      go: async () => {
        const uploader = await pickUploader();
        ctx.current.uploader = uploader;
        const mine = await requests.outgoing(101);
        const theirs = await materials.byUploader(uploader.student_id);
        const taken = new Set(mine.map((r) => r.material_id));
        const pick = theirs.find((m) => !taken.has(m.material_id)) || theirs[0];
        ctx.current.material = pick;
        ctx.current.before = await students.credibility(uploader.student_id);
        setNotes((n) => ({ ...n, uploader: `${uploader.name} · ${uploader.credibility_score} over ${uploader.rating_count} ratings` }));
        navigate(`/material/${pick.material_id}`);
      },
    },
    {
      title: 'Request the swap',
      body: 'One INSERT into Swap_Request with status Pending. The uploader decides what happens next.',
      target: '.detail__side',
      go: async () => {
        const created = await requests.create({
          requester_id: 101,
          material_id: ctx.current.material.material_id,
          message: 'Requesting this for the mid-sem — happy to swap my normalization notes.',
        });
        ctx.current.request = created;
        setNotes((n) => ({ ...n, request: `request_id ${created.request_id} · status 'Pending'` }));
        navigate(`/material/${ctx.current.material.material_id}`);
      },
    },
    {
      title: 'Switch to the other student',
      body: `Now sign in as ${ctx.current.uploader?.name || 'the uploader'}. The request is waiting in their Incoming tab — the same row, read from the other side of the foreign key.`,
      target: '.req-list',
      go: async () => {
        await loginAs(ctx.current.uploader.student_id);
        navigate('/requests');
      },
    },
    {
      title: 'Accept it',
      body: "An UPDATE: status becomes 'Accepted' and response_date is set. Only Pending requests can be accepted — the data layer refuses anything else.",
      target: '.req-list',
      go: async () => {
        await requests.respond(ctx.current.request.request_id, ctx.current.uploader.student_id, 'Accepted');
        setNotes((n) => ({ ...n, accepted: `request_id ${ctx.current.request.request_id} · status 'Accepted'` }));
        navigate('/requests');
      },
    },
    {
      title: 'Back to the requester, and rate it',
      body: 'Completeness, legibility and accuracy are averaged into the single Rating.score column. The status change and the rating go in as one transaction — if the rating were invalid, neither would happen.',
      target: '.req-list',
      go: async () => {
        await loginAs(101);
        await requests.complete(ctx.current.request.request_id, 101, { completeness: 5, legibility: 4, accuracy: 5, comment: 'Exactly what I needed before the mid-sem.' });
        ctx.current.after = await students.credibility(ctx.current.uploader.student_id);
        setNotes((n) => ({
          ...n,
          rated: `ROUND(AVG(5, 4, 5)) = 5 → Rating.score = 5`,
          credibility: `${ctx.current.before.credibility_score} over ${ctx.current.before.rating_count} ratings → ${ctx.current.after.credibility_score} over ${ctx.current.after.rating_count}`,
        }));
        navigate(`/student/${ctx.current.uploader.student_id}`);
      },
    },
    {
      title: 'The score moved on its own',
      body: 'Nothing wrote a credibility value. The view re-read every rating on their uploads and averaged them again — one more rating, one new average.',
      target: '.profile-head__cred',
      go: async () => {},
    },
  ];

  const current = STEPS[step];

  // Follow the highlighted element as the page settles.
  useEffect(() => {
    if (!open) return undefined;
    let raf = 0;
    const track = () => {
      const el = current?.target ? document.querySelector(current.target) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [open, step, current?.target]);

  const runStep = useCallback(
    async (index) => {
      setBusy(true);
      try {
        await STEPS[index].go?.();
        setStep(index);
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.student_id]
  );

  useEffect(() => {
    if (open) {
      setStep(0);
      setNotes({});
      ctx.current = {};
      runStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function finish() {
    if (startUser.current && startUser.current !== 101) await loginAs(startUser.current);
    onClose();
  }

  if (!open) return null;

  const last = step === STEPS.length - 1;
  const pad = 6;

  return createPortal(
    <div className="demo" role="dialog" aria-modal="false" aria-label="Guided demo">
      {/* Four panels around the highlight — a spotlight without a shadow. */}
      {rect ? (
        <>
          <div className="demo__mask" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - pad) }} />
          <div className="demo__mask" style={{ top: rect.top + rect.height + pad, left: 0, right: 0, bottom: 0 }} />
          <div className="demo__mask" style={{ top: Math.max(0, rect.top - pad), left: 0, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2 }} />
          <div className="demo__mask" style={{ top: Math.max(0, rect.top - pad), left: rect.left + rect.width + pad, right: 0, height: rect.height + pad * 2 }} />
          <div className="demo__ring" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        </>
      ) : (
        <div className="demo__mask" style={{ inset: 0 }} />
      )}

      <aside className="demo__card">
        <header className="row between">
          <p className="eyebrow">
            Guided demo · step <span className="num">{step + 1}</span> of <span className="num">{STEPS.length}</span>
          </p>
          <Button variant="ghost" size="sm" icon={X} aria-label="End the demo" onClick={finish} />
        </header>
        <h2 className="demo__title">{current.title}</h2>
        <p className="muted small">{current.body}</p>

        {Object.keys(notes).length > 0 && (
          <dl className="demo__notes">
            {notes.uploader && (
              <div>
                <dt>Uploader</dt>
                <dd className="mono">{notes.uploader}</dd>
              </div>
            )}
            {notes.request && (
              <div>
                <dt>Inserted</dt>
                <dd className="mono">{notes.request}</dd>
              </div>
            )}
            {notes.accepted && (
              <div>
                <dt>Updated</dt>
                <dd className="mono">{notes.accepted}</dd>
              </div>
            )}
            {notes.rated && (
              <div>
                <dt>Rated</dt>
                <dd className="mono">{notes.rated}</dd>
              </div>
            )}
            {notes.credibility && (
              <div>
                <dt>Credibility</dt>
                <dd className="mono">{notes.credibility}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="demo__steps" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={`demo__pip${i <= step ? ' demo__pip--done' : ''}`} />
          ))}
        </div>

        <footer className="row between">
          <Button variant="ghost" size="sm" onClick={finish}>
            {last ? 'Close' : 'End demo'}
          </Button>
          <div className="row gap-2">
            {last ? (
              <Button
                variant="secondary"
                size="sm"
                icon={RotateCcw}
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  await db.reset();
                  window.location.assign('/dashboard');
                }}
              >
                Reset demo data
              </Button>
            ) : null}
            <Button variant="primary" size="sm" iconRight={last ? Check : ArrowRight} loading={busy} onClick={() => (last ? finish() : runStep(step + 1))}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
}

// The button that starts it, for the topbar.
export function GuidedDemoButton({ onStart }) {
  return (
    <Button variant="secondary" size="sm" icon={Play} onClick={onStart}>
      Guided demo
    </Button>
  );
}
