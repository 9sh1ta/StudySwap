import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { History, Inbox, Library, Send } from 'lucide-react';
import { Badge, Button, Chip, EmptyState, Skeleton, Table, Tabs } from '../components/ui';
import PageHeader from '../components/layout/PageHeader.jsx';
import RequestCard from '../components/domain/RequestCard.jsx';
import RejectModal from '../components/domain/RejectModal.jsx';
import RatingModal from '../components/domain/RatingModal.jsx';
import { errorToast } from '../components/domain/ErrorNote.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { requests } from '../api/client.js';
import { REQUEST_STATUS } from '../data/schema.js';
import useAsync from '../hooks/useAsync.js';
import { absoluteDate, relativeDate } from '../lib/format.js';
import './pages.css';

const ACTIVE = ['Pending', 'Accepted'];

export default function Requests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = ['incoming', 'outgoing', 'history'].includes(params.get('tab')) ? params.get('tab') : 'incoming';
  const [statusFilter, setStatusFilter] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rating, setRating] = useState(null);

  const incoming = useAsync(() => requests.incoming(user.student_id), [user.student_id]);
  const outgoing = useAsync(() => requests.outgoing(user.student_id), [user.student_id]);

  // Outgoing keeps Completed-but-unrated rows: they still need an action.
  const lists = {
    incoming: (incoming.data || []).filter((r) => ACTIVE.includes(r.status)),
    outgoing: (outgoing.data || []).filter((r) => ACTIVE.includes(r.status) || (r.status === 'Completed' && !r.has_rated)),
    history: [
      ...(incoming.data || []).filter((r) => !ACTIVE.includes(r.status)).map((r) => ({ ...r, direction: 'incoming' })),
      ...(outgoing.data || []).filter((r) => !ACTIVE.includes(r.status)).map((r) => ({ ...r, direction: 'outgoing' })),
    ].sort((a, b) => (b.response_date || b.request_date).localeCompare(a.response_date || a.request_date)),
  };
  const statusesIn = { incoming: ACTIVE, outgoing: [...ACTIVE, 'Completed'], history: ['Rejected', 'Completed'] }[tab];
  const shown = lists[tab].filter((r) => !statusFilter.length || statusFilter.includes(r.status));
  const loading = (incoming.loading && !incoming.data) || (outgoing.loading && !outgoing.data);
  const error = incoming.error || outgoing.error;

  const setTab = (t) => {
    setStatusFilter([]);
    setParams(t === 'incoming' ? {} : { tab: t });
  };

  // Optimistic update of one row's status; the database has the final say.
  async function mutate(state, requestId, patch, action, success) {
    const before = state.data;
    state.setData((list) => list.map((r) => (r.request_id === requestId ? { ...r, ...patch } : r)));
    setBusyId(requestId);
    try {
      await action();
      success && toast(success);
      state.reload({ quiet: true });
    } catch (err) {
      state.setData(before); // roll back the optimistic change…
      state.reload({ quiet: true }); // …then show what the database actually holds
      toast(errorToast(err, 'The database rejected that change'));
    } finally {
      setBusyId(null);
    }
  }

  const accept = (r) =>
    mutate(incoming, r.request_id, { status: 'Accepted', response_date: new Date().toLocaleDateString('en-CA') }, () => requests.respond(r.request_id, user.student_id, 'Accepted'), {
      tone: 'ok',
      title: 'Request accepted',
      description: `${r.requester.name} can now access “${r.material.title}”.`,
    });

  const reject = (r, reason) =>
    mutate(incoming, r.request_id, { status: 'Rejected', response_date: new Date().toLocaleDateString('en-CA'), _ui: { ...r._ui, reject_reason: reason } }, () => requests.respond(r.request_id, user.student_id, 'Rejected', reason), {
      title: 'Request rejected',
      description: `request_id ${r.request_id} · status 'Rejected'`,
    });

  const withdraw = async (r) => {
    const before = outgoing.data;
    outgoing.setData((list) => list.filter((x) => x.request_id !== r.request_id));
    try {
      await requests.withdraw(r.request_id, user.student_id);
      toast({ title: 'Request withdrawn', description: `Swap_Request ${r.request_id} deleted.` });
    } catch (err) {
      outgoing.setData(before);
      toast(errorToast(err));
    }
  };

  async function submitRating(values) {
    const r = rating;
    await requests.complete(r.request_id, user.student_id, values);
    setRating(null);
    toast({ tone: 'ok', title: 'Swap completed', description: `status 'Completed' + Rating inserted (${values.score}★) in one transaction.` });
    outgoing.reload({ quiet: true });
  }

  const counts = { incoming: lists.incoming.length, outgoing: lists.outgoing.length, history: lists.history.length };

  return (
    <div>
      <PageHeader eyebrow="Swap_Request" title="Swap requests" description="Requests for your uploads, requests you sent, and everything already settled." />

      <Tabs
        label="Swap requests"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'incoming', label: 'Incoming', icon: Inbox, count: loading ? undefined : counts.incoming },
          { id: 'outgoing', label: 'Outgoing', icon: Send, count: loading ? undefined : counts.outgoing },
          { id: 'history', label: 'History', icon: History, count: loading ? undefined : counts.history },
        ]}
      >
        <div className="row gap-2 req-filters" role="group" aria-label="Filter by status">
          <span className="eyebrow">Status</span>
          {REQUEST_STATUS.filter((s) => statusesIn.includes(s)).map((s) => (
            <Chip key={s} selected={statusFilter.includes(s)} onClick={() => setStatusFilter((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s]))}>
              {s}
            </Chip>
          ))}
          {statusFilter.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter([])}>
              Clear
            </Button>
          )}
        </div>

        {error ? (
          <EmptyState title="Could not load your requests" text={error.message} action={<Button onClick={() => (incoming.reload(), outgoing.reload())}>Try again</Button>} />
        ) : loading ? (
          <div className="req-list">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={170} />
            ))}
          </div>
        ) : tab === 'history' ? (
          <Table
            rowKey="request_id"
            rows={shown}
            defaultSort={{ key: 'response_date', dir: 'desc' }}
            onRowClick={(r) => navigate(`/material/${r.material_id}`)}
            empty={statusFilter.length ? `No ${statusFilter.join(' or ')} requests in your history.` : 'Nothing settled yet. Completed and rejected requests collect here.'}
            columns={[
              { key: 'request_id', header: 'request_id', type: 'id', sortable: true, width: 100 },
              { key: 'direction', header: 'Direction', sortable: true, render: (r) => (r.direction === 'incoming' ? 'For your upload' : 'You requested') },
              { key: 'title', header: 'Material', sortValue: (r) => r.material?.title, sortable: true, render: (r) => <span className="clamp-2">{r.material?.title}</span> },
              { key: 'who', header: 'With', sortValue: (r) => (r.direction === 'incoming' ? r.requester?.name : r.owner?.name), render: (r) => (r.direction === 'incoming' ? r.requester?.name : r.owner?.name) },
              { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge status={r.status} /> },
              { key: 'request_date', header: 'Requested', type: 'num', sortable: true, render: (r) => <span title={absoluteDate(r.request_date)}>{relativeDate(r.request_date)}</span> },
              { key: 'response_date', header: 'Responded', type: 'num', sortable: true, render: (r) => <span title={absoluteDate(r.response_date)}>{relativeDate(r.response_date)}</span> },
            ]}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={tab === 'incoming' ? Inbox : Send}
            title={
              statusFilter.length
                ? `No ${statusFilter.join(' or ')} requests here`
                : tab === 'incoming'
                  ? 'No one is waiting on you'
                  : 'You have no open requests'
            }
            text={
              tab === 'incoming'
                ? 'Requests for your uploads land here. More uploads mean more requests — and more ratings toward your credibility.'
                : 'Find something useful for your semester and send a swap request.'
            }
            action={
              <Button as={Link} to={tab === 'incoming' ? '/upload' : '/browse'} variant="primary" icon={tab === 'incoming' ? Send : Library}>
                {tab === 'incoming' ? 'Upload a material' : 'Browse materials'}
              </Button>
            }
          />
        ) : (
          <div className="req-list">
            {shown.map((r) => (
              <RequestCard
                key={r.request_id}
                request={r}
                direction={tab}
                busy={busyId === r.request_id}
                onAccept={accept}
                onReject={setRejecting}
                onComplete={setRating}
                onWithdraw={withdraw}
              />
            ))}
          </div>
        )}
      </Tabs>

      <RejectModal
        request={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          const r = rejecting;
          setRejecting(null);
          reject(r, reason);
        }}
      />
      <RatingModal
        open={!!rating}
        material={rating?.material}
        title={rating?.status === 'Accepted' ? 'Mark received & rate' : 'Rate this material'}
        description={rating?.status === 'Accepted' ? "Sets status = 'Completed' and inserts your Rating in one transaction." : 'You marked this received earlier — add your rating.'}
        onClose={() => setRating(null)}
        onSubmit={submitRating}
      />
    </div>
  );
}
