import { useCallback, useEffect, useState } from 'react';
import { Database, Layers, TableProperties, TestTube } from 'lucide-react';
import { Badge, Button, CodeBlock, Stat, StatRow, Table, Tabs } from '../components/ui';
import PageHeader from '../components/layout/PageHeader.jsx';
import ERDiagram from '../components/domain/ERDiagram.jsx';
import NormalizationWalkthrough from '../components/domain/NormalizationWalkthrough.jsx';
import ConstraintTester from '../components/domain/ConstraintTester.jsx';
import { db } from '../api/client.js';
import useDbWrites from '../hooks/useDbWrites.js';
import { DDL, INDEXES, INDEX_DDL, TABLE_NAMES, VIEW_DDL, ddlFor } from '../data/schema.js';
import './pages.css';

// The database, on screen: the live schema, how it was normalized, and a
// form for trying to break its constraints.
export default function DbLab() {
  const [tab, setTab] = useState('schema');
  const [counts, setCounts] = useState(() => db.counts());
  const [indexStats, setIndexStats] = useState(() => db.indexStats());
  const [selected, setSelected] = useState('Material');

  const refresh = useCallback(() => {
    setCounts(db.counts());
    setIndexStats(db.indexStats());
  }, []);
  useEffect(refresh, [refresh]);
  useDbWrites(refresh);

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Live schema · 5 tables · 1 view"
        title="DB Lab"
        description="The same database the rest of the app is using — not a picture of one. Tables flash as the app reads them."
        actions={
          <Button as="a" href="#ddl" variant="secondary" size="sm" icon={TableProperties} onClick={() => setTab('ddl')}>
            Jump to the DDL
          </Button>
        }
      />

      <StatRow>
        {TABLE_NAMES.map((t) => (
          <Stat key={t} label={t} value={counts[t]} hint="rows" />
        ))}
        <Stat label="Total" value={totalRows} hint="across all tables" />
      </StatRow>

      <Tabs
        label="DB Lab"
        value={tab}
        onChange={setTab}
        className="dblab__tabs"
        tabs={[
          { id: 'schema', label: 'Schema', icon: Database },
          { id: 'normalization', label: 'Normalization', icon: Layers },
          { id: 'ddl', label: 'DDL & constraints', icon: TestTube },
        ]}
      >
        {tab === 'schema' && (
          <div className="stack gap-5">
            <p className="muted" style={{ maxWidth: '72ch' }}>
              Click any table to open its columns. Row counts update as you use the app, and a table lights up whenever a query touches it — browse
              materials in another tab and watch <span className="mono">Material</span>, <span className="mono">Subject</span>,{' '}
              <span className="mono">Student</span> and <span className="mono">Rating</span> fire together.
            </p>
            <ERDiagram counts={counts} onSelectTable={setSelected} />

            <section className="section">
              <div className="section__head">
                <h2 className="section__title">Indexes</h2>
                <span className="small faint">
                  the <span className="mono">Map</span> objects behind “Index Scan”
                </span>
              </div>
              <Table
                dense
                rowKey="name"
                rows={indexStats}
                columns={[
                  { key: 'name', header: 'Index', type: 'mono' },
                  { key: 'table', header: 'Table', type: 'mono' },
                  { key: 'column', header: 'Column', type: 'mono' },
                  { key: 'keys', header: 'Distinct keys', type: 'num' },
                  { key: 'entries', header: 'Row pointers', type: 'num' },
                ]}
              />
            </section>

            <section className="section">
              <div className="section__head">
                <h2 className="section__title">
                  Rows in <span className="mono">{selected}</span>
                </h2>
                <span className="small faint">first 10, straight from the table</span>
              </div>
              <TablePeek table={selected} />
            </section>
          </div>
        )}

        {tab === 'normalization' && <NormalizationWalkthrough />}

        {tab === 'ddl' && (
          <div className="stack gap-6" id="ddl">
            <section className="section">
              <div className="section__head">
                <h2 className="section__title">Constraint tester</h2>
                <Badge tone="muted">every attempt is rolled back</Badge>
              </div>
              <ConstraintTester />
            </section>

            <section className="section">
              <div className="section__head">
                <h2 className="section__title">The DDL</h2>
                <span className="small faint">generated from the same metadata the app validates against</span>
              </div>
              <div className="ddl-grid">
                {TABLE_NAMES.map((t) => (
                  <CodeBlock key={t} title={t} code={ddlFor(t)} />
                ))}
                <CodeBlock title={`${INDEXES.length} indexes`} code={INDEX_DDL} />
                <CodeBlock title="vw_student_credibility" code={VIEW_DDL} />
              </div>
              <details className="ddl-all">
                <summary>Everything in one block, ready to copy into MySQL or Postgres</summary>
                <CodeBlock title="studyswap.sql" code={DDL} numbered />
              </details>
            </section>
          </div>
        )}
      </Tabs>
    </div>
  );
}

// Raw rows of one table, the way a client tool would show them.
function TablePeek({ table }) {
  const [state, setState] = useState({ rows: [], total: 0, loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    db.rows(table, { limit: 10 }).then((r) => live && setState({ ...r, loading: false }));
    return () => {
      live = false;
    };
  }, [table]);

  const cols = state.rows[0] ? Object.keys(state.rows[0]).filter((k) => k !== '_ui') : [];
  return (
    <Table
      dense
      loading={state.loading}
      rowKey={(r) => Object.values(r)[0]}
      rows={state.rows}
      empty={`${table} is empty.`}
      caption={
        <span className="small faint">
          <span className="mono">SELECT * FROM {table} LIMIT 10;</span> · <span className="num">{state.total}</span> rows in the table
        </span>
      }
      columns={cols.map((c) => ({
        key: c,
        header: c,
        type: typeof state.rows[0]?.[c] === 'number' ? 'num' : 'mono',
        render: (r) => (r[c] === null ? <span className="faint">NULL</span> : String(r[c])),
      }))}
    />
  );
}
