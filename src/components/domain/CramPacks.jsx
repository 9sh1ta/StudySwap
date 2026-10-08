import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { EmptyState, Skeleton, StarRating } from '../ui';
import { materials } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { subjectClass } from '../../lib/format.js';

const SLOTS = ['Notes', 'PYQ', 'Summary'];

// Exam Mode (§7.6): one card per subject in your semester, holding the
// best-rated Notes, PYQ and Summary — the three things you actually want
// the night before.
export default function CramPacks() {
  const { user } = useAuth();
  const packs = useAsync(() => materials.cramPacks(user.student_id, { limit: 6 }), [user.student_id]);

  if (packs.loading && !packs.data) {
    return (
      <div className="cram-grid">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={210} />
        ))}
      </div>
    );
  }
  if (!packs.data?.length) {
    return <EmptyState icon={BookOpen} title="No cram packs for your semester yet" text="A pack needs rated material in your department and semester — upload or rate something and they appear." />;
  }

  return (
    <div className="cram-grid">
      {packs.data.map((pack) => (
        <article key={pack.subject.subject_id} className={`cram ${subjectClass(pack.subject.subject_id)}`}>
          <header className="cram__head">
            <h3 className="cram__subject">{pack.subject.subject_name}</h3>
            <span className="mono xsmall faint">{pack.subject.code}</span>
          </header>
          <ol className="cram__list">
            {SLOTS.map((slot, i) => {
              const m = pack.items[i];
              return (
                <li key={slot} className="cram__item">
                  <span className="eyebrow cram__slot">{slot}</span>
                  {m ? (
                    <>
                      <Link to={`/material/${m.material_id}`} className="cram__title clamp-2">
                        {m.title}
                      </Link>
                      <StarRating value={m.avg_rating ?? 0} count={m.rating_count} size={11} />
                    </>
                  ) : (
                    <span className="small faint">Nothing rated yet</span>
                  )}
                </li>
              );
            })}
          </ol>
        </article>
      ))}
    </div>
  );
}
