import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Avatar, Badge, StarRating, Tooltip } from '../ui';
import { TierLabel } from './CredibilityMark.jsx';
import { absoluteDate, relativeDate, subjectClass } from '../../lib/format.js';

// An index card: coloured spine keyed to the subject, outlined type badge,
// serif title, subject in mono, a rule, then uploader and rating rows.
// The whole card is clickable through the title link's stretched hit area.
export default function MaterialCard({ material: m, showUploader = true }) {
  const anon = m._ui?.anonymous;
  return (
    <article className={`mcard ${subjectClass(m.subject_id)}`}>
      <div className="mcard__top">
        <Badge>{m.material_type}</Badge>
        <span className="mono xsmall faint">#{m.material_id}</span>
      </div>
      <Tooltip content={m.title}>
        <h3 className="mcard__title clamp-2">
          <Link to={`/material/${m.material_id}`} className="mcard__link">
            {m.title}
          </Link>
        </h3>
      </Tooltip>
      <p className="mcard__subject">
        <span className="truncate">{m.subject?.subject_name}</span>
        <span className="mono">{m.subject?.code}</span>
      </p>
      <hr className="rule" />
      {showUploader && (
        <div className="mcard__row">
          {anon ? (
            <span className="small faint">Anonymous uploader</span>
          ) : (
            <>
              <Avatar name={m.uploader?.name} size="xs" decorative />
              <span className="mcard__uploader truncate">{m.uploader?.name}</span>
              <TierLabel score={m.uploader?.credibility_score} count={m.uploader?.rating_count ?? 0} withTooltip={false} />
            </>
          )}
        </div>
      )}
      <div className="mcard__row mcard__row--meta">
        <StarRating value={m.avg_rating ?? 0} count={m.rating_count} size={12} />
        <span className="grow" />
        {m.request_count > 0 && (
          <span className="mcard__req" title={`${m.request_count} swap requests`}>
            <MessageSquare aria-hidden="true" />
            <span className="num">{m.request_count}</span>
            <span className="sr-only">requests</span>
          </span>
        )}
        <time dateTime={m.upload_date} title={absoluteDate(m.upload_date)} className="xsmall faint">
          {relativeDate(m.upload_date)}
        </time>
      </div>
    </article>
  );
}

// Same footprint as MaterialCard, for loading states.
export function MaterialCardSkeleton() {
  return (
    <div className="mcard mcard--skeleton" aria-hidden="true">
      <div className="mcard__top">
        <span className="skeleton" style={{ width: 56, height: 20 }} />
        <span className="skeleton" style={{ width: 40, height: 12 }} />
      </div>
      <span className="skeleton skeleton--text" style={{ width: '92%', height: 16 }} />
      <span className="skeleton skeleton--text" style={{ width: '60%', height: 16 }} />
      <span className="skeleton" style={{ width: '50%', height: 12 }} />
      <hr className="rule" />
      <div className="mcard__row">
        <span className="skeleton skeleton--circle" style={{ width: 22, height: 22 }} />
        <span className="skeleton" style={{ width: '45%', height: 12 }} />
      </div>
      <span className="skeleton" style={{ width: '35%', height: 12 }} />
    </div>
  );
}
