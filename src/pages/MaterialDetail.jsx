import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Clock, ExternalLink, FileQuestion, Send, Star } from 'lucide-react';
import { Avatar, Badge, Button, Chip, EmptyState, Skeleton, StarRating, Table, Tooltip } from '../components/ui';
import { useBreadcrumbs } from '../components/layout/Shell.jsx';
import CredibilityMark from '../components/domain/CredibilityMark.jsx';
import MaterialCard, { MaterialCardSkeleton } from '../components/domain/MaterialCard.jsx';
import MaterialPreview from '../components/domain/MaterialPreview.jsx';
import RequestSwapModal from '../components/domain/RequestSwapModal.jsx';
import RatingModal from '../components/domain/RatingModal.jsx';
import { errorToast } from '../components/domain/ErrorNote.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { materials, ratings as ratingsApi, requests } from '../api/client.js';
import { departmentName } from '../data/schema.js';
import useAsync from '../hooks/useAsync.js';
import { absoluteDate, fileSize, relativeDate, score, subjectClass } from '../lib/format.js';
import './pages.css';

export default function MaterialDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const mat = useAsync(() => materials.getById(id, { viewerId: user.student_id }), [id, user.student_id]);
  const ratingRows = useAsync(() => ratingsApi.forMaterial(id), [id]);
  const m = mat.data;
  const sameSubject = useAsync(() => materials.bySubject(m.subject_id, { excludeId: m.material_id, limit: 3 }), [m?.material_id], { enabled: !!m });
  const sameUploader = useAsync(() => materials.byUploader(m.uploaded_by, { excludeId: m.material_id, limit: 3 }), [m?.material_id], { enabled: !!m });
  const [requestOpen, setRequestOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  useBreadcrumbs([{ label: 'Browse', to: '/browse' }, ...(m ? [{ label: m.subject.subject_name, to: `/browse?subject=${m.subject_id}` }, { label: `#${m.material_id}` }] : [])]);

  if (mat.error) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={mat.error.code === 'NOT_FOUND' ? `No material with material_id ${id}` : 'Could not load this material'}
        text={mat.error.code === 'NOT_FOUND' ? 'It may have been deleted, or the link is wrong.' : mat.error.message}
        action={
          <Button as={Link} to="/browse" variant="primary">
            Back to Browse
          </Button>
        }
      />
    );
  }
  if (!m) return <DetailSkeleton />;

  const viewer = m.viewer || {};
  const req = viewer.request;
  const pending = req?.status === 'Pending';
  const accepted = req?.status === 'Accepted';
  const completed = req?.status === 'Completed';
  const blockedReason = viewer.is_uploader
    ? 'You uploaded this material — requesting your own upload is not allowed.'
    : pending
      ? `You already have a Pending request (request_id ${req.request_id}).`
      : accepted
        ? 'Your request was accepted — the file link is below.'
        : null;

  // Optimistic: show the request as Pending immediately; roll back if the insert fails.
  async function sendRequest(input) {
    const previous = m.viewer;
    mat.setData((d) => ({ ...d, viewer: { ...d.viewer, request: { request_id: '…', status: 'Pending', optimistic: true } } }));
    try {
      const created = await requests.create({ requester_id: user.student_id, ...input });
      mat.setData((d) => ({ ...d, viewer: { ...d.viewer, request: created }, request_count: (d.request_count || 0) + 1 }));
      toast({
        tone: 'ok',
        title: 'Swap request sent',
        description: `request_id ${created.request_id} · status 'Pending' · ${m.uploader.name} will be notified.`,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await requests.withdraw(created.request_id, user.student_id);
              mat.setData((d) => ({ ...d, viewer: { ...d.viewer, request: null }, request_count: Math.max(0, (d.request_count || 1) - 1) }));
              toast({ title: 'Request withdrawn', description: `Swap_Request ${created.request_id} deleted.` });
            } catch (err) {
              toast(errorToast(err));
            }
          },
        },
      });
    } catch (err) {
      mat.setData((d) => ({ ...d, viewer: previous }));
      toast(errorToast(err, 'Request not sent'));
    }
  }

  async function submitRating(values) {
    if (req && (accepted || completed)) {
      await requests.complete(req.request_id, user.student_id, values);
    } else {
      await ratingsApi.create({ material_id: m.material_id, rated_by: user.student_id, ...values });
    }
    setRateOpen(false);
    toast({ tone: 'ok', title: 'Rating saved', description: `${values.score}★ — ${m.uploader.name}'s credibility was recomputed.` });
    mat.reload({ quiet: true });
    ratingRows.reload({ quiet: true });
  }

  const dist = m.distribution || [0, 0, 0, 0, 0];
  const maxDist = Math.max(1, ...dist);

  return (
    <div className="detail">
      <div className="detail__main">
        <MaterialPreview material={m} />

        <header className={`detail__head ${subjectClass(m.subject_id)}`}>
          <div className="row gap-2">
            <Badge>{m.material_type}</Badge>
            <Chip subject={m.subject_id} code={m.subject.code}>
              {m.subject.subject_name}
            </Chip>
            {m._ui?.syllabus_year && new Date().getFullYear() - m._ui.syllabus_year >= 2 && (
              <Badge tone="warn" icon={Clock}>
                May be outdated
              </Badge>
            )}
          </div>
          <h1 className="detail__title">{m.title}</h1>
          {m._ui?.description && <p className="detail__desc">{m._ui.description}</p>}
          {m._ui?.tags?.length > 0 && (
            <ul className="tags" aria-label="Tags">
              {m._ui.tags.map((t) => (
                <li key={t} className="tag">
                  #{t}
                </li>
              ))}
            </ul>
          )}
        </header>

        <dl className="meta">
          <div>
            <dt className="eyebrow">material_id</dt>
            <dd className="mono">{m.material_id}</dd>
          </div>
          <div>
            <dt className="eyebrow">Uploaded</dt>
            <dd>
              <Tooltip content={absoluteDate(m.upload_date)}>
                <time dateTime={m.upload_date} tabIndex={0}>
                  {relativeDate(m.upload_date)}
                </time>
              </Tooltip>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Pages</dt>
            <dd className="num">{m._ui?.pageCount ?? '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">File size</dt>
            <dd className="num">{fileSize(m._ui?.fileSize)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Syllabus year</dt>
            <dd className="num">{m._ui?.syllabus_year ?? '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">Requests</dt>
            <dd className="num">{m.request_count ?? 0}</dd>
          </div>
        </dl>
      </div>

      <aside className="detail__side">
        <section className="card pad stack gap-4" aria-label="Uploader">
          <p className="eyebrow">Uploaded by</p>
          <div className="row gap-3 nowrap">
            <Avatar name={m.uploader.name} size="lg" decorative />
            <div className="stack gap-1" style={{ minWidth: 0 }}>
              <Link to={viewer.is_uploader ? '/profile' : `/student/${m.uploaded_by}`} className="detail__uploader">
                {m.uploader.name}
              </Link>
              <span className="small muted">
                {departmentName(m.uploader.department)} · Sem {m.uploader.semester}
              </span>
            </div>
          </div>
          <CredibilityMark score={m.uploader.credibility_score} count={m.uploader.rating_count} size="sm" />
          <Button as={Link} to={viewer.is_uploader ? '/profile' : `/student/${m.uploaded_by}`} variant="secondary" size="sm">
            View profile
          </Button>
        </section>

        <section className="card pad stack gap-3" aria-label="Request">
          {completed ? (
            <p className="row gap-2 small">
              <Check aria-hidden="true" className="text-ok" width={16} /> Swap completed {relativeDate(req.response_date)}.
            </p>
          ) : blockedReason ? (
            <Tooltip content={blockedReason}>
              <span tabIndex={0} className="block-wrap">
                <Button variant="primary" size="lg" icon={pending ? Clock : Send} block disabled>
                  {pending ? 'Request pending' : accepted ? 'Request accepted' : 'Request swap'}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button variant="primary" size="lg" icon={Send} block onClick={() => setRequestOpen(true)}>
              Request swap
            </Button>
          )}
          {blockedReason && !completed && <p className="xsmall faint">{blockedReason}</p>}
          {(accepted || completed) && (
            <a href={m.file_link} className="small row gap-2" onClick={(e) => e.preventDefault()} title="Placeholder link — the prototype stores no files">
              <ExternalLink aria-hidden="true" width={14} /> <span className="mono truncate">{m.file_link}</span>
            </a>
          )}
          {(accepted || (completed && !viewer.has_rated)) && (
            <Button variant="secondary" icon={Star} onClick={() => setRateOpen(true)}>
              {accepted ? 'Mark received & rate' : 'Rate this material'}
            </Button>
          )}
          {!req && !viewer.is_uploader && <p className="xsmall faint">Creates a Swap_Request row with status 'Pending'.</p>}
        </section>

        <section className="card pad stack gap-3" aria-label="Rating summary">
          <p className="eyebrow">Ratings</p>
          <div className="row gap-3">
            <span className="detail__avg num">{score(m.avg_rating)}</span>
            <div className="stack gap-1">
              <StarRating value={m.avg_rating ?? 0} showValue={false} size={14} />
              <span className="xsmall faint">
                AVG over <span className="num">{m.rating_count}</span> rating{m.rating_count === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          {m.sub_scores && (
            <Tooltip content="Completeness, legibility and accuracy are collected separately and averaged into Rating.score. Storing them as their own rows is a candidate 4NF extension for the final review.">
              <ul className="subscores" aria-label="Average sub-scores" tabIndex={0}>
                {[
                  ['Completeness', m.sub_scores.completeness],
                  ['Legibility', m.sub_scores.legibility],
                  ['Accuracy', m.sub_scores.accuracy],
                ].map(([label, value]) => (
                  <li key={label}>
                    <span className="xsmall">{label}</span>
                    <span className="subscores__track">
                      <span className="subscores__fill" style={{ width: `${(value / 5) * 100}%` }} />
                    </span>
                    <span className="num xsmall">{value.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Tooltip>
          )}
          <ul className="dist" aria-label="Score distribution">
            {dist.map((n, i) => (
              <li key={i} className="dist__row">
                <span className="num xsmall">{5 - i}★</span>
                <span className="dist__track">
                  <span className="dist__fill" style={{ width: `${(n / maxDist) * 100}%` }} />
                </span>
                <span className="num xsmall faint">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <section className="section detail__wide" aria-labelledby="ratings-h">
        <div className="section__head">
          <h2 id="ratings-h" className="section__title">
            What raters said
          </h2>
          <span className="small faint">
            <span className="mono">Rating ⋈ Student</span> on <span className="mono">rated_by</span>
          </span>
        </div>
        {ratingRows.error ? (
          <EmptyState title="Could not load ratings" text={ratingRows.error.message} action={<Button onClick={() => ratingRows.reload()}>Try again</Button>} />
        ) : (
          <Table
            rowKey="rating_id"
            loading={ratingRows.loading && !ratingRows.data}
            rows={ratingRows.data || []}
            defaultSort={{ key: 'rating_date', dir: 'desc' }}
            empty={viewer.is_uploader ? 'No ratings yet. They arrive once someone completes a swap for this material.' : 'No ratings yet — complete a swap and be the first.'}
            columns={[
              { key: 'score', header: 'Score', type: 'num', sortable: true, width: 90, render: (r) => <StarRating value={r.score} showValue={false} size={12} /> },
              { key: 'comment', header: 'Comment', render: (r) => (r.comment ? r.comment : <span className="faint">— no comment —</span>) },
              {
                key: 'rater',
                header: 'Rater',
                sortable: true,
                sortValue: (r) => r.rater?.name,
                render: (r) => <Link to={r.rated_by === user.student_id ? '/profile' : `/student/${r.rated_by}`}>{r.rater?.name}</Link>,
              },
              { key: 'rating_date', header: 'Date', type: 'num', sortable: true, render: (r) => <span title={absoluteDate(r.rating_date)}>{relativeDate(r.rating_date)}</span> },
            ]}
          />
        )}
      </section>

      <Related title={`More from ${m.subject.subject_name}`} state={sameSubject} empty="No other materials in this subject yet." />
      <Related title={`More from ${m.uploader.name}`} state={sameUploader} empty={`${m.uploader.name} has no other uploads.`} />

      <RequestSwapModal open={requestOpen} material={m} userId={user.student_id} onClose={() => setRequestOpen(false)} onSubmit={sendRequest} />
      <RatingModal
        open={rateOpen}
        material={m}
        title={accepted ? 'Mark received & rate' : 'Rate this material'}
        description={accepted ? "Sets the request's status to 'Completed' and inserts your Rating in one transaction." : 'Inserts a row into Rating.'}
        onClose={() => setRateOpen(false)}
        onSubmit={submitRating}
      />
    </div>
  );
}

function Related({ title, state, empty }) {
  return (
    <section className="section detail__wide">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
      </div>
      {state.loading && !state.data ? (
        <div className="mgrid mgrid--3">
          {[0, 1, 2].map((i) => (
            <MaterialCardSkeleton key={i} />
          ))}
        </div>
      ) : state.data?.length ? (
        <div className="mgrid mgrid--3">
          {state.data.map((x) => (
            <MaterialCard key={x.material_id} material={x} />
          ))}
        </div>
      ) : (
        <p className="small faint">{empty}</p>
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="detail" role="status">
      <span className="sr-only">Loading material</span>
      <div className="detail__main stack gap-4">
        <Skeleton height={420} />
        <Skeleton width={120} height={20} />
        <Skeleton width="80%" height={32} />
        <Skeleton text lines={3} />
      </div>
      <div className="detail__side stack gap-4">
        <Skeleton height={180} />
        <Skeleton height={80} />
        <Skeleton height={200} />
      </div>
    </div>
  );
}
