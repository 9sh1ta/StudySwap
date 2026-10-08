import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Inbox, Star, TrendingUp, Upload } from 'lucide-react';
import { Button, EmptyState, Skeleton, Stat, StatRow, Tooltip } from '../components/ui';
import PageHeader from '../components/layout/PageHeader.jsx';
import CredibilityMark from '../components/domain/CredibilityMark.jsx';
import MaterialCard, { MaterialCardSkeleton } from '../components/domain/MaterialCard.jsx';
import RequestCard from '../components/domain/RequestCard.jsx';
import RejectModal from '../components/domain/RejectModal.jsx';
import { errorToast } from '../components/domain/ErrorNote.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { activity as activityApi, materials, requests, students } from '../api/client.js';
import { departmentName } from '../data/schema.js';
import useAsync from '../hooks/useAsync.js';
import { absoluteDate, firstName, greeting, relativeDate, score } from '../lib/format.js';
import './pages.css';

const ACTIVITY = {
  request: { icon: ArrowLeftRight, text: (a) => <><b>{a.actor}</b> requested <Link to={`/material/${a.material_id}`}>{a.title}</Link></> },
  response: { icon: ArrowLeftRight, text: (a) => <><b>{a.actor}</b> {a.status === 'Rejected' ? 'rejected' : 'accepted'} your request for <Link to={`/material/${a.material_id}`}>{a.title}</Link></> },
  rating: { icon: Star, text: (a) => <><b>{a.actor}</b> rated <Link to={`/material/${a.material_id}`}>{a.title}</Link> <span className="num">{a.score}★</span></> },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const id = user.student_id;
  const stats = useAsync(() => students.stats(id), [id]);
  const pending = useAsync(() => requests.incoming(id, { status: 'Pending' }), [id]);
  const recommended = useAsync(() => materials.recommended(id, { limit: 6 }), [id]);
  const trending = useAsync(() => materials.trending({ limit: 5 }), []);
  const feed = useAsync(() => activityApi.recent(id, { limit: 8 }), [id]);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  // Optimistic: drop the card now, put it back if the database refuses.
  async function respond(r, status, reason) {
    const before = pending.data;
    pending.setData((list) => list.filter((x) => x.request_id !== r.request_id));
    stats.setData((s) => s && { ...s, pending_incoming: Math.max(0, s.pending_incoming - 1) });
    setBusyId(r.request_id);
    try {
      await requests.respond(r.request_id, id, status, reason);
      toast({
        tone: status === 'Accepted' ? 'ok' : 'info',
        title: `Request ${status.toLowerCase()}`,
        description: `${r.requester.name} · request_id ${r.request_id} · status '${status}'`,
      });
      stats.reload({ quiet: true });
      feed.reload({ quiet: true });
    } catch (err) {
      pending.setData(before);
      pending.reload({ quiet: true });
      stats.reload({ quiet: true });
      toast(errorToast(err, 'Could not update the request'));
    } finally {
      setBusyId(null);
    }
  }

  const s = stats.data;
  return (
    <div>
      <PageHeader
        eyebrow={`${departmentName(user.department)} · Semester ${user.semester}`}
        title={`${greeting()}, ${firstName(user.name)}.`}
        description={
          s
            ? s.pending_incoming
              ? `${s.pending_incoming} request${s.pending_incoming === 1 ? '' : 's'} for your uploads ${s.pending_incoming === 1 ? 'is' : 'are'} waiting for a response.`
              : 'Nothing is waiting on you. Here is what is useful for your semester.'
            : ' '
        }
        aside={<CredibilityMark score={user.credibility_score} count={user.rating_count} size="lg" />}
      />

      {stats.loading && !s ? (
        <StatRow>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="stat">
              <Skeleton width={80} height={10} />
              <Skeleton width={48} height={28} />
            </div>
          ))}
        </StatRow>
      ) : (
        s && (
          <StatRow>
            <Stat label="Uploads" value={s.uploads} hint={<Link to="/profile">view all</Link>} />
            <Stat label="Swaps completed" value={s.swaps_completed} hint="as requester or uploader" />
            <Stat label="Credibility" value={score(s.credibility_score)} unit={s.credibility_score !== null ? '/ 5' : null} hint={`AVG over ${s.ratings_received} ratings`} />
            <Stat label="Pending requests" value={s.pending_incoming} hint={s.pending_outgoing ? `+${s.pending_outgoing} you sent` : 'awaiting your response'} />
          </StatRow>
        )
      )}

      <div className="dash-grid">
        <section className="section" aria-labelledby="needs-h">
          <div className="section__head">
            <h2 id="needs-h" className="section__title">
              Needs your response
            </h2>
            <Link to="/requests" className="small">
              All requests
            </Link>
          </div>
          {pending.loading && !pending.data ? (
            <div className="stack gap-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} height={150} />
              ))}
            </div>
          ) : pending.error ? (
            <EmptyState icon={Inbox} title="Could not load requests" text={pending.error.message} action={<Button onClick={() => pending.reload()}>Try again</Button>} />
          ) : pending.data.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No requests waiting on you"
              text={s?.uploads ? 'When someone asks for one of your uploads it appears here with Accept and Reject.' : 'Upload a material and requests for it will land here.'}
              action={
                !s?.uploads && (
                  <Button as={Link} to="/upload" variant="primary" icon={Upload}>
                    Upload a material
                  </Button>
                )
              }
            />
          ) : (
            <div className="stack gap-3">
              {pending.data.map((r) => (
                <RequestCard key={r.request_id} request={r} direction="incoming" busy={busyId === r.request_id} onAccept={() => respond(r, 'Accepted')} onReject={() => setRejecting(r)} />
              ))}
            </div>
          )}
        </section>

        <section className="section" aria-labelledby="activity-h">
          <div className="section__head">
            <h2 id="activity-h" className="section__title">
              Recent activity
            </h2>
          </div>
          {feed.loading && !feed.data ? (
            <Skeleton text lines={6} />
          ) : feed.data?.length ? (
            <ol className="feed">
              {feed.data.map((a) => {
                const A = ACTIVITY[a.kind];
                return (
                  <li key={`${a.kind}-${a.ref}`} className="feed__item">
                    <A.icon aria-hidden="true" />
                    <p className="feed__text">{A.text(a)}</p>
                    <Tooltip content={absoluteDate(a.at)}>
                      <time dateTime={a.at} tabIndex={0} className="xsmall faint">
                        {relativeDate(a.at)}
                      </time>
                    </Tooltip>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState title="No activity yet" text="Requests and ratings on your uploads, and replies to your requests, show up here." />
          )}
        </section>
      </div>

      <section className="section" aria-labelledby="rec-h">
        <div className="section__head">
          <div className="stack gap-1">
            <h2 id="rec-h" className="section__title">
              Recommended for {user.department} · Semester {user.semester}
            </h2>
            <p className="small faint">
              Matched on your department and semester through <span className="mono">JOIN Subject</span>, excluding your own uploads.
            </p>
          </div>
          <Link to="/browse?sort=rating" className="small">
            Browse all
          </Link>
        </div>
        {recommended.loading && !recommended.data ? (
          <div className="mgrid mgrid--3">
            {[0, 1, 2].map((i) => (
              <MaterialCardSkeleton key={i} />
            ))}
          </div>
        ) : recommended.data?.length ? (
          <div className="mgrid mgrid--3">
            {recommended.data.map((m) => (
              <MaterialCard key={m.material_id} material={m} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing rated for your semester yet"
            text="Recommendations need materials with at least three ratings in your department and semester."
            action={
              <Button as={Link} to="/browse" icon={ArrowRight}>
                Browse everything
              </Button>
            }
          />
        )}
      </section>

      <section className="section" aria-labelledby="trend-h">
        <div className="section__head">
          <h2 id="trend-h" className="section__title">
            Trending this week
          </h2>
          <span className="small faint">by ratings received in the last 7 days</span>
        </div>
        {trending.loading && !trending.data ? (
          <Skeleton text lines={5} />
        ) : trending.data?.length ? (
          <ol className="trend">
            {trending.data.map((m, i) => (
              <li key={m.material_id} className="trend__item">
                <span className="trend__rank num">{String(i + 1).padStart(2, '0')}</span>
                <div className="grow stack gap-1" style={{ minWidth: 0 }}>
                  <Link to={`/material/${m.material_id}`} className="trend__title">
                    {m.title}
                  </Link>
                  <span className="xsmall faint">
                    {m.subject.subject_name} · {m.material_type} · {m.uploader?.name}
                  </span>
                </div>
                <span className="trend__count">
                  <TrendingUp aria-hidden="true" />
                  <span className="num">{m.ratings_this_week}</span>
                  <span className="xsmall faint">this week</span>
                </span>
                <span className="num trend__avg">{score(m.avg_rating)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Quiet week" text="No ratings in the last seven days yet." />
        )}
      </section>

      <RejectModal
        request={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          const r = rejecting;
          setRejecting(null);
          respond(r, 'Rejected', reason);
        }}
      />
    </div>
  );
}
