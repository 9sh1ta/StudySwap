import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Send, Upload, Users } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, SegmentedRule, Skeleton, StarRating, Tooltip } from '../components/ui';
import PageHeader from '../components/layout/PageHeader.jsx';
import { TierLabel } from '../components/domain/CredibilityMark.jsx';
import { errorToast } from '../components/domain/ErrorNote.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { matches } from '../api/client.js';
import useAsync from '../hooks/useAsync.js';
import { score, subjectClass } from '../lib/format.js';
import './pages.css';

// A small index card for one side of a swap.
function SwapCard({ material, label }) {
  if (!material) return null;
  return (
    <article className={`swapcard ${subjectClass(material.subject_id)}`}>
      <p className="eyebrow">{label}</p>
      <div className="row between">
        <Badge>{material.material_type}</Badge>
        <span className="mono xsmall faint">#{material.material_id}</span>
      </div>
      <Link to={`/material/${material.material_id}`} className="swapcard__title clamp-2">
        {material.title}
      </Link>
      <p className="xsmall faint truncate">{material.subject?.subject_name}</p>
      <StarRating value={material.avg_rating ?? 0} count={material.rating_count} size={11} />
    </article>
  );
}

export default function SwapMatches() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  const [proposed, setProposed] = useState({});
  const data = useAsync(() => matches.findMutualSwaps(user.student_id, { limit: 8 }), [user.student_id]);

  async function propose(match) {
    const give = match.give[0];
    const get = match.get[0];
    setBusy(match.student.student_id);
    try {
      const [mine] = await matches.propose(user.student_id, match.student.student_id, give.material_id, get.material_id, `Swap? My “${give.title}” for your “${get.title}”.`);
      setProposed((p) => ({ ...p, [match.student.student_id]: mine.request_id }));
      toast({
        tone: 'ok',
        title: 'Swap proposed',
        description: `Two linked Swap_Request rows inserted — one in each direction, both 'Pending'.`,
      });
    } catch (err) {
      toast(errorToast(err, 'Could not propose the swap'));
    } finally {
      setBusy(null);
    }
  }

  const perfect = data.data?.perfect || [];
  const near = data.data?.near || [];

  return (
    <div>
      <PageHeader
        eyebrow="Swap_Request · Material · Subject"
        title="Swap matches"
        description="The schema only stores one-directional requests. Pairing them up is a query: find students who have uploaded something you need and need something you have uploaded."
      />

      {data.loading && !data.data ? (
        <div className="stack gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} height={210} />
          ))}
        </div>
      ) : data.error ? (
        <EmptyState title="Could not work out your matches" text={data.error.message} action={<Button onClick={() => data.reload()}>Try again</Button>} />
      ) : (
        <>
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Perfect swaps</h2>
              <span className="small faint">both sides have something the other needs</span>
            </div>

            {perfect.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No two-way match yet"
                text="A perfect swap needs material going both ways. Upload something for your semester and the matches appear as other students need it."
                action={
                  <Button as={Link} to="/upload" variant="primary" icon={Upload}>
                    Upload a material
                  </Button>
                }
              />
            ) : (
              <div className="stack gap-4">
                {perfect.map((m) => {
                  const done = proposed[m.student.student_id];
                  return (
                    <article key={m.student.student_id} className="match">
                      <header className="match__head">
                        <div className="row gap-3 nowrap">
                          <Avatar name={m.student.name} decorative />
                          <div className="stack gap-1">
                            <div className="row gap-2">
                              <Link to={`/student/${m.student.student_id}`} className="match__name">
                                {m.student.name}
                              </Link>
                              <TierLabel score={m.student.credibility_score} count={m.student.rating_count} />
                            </div>
                            <span className="xsmall faint">
                              {m.student.department} · Sem {m.student.semester} · credibility <span className="num">{score(m.student.credibility_score)}</span>
                            </span>
                          </div>
                        </div>
                        <Tooltip content="Match strength weighs how much each side has for the other, the ratings on those materials, and their credibility.">
                          <div className="match__strength" tabIndex={0}>
                            <span className="eyebrow">Match</span>
                            <span className="num match__pct">{Math.round(m.strength * 100)}%</span>
                            <SegmentedRule segments={5} filled={Math.round(m.strength * 5)} ariaLabel={`Match strength ${Math.round(m.strength * 100)} percent`} />
                          </div>
                        </Tooltip>
                      </header>

                      <div className="match__swap">
                        <SwapCard material={m.give[0]} label="You give" />
                        <div className="match__glyph" aria-hidden="true">
                          <ArrowLeftRight />
                        </div>
                        <SwapCard material={m.get[0]} label="You get" />
                      </div>

                      <footer className="match__foot">
                        <p className="xsmall faint">
                          {m.give.length > 1 || m.get.length > 1
                            ? `They also have ${m.get.length - 1 > 0 ? `${m.get.length - 1} more you need` : 'nothing else you need'}${m.give.length - 1 > 0 ? `, and ${m.give.length - 1} of yours fit their semester` : ''}.`
                            : 'One match each way.'}
                        </p>
                        {done ? (
                          <span className="row gap-2 small">
                            <Badge status="Pending" /> Proposed · <Link to="/requests?tab=outgoing">see your requests</Link>
                          </span>
                        ) : (
                          <Button variant="primary" icon={Send} loading={busy === m.student.student_id} onClick={() => propose(m)}>
                            Propose swap
                          </Button>
                        )}
                      </footer>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {near.length > 0 && (
            <section className="section">
              <div className="section__head">
                <h2 className="section__title">One-sided matches</h2>
                <span className="small faint">they have what you need — you have nothing they need yet</span>
              </div>
              <div className="near-grid">
                {near.map((m) => (
                  <article key={m.student.student_id} className="near">
                    <div className="row gap-3 nowrap">
                      <Avatar name={m.student.name} size="sm" decorative />
                      <div className="stack gap-1" style={{ minWidth: 0 }}>
                        <Link to={`/student/${m.student.student_id}`} className="match__name">
                          {m.student.name}
                        </Link>
                        <TierLabel score={m.student.credibility_score} count={m.student.rating_count} />
                      </div>
                    </div>
                    <SwapCard material={m.get[0]} label="They have" />
                    <p className="xsmall faint">Upload something from their semester and this becomes a two-way swap.</p>
                    <Button as={Link} to={`/student/${m.student.student_id}`} variant="secondary" size="sm">
                      See their uploads
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
