import { Link } from 'react-router-dom';
import { ArrowLeftRight, Check, Star, Undo2, X } from 'lucide-react';
import { Avatar, Badge, Button, Tooltip } from '../ui';
import { TierLabel } from './CredibilityMark.jsx';
import StatusStepper from './StatusStepper.jsx';
import { absoluteDate, relativeDate, subjectClass } from '../../lib/format.js';

// One Swap_Request row, joined to its material and the other student.
//   direction="incoming": the uploader's view — Accept / Reject while Pending.
//   direction="outgoing": the requester's view — stepper, then Mark received & rate.
export default function RequestCard({ request: r, direction, busy, onAccept, onReject, onComplete, onWithdraw, compact = false }) {
  const other = direction === 'incoming' ? r.requester : r.owner;
  const m = r.material;
  return (
    <article className={`rcard ${subjectClass(m?.subject?.subject_id)}${compact ? ' rcard--compact' : ''}`} aria-busy={busy || undefined}>
      <header className="rcard__head">
        <Avatar name={other?.name} size="sm" decorative />
        <div className="rcard__who">
          <div className="row gap-2">
            <Link to={`/student/${other?.student_id}`} className="rcard__name">
              {other?.name}
            </Link>
            <TierLabel score={other?.credibility_score} count={other?.rating_count ?? 0} />
          </div>
          <p className="xsmall faint">
            {direction === 'incoming' ? 'requested' : 'you requested from them'}{' '}
            <Tooltip content={absoluteDate(r.request_date)}>
              <time dateTime={r.request_date} tabIndex={0}>
                {relativeDate(r.request_date)}
              </time>
            </Tooltip>
            {' · '}
            <span className="mono">request_id {r.request_id}</span>
          </p>
        </div>
        <Badge status={r.status} />
      </header>

      <Link to={`/material/${m?.material_id}`} className="rcard__material">
        <span className="rcard__spine" aria-hidden="true" />
        <span className="stack gap-1" style={{ minWidth: 0 }}>
          <span className="rcard__title clamp-2">{m?.title}</span>
          <span className="xsmall faint">
            {m?.material_type} · {m?.subject?.subject_name} · <span className="mono">#{m?.material_id}</span>
          </span>
        </span>
      </Link>

      {r.message && !compact && <blockquote className="rcard__msg">{r.message}</blockquote>}
      {r.offer?.material_id && (
        <p className="rcard__offer small">
          <ArrowLeftRight aria-hidden="true" />
          <span>
            Offers in return:{' '}
            <Link to={`/material/${r.offer.material_id}`}>{r.offer.title}</Link>
          </span>
        </p>
      )}
      {r.status === 'Rejected' && r._ui?.reject_reason && (
        <p className="small muted">
          <span className="eyebrow">Reason</span> {r._ui.reject_reason}
        </p>
      )}

      {direction === 'outgoing' && !compact && <StatusStepper status={r.status} />}

      <footer className="rcard__actions">
        {direction === 'incoming' && r.status === 'Pending' && (
          <>
            <Button variant="primary" size="sm" icon={Check} onClick={() => onAccept?.(r)} disabled={busy}>
              Accept
            </Button>
            <Button variant="danger" size="sm" icon={X} onClick={() => onReject?.(r)} disabled={busy}>
              Reject
            </Button>
          </>
        )}
        {direction === 'incoming' && r.status === 'Accepted' && <p className="xsmall faint">Accepted — waiting for {r.requester?.name.split(' ')[0]} to mark it received.</p>}
        {direction === 'outgoing' && r.status === 'Pending' && (
          <Button variant="ghost" size="sm" icon={Undo2} onClick={() => onWithdraw?.(r)} disabled={busy}>
            Withdraw request
          </Button>
        )}
        {direction === 'outgoing' && r.status === 'Accepted' && (
          <Button variant="primary" size="sm" icon={Check} onClick={() => onComplete?.(r)} disabled={busy}>
            Mark received &amp; rate
          </Button>
        )}
        {direction === 'outgoing' && r.status === 'Completed' && !r.has_rated && (
          <Button variant="secondary" size="sm" icon={Star} onClick={() => onComplete?.(r)} disabled={busy}>
            Rate this material
          </Button>
        )}
        {r.response_date && (
          <span className="xsmall faint rcard__responded">
            responded <time dateTime={r.response_date}>{relativeDate(r.response_date)}</time>
          </span>
        )}
      </footer>
    </article>
  );
}
