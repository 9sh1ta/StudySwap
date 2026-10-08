import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Avatar, Button, Chip, EmptyState, Table } from '../components/ui';
import PageHeader from '../components/layout/PageHeader.jsx';
import CredibilityMark, { TierLabel } from '../components/domain/CredibilityMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { students } from '../api/client.js';
import { DEPARTMENTS, departmentName } from '../data/schema.js';
import useAsync from '../hooks/useAsync.js';
import { score } from '../lib/format.js';
import './pages.css';

// GROUP BY department ORDER BY AVG(...) — the query is in the Inspector.
export default function Leaderboard() {
  const { user } = useAuth();
  const [department, setDepartment] = useState(null);
  const board = useAsync(() => students.leaderboard({ department, limit: 25 }), [department]);
  const byDept = useAsync(() => students.departmentLeaderboard(), []);

  const top = board.data?.[0];

  return (
    <div>
      <PageHeader
        eyebrow="vw_student_credibility · GROUP BY"
        title="Leaderboard"
        description="Ranked by credibility — the average of every rating on everything a student has uploaded. Five ratings minimum, so a single 5★ cannot top the table."
      />

      {top && (
        <section className="top-contributor">
          <div className="row gap-4 nowrap">
            <Avatar name={top.name} size="xl" decorative />
            <div className="stack gap-2">
              <p className="eyebrow">Top contributor{department ? ` · ${department}` : ' on campus'}</p>
              <h2 className="section__title">
                <Link to={top.student_id === user.student_id ? '/profile' : `/student/${top.student_id}`} className="match__name">
                  {top.name}
                </Link>
              </h2>
              <p className="small muted">
                {departmentName(top.department)} · <span className="num">{top.upload_count}</span> uploads ·{' '}
                <span className="num">{top.rating_count}</span> ratings
              </p>
            </div>
          </div>
          <CredibilityMark score={top.credibility_score} count={top.rating_count} size="lg" showDerivation />
        </section>
      )}

      <div className="row gap-2 lb-filters" role="group" aria-label="Filter by department">
        <span className="eyebrow">Department</span>
        <Chip selected={department === null} onClick={() => setDepartment(null)}>
          All
        </Chip>
        {DEPARTMENTS.map((d) => (
          <Chip key={d.code} selected={department === d.code} onClick={() => setDepartment(d.code)}>
            {d.code}
          </Chip>
        ))}
      </div>

      {board.error ? (
        <EmptyState title="Could not load the leaderboard" text={board.error.message} action={<Button onClick={() => board.reload()}>Try again</Button>} />
      ) : (
        <Table
          rowKey="student_id"
          loading={board.loading && !board.data}
          rows={board.data || []}
          empty={`No student in ${department} has five ratings yet.`}
          columns={[
            { key: 'rank', header: '#', type: 'num', width: 56 },
            {
              key: 'name',
              header: 'Student',
              sortable: true,
              render: (r) => (
                <span className="row gap-3 nowrap">
                  <Avatar name={r.name} size="xs" decorative />
                  <Link to={r.student_id === user.student_id ? '/profile' : `/student/${r.student_id}`} className={r.student_id === user.student_id ? 'lb-you' : undefined}>
                    {r.name}
                    {r.student_id === user.student_id ? ' (you)' : ''}
                  </Link>
                </span>
              ),
            },
            { key: 'student_id', header: 'student_id', type: 'id', width: 104 },
            { key: 'department', header: 'Dept', sortable: true, width: 80 },
            { key: 'semester', header: 'Sem', type: 'num', width: 70 },
            { key: 'credibility_score', header: 'Credibility', type: 'num', sortable: true, render: (r) => score(r.credibility_score) },
            { key: 'tier', header: 'Tier', render: (r) => <TierLabel score={r.credibility_score} count={r.rating_count} withTooltip={false} /> },
            { key: 'rating_count', header: 'Ratings', type: 'num', sortable: true },
            { key: 'upload_count', header: 'Uploads', type: 'num', sortable: true },
          ]}
        />
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">By department</h2>
          <span className="small faint mono">GROUP BY st.department ORDER BY AVG(r.score) DESC</span>
        </div>
        <Table
          dense
          rowKey="department"
          loading={byDept.loading && !byDept.data}
          rows={byDept.data || []}
          empty="No ratings yet."
          columns={[
            { key: 'department', header: 'Department', render: (r) => departmentName(r.department) },
            { key: 'avg_score', header: 'Average score', type: 'num', render: (r) => score(r.avg_score) },
            { key: 'materials', header: 'Materials', type: 'num' },
            { key: 'ratings', header: 'Ratings', type: 'num' },
          ]}
        />
      </section>

      {!board.loading && !board.data?.length && (
        <EmptyState icon={Trophy} title="Nobody has five ratings yet" text="Credibility needs ratings, and ratings arrive when swaps complete." />
      )}
    </div>
  );
}
