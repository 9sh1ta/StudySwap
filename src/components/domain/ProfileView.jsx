import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Trash2, Upload } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, Skeleton, Stat, StatRow, StarRating, Table, Tabs, Tooltip } from '../ui';
import CredibilityMark from './CredibilityMark.jsx';
import MaterialCard from './MaterialCard.jsx';
import { CredibilityTrendChart, ScoreDistributionChart } from './ProfileCharts.jsx';
import DeleteMaterialModal from './DeleteMaterialModal.jsx';
import RequestSwapModal from './RequestSwapModal.jsx';
import { errorToast } from './ErrorNote.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { materials, ratings, requests, students } from '../../api/client.js';
import { departmentName } from '../../data/schema.js';
import useAsync from '../../hooks/useAsync.js';
import { absoluteDate, relativeDate, score } from '../../lib/format.js';

const dateCol = (key, header) => ({
  key,
  header,
  type: 'num',
  sortable: true,
  render: (r) => (r[key] ? <span title={absoluteDate(r[key])}>{relativeDate(r[key])}</span> : <span className="faint">—</span>),
});

// Shared by /profile (self = true: delete, ratings given, swap history)
// and /student/:id (read-only, plus "Request a swap with this student").
export default function ProfileView({ studentId, self = false, viewerId }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const student = useAsync(() => students.getById(studentId), [studentId]);
  const stats = useAsync(() => students.stats(studentId), [studentId]);
  const trend = useAsync(() => students.credibilityTrend(studentId, 6), [studentId]);
  const uploads = useAsync(() => materials.byUploader(studentId), [studentId]);
  const received = useAsync(() => ratings.receivedBy(studentId), [studentId]);
  const given = useAsync(() => ratings.byStudent(studentId), [studentId], { enabled: self });
  const history = useAsync(
    async () => {
      const [inc, out] = await Promise.all([requests.incoming(studentId), requests.outgoing(studentId)]);
      return [...inc.map((r) => ({ ...r, direction: 'incoming' })), ...out.map((r) => ({ ...r, direction: 'outgoing' }))];
    },
    [studentId],
    { enabled: self }
  );
  const [tab, setTab] = useState('uploads');
  const [deleting, setDeleting] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const s = student.data;
  const st = stats.data;

  if (student.error) {
    return <EmptyState title={`No student with student_id ${studentId}`} text="The link may be wrong, or the account was removed when the demo data was reset." action={<Button as={Link} to="/browse" variant="primary">Back to Browse</Button>} />;
  }

  async function sendRequest(input) {
    try {
      const r = await requests.create({ requester_id: viewerId, ...input });
      toast({ tone: 'ok', title: 'Swap request sent', description: `request_id ${r.request_id} · status 'Pending'` });
    } catch (err) {
      toast(errorToast(err, 'Request not sent'));
    }
  }

  const tabs = [
    { id: 'uploads', label: self ? 'My uploads' : 'Uploads', count: uploads.data?.length },
    { id: 'received', label: 'Ratings received', count: received.data?.length },
    ...(self
      ? [
          { id: 'given', label: 'Ratings given', count: given.data?.length },
          { id: 'history', label: 'Swap history', count: history.data?.length },
        ]
      : []),
  ];

  // EER specialisation (Student → Contributor / Requester) derived from data.
  const role = st ? (st.uploads && (st.pending_outgoing || st.swaps_completed || st.accepted_outgoing) ? 'Contributor + Requester' : st.uploads ? 'Contributor' : 'Requester') : null;

  return (
    <div>
      <header className="profile-head">
        <div className="profile-head__id">
          {s ? <Avatar name={s.name} size="xl" decorative /> : <Skeleton circle size={72} />}
          <div className="stack gap-2" style={{ minWidth: 0 }}>
            {s ? (
              <>
                <h1 className="page-header__title">{s.name}</h1>
                <p className="muted">
                  {departmentName(s.department)} · Semester {s.semester}
                </p>
                <dl className="profile-facts">
                  <div>
                    <dt className="eyebrow">student_id</dt>
                    <dd className="mono">{s.student_id}</dd>
                  </div>
                  {s._ui?.reg_no && (
                    <div>
                      <dt className="eyebrow">Reg. no.</dt>
                      <dd className="mono">{s._ui.reg_no}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="eyebrow">Email</dt>
                    <dd className="mono small">{s.email}</dd>
                  </div>
                  {s._ui?.joined && (
                    <div>
                      <dt className="eyebrow">Joined</dt>
                      <dd title={absoluteDate(s._ui.joined)}>{relativeDate(s._ui.joined)}</dd>
                    </div>
                  )}
                  {role && (
                    <div>
                      <dt className="eyebrow">EER role</dt>
                      <dd>
                        <Tooltip content="Student specialisation from the EER model, derived from whether this student has uploads, requests, or both.">
                          <span tabIndex={0}>{role}</span>
                        </Tooltip>
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            ) : (
              <>
                <Skeleton width={240} height={32} />
                <Skeleton width={200} height={14} />
              </>
            )}
          </div>
        </div>
        <div className="profile-head__cred">
          {s && <CredibilityMark score={s.credibility_score} count={s.rating_count} size="lg" showDerivation />}
          {!self && s && (
            <Button variant="primary" icon={Send} disabled={!uploads.data?.length} onClick={() => setRequestOpen(true)}>
              Request a swap with {s.name.split(' ')[0]}
            </Button>
          )}
        </div>
      </header>

      {st ? (
        <StatRow>
          <Stat label="Uploads" value={st.uploads} />
          <Stat label="Ratings received" value={st.ratings_received} />
          <Stat label="Average" value={score(st.credibility_score)} hint="read-only · computed" />
          <Stat label="Swaps completed" value={st.swaps_completed} />
          <Stat label="Acceptance rate" value={st.acceptance_rate === null ? '—' : `${Math.round(st.acceptance_rate * 100)}%`} hint="accepted ÷ responded" />
        </StatRow>
      ) : (
        <Skeleton height={92} />
      )}

      <div className="profile-charts">
        <section className="card pad stack gap-3" aria-labelledby="trend-h">
          <div className="section__head">
            <h2 id="trend-h" className="eyebrow">
              Credibility · last 6 months
            </h2>
            <span className="xsmall faint mono">cumulative AVG(score)</span>
          </div>
          {trend.data ? <CredibilityTrendChart data={trend.data} /> : <Skeleton height={180} />}
        </section>
        <section className="card pad stack gap-3" aria-labelledby="dist-h">
          <div className="section__head">
            <h2 id="dist-h" className="eyebrow">
              Ratings received by score
            </h2>
            <span className="xsmall faint mono">GROUP BY score</span>
          </div>
          {received.data ? <ScoreDistributionChart ratings={received.data} /> : <Skeleton height={180} />}
        </section>
      </div>

      <Tabs label="Profile sections" value={tab} onChange={setTab} tabs={tabs} className="profile-tabs">
        {tab === 'uploads' &&
          (self ? (
            <Table
              rowKey="material_id"
              loading={uploads.loading && !uploads.data}
              rows={uploads.data || []}
              defaultSort={{ key: 'upload_date', dir: 'desc' }}
              onRowClick={(m) => navigate(`/material/${m.material_id}`)}
              empty={
                <span className="stack gap-3" style={{ alignItems: 'center' }}>
                  You have not uploaded anything yet.
                  <Button as={Link} to="/upload" variant="primary" icon={Upload} size="sm">
                    Upload your first material
                  </Button>
                </span>
              }
              columns={[
                { key: 'material_id', header: 'material_id', type: 'id', sortable: true, width: 104 },
                { key: 'title', header: 'Title', sortable: true, render: (m) => <span className="clamp-2">{m.title}</span> },
                { key: 'subject', header: 'Subject', sortValue: (m) => m.subject.subject_name, sortable: true, render: (m) => <span className="small">{m.subject.subject_name}</span> },
                { key: 'material_type', header: 'Type', sortable: true, render: (m) => <Badge>{m.material_type}</Badge> },
                { key: 'avg_rating', header: 'Avg', type: 'num', sortable: true, render: (m) => score(m.avg_rating) },
                { key: 'rating_count', header: 'Ratings', type: 'num', sortable: true },
                { key: 'request_count', header: 'Requests', type: 'num', sortable: true },
                dateCol('upload_date', 'Uploaded'),
                {
                  key: 'actions',
                  header: <span className="sr-only">Actions</span>,
                  align: 'right',
                  render: (m) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      aria-label={`Delete ${m.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(m);
                      }}
                    />
                  ),
                },
              ]}
            />
          ) : uploads.data?.length ? (
            <div className="mgrid">
              {uploads.data.map((m) => (
                <MaterialCard key={m.material_id} material={m} showUploader={false} />
              ))}
            </div>
          ) : uploads.loading ? (
            <Skeleton height={200} />
          ) : (
            <EmptyState title={`${s?.name.split(' ')[0] ?? 'This student'} has not uploaded anything yet`} text="Nothing to request from them for now." />
          ))}

        {tab === 'received' && (
          <Table
            rowKey="rating_id"
            loading={received.loading && !received.data}
            rows={received.data || []}
            defaultSort={{ key: 'rating_date', dir: 'desc' }}
            maxHeight={520}
            empty={self ? 'No ratings yet. They arrive when requesters complete a swap for one of your uploads.' : 'No ratings on their uploads yet.'}
            columns={[
              { key: 'score', header: 'Score', type: 'num', sortable: true, width: 90, render: (r) => <StarRating value={r.score} showValue={false} size={12} /> },
              { key: 'comment', header: 'Comment', render: (r) => r.comment || <span className="faint">—</span> },
              { key: 'material', header: 'Material', sortValue: (r) => r.material?.title, sortable: true, render: (r) => <Link to={`/material/${r.material_id}`}>{r.material?.title}</Link> },
              { key: 'rater', header: 'Rater', sortValue: (r) => r.rater?.name, sortable: true, render: (r) => r.rater?.name },
              dateCol('rating_date', 'Date'),
            ]}
          />
        )}

        {tab === 'given' && (
          <Table
            rowKey="rating_id"
            loading={given.loading && !given.data}
            rows={given.data || []}
            defaultSort={{ key: 'rating_date', dir: 'desc' }}
            maxHeight={520}
            empty="You have not rated anything yet. Complete a swap and rate what you received."
            columns={[
              { key: 'score', header: 'Score', type: 'num', sortable: true, width: 90, render: (r) => <StarRating value={r.score} showValue={false} size={12} /> },
              { key: 'material', header: 'Material', sortValue: (r) => r.material?.title, sortable: true, render: (r) => <Link to={`/material/${r.material_id}`}>{r.material?.title}</Link> },
              { key: 'comment', header: 'Comment', render: (r) => r.comment || <span className="faint">—</span> },
              dateCol('rating_date', 'Date'),
            ]}
          />
        )}

        {tab === 'history' && (
          <Table
            rowKey="request_id"
            loading={history.loading && !history.data}
            rows={history.data || []}
            defaultSort={{ key: 'request_date', dir: 'desc' }}
            maxHeight={520}
            onRowClick={(r) => navigate(`/material/${r.material_id}`)}
            empty="No swap requests in either direction yet."
            columns={[
              { key: 'request_id', header: 'request_id', type: 'id', sortable: true, width: 100 },
              { key: 'direction', header: 'Direction', sortable: true, render: (r) => (r.direction === 'incoming' ? 'For your upload' : 'You requested') },
              { key: 'title', header: 'Material', sortValue: (r) => r.material?.title, sortable: true, render: (r) => <span className="clamp-2">{r.material?.title}</span> },
              { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge status={r.status} /> },
              dateCol('request_date', 'Requested'),
              dateCol('response_date', 'Responded'),
            ]}
          />
        )}
      </Tabs>

      {self && (
        <DeleteMaterialModal
          material={deleting}
          userId={viewerId}
          onClose={() => setDeleting(null)}
          onDeleted={(m) => {
            setDeleting(null);
            toast({ tone: 'ok', title: `Deleted material_id ${m.material_id}`, description: 'No rows referenced it, so the DELETE committed.' });
            uploads.reload({ quiet: true });
            stats.reload({ quiet: true });
          }}
        />
      )}
      {!self && s && (
        <RequestSwapModal open={requestOpen} choices={uploads.data || []} userId={viewerId} onClose={() => setRequestOpen(false)} onSubmit={sendRequest} />
      )}
    </div>
  );
}
