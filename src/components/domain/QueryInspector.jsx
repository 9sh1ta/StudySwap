import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Database, Gauge, X } from 'lucide-react';
import { Badge, Button, CodeBlock, Table, Tabs, Toggle, Tooltip } from '../ui';
import PlanTree from './PlanTree.jsx';
import useQueryInspector, { useCountUp } from '../../hooks/useQueryInspector.js';
import useKeyboardShortcut from '../../hooks/useKeyboardShortcut.js';

const num = (n, digits = 0) => (n === null || n === undefined ? '—' : Number(n).toFixed(digits));

function Counted({ value, digits = 0, className = 'num' }) {
  const shown = useCountUp(value);
  return <span className={className}>{num(shown, digits)}</span>;
}

// Rows scanned / returned / time / access path for one run of a query.
function RunStats({ stats, label, tone }) {
  if (!stats) return null;
  return (
    <div className={`qi-run qi-run--${tone}`}>
      <p className="eyebrow">{label}</p>
      <p className={`qi-run__scan${stats.index ? ' qi-run__scan--index' : ''}`}>{stats.scan}</p>
      <dl className="qi-run__grid">
        <div>
          <dt>Rows scanned</dt>
          <dd>
            <Counted value={stats.rowsScanned} />
          </dd>
        </div>
        <div>
          <dt>Rows returned</dt>
          <dd>
            <Counted value={stats.rowsReturned} />
          </dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            <Counted value={stats.ms} digits={1} />
            <span className="faint"> ms</span>
          </dd>
        </div>
      </dl>
      {stats.scannedByTable && (
        <ul className="qi-run__tables">
          {Object.entries(stats.scannedByTable).map(([t, n]) => (
            <li key={t}>
              <span className="mono">{t}</span> <span className="num">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Pinned to the bottom of every signed-in screen. Collapsed it is one line;
// expanded it shows the SQL, the plan and the last 20 statements.
export default function QueryInspector() {
  const { open, setOpen, entry: live, history, useIndexes, toggleIndexes } = useQueryInspector();
  const [tab, setTab] = useState('sql');
  const [planVariant, setPlanVariant] = useState('optimized');
  const [pinnedId, setPinnedId] = useState(null);
  // A statement picked from History replaces the live one until dismissed.
  const pinned = pinnedId === null ? null : history.find((h) => h.id === pinnedId);
  const entry = pinned || live;

  useKeyboardShortcut('mod+/', () => setOpen((o) => !o));

  // The same query run the other way, for the side-by-side comparison.
  const comparison = useMemo(() => {
    if (!entry?.replay) return null;
    try {
      return { withIndexes: entry.replay(true), withoutIndexes: entry.replay(false) };
    } catch {
      return null;
    }
  }, [entry]);

  if (!live && !entry) {
    return (
      <div className="qi qi--empty">
        <span className="qi__bar-label">
          <Database aria-hidden="true" /> Query Inspector
        </span>
        <span className="small faint">No query yet — open a screen that loads data.</span>
      </div>
    );
  }

  const current = useIndexes ? comparison?.withIndexes : comparison?.withoutIndexes;
  const other = useIndexes ? comparison?.withoutIndexes : comparison?.withIndexes;
  const speedup = comparison && comparison.withoutIndexes.ms > 0 ? comparison.withoutIndexes.ms / Math.max(comparison.withIndexes.ms, 0.01) : null;

  return (
    <section className={`qi${open ? ' qi--open' : ''}`} aria-label="Query Inspector">
      <button type="button" className="qi__bar" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="qi__bar-label">
          <Database aria-hidden="true" /> Query Inspector
        </span>
        <span className="qi__bar-query truncate">{entry.label}</span>
        <span className={`qi__bar-scan${entry.index ? ' qi__bar-scan--index' : ''}`}>{entry.scan}</span>
        <span className="qi__bar-stat">
          <span className="num">{entry.rowsScanned}</span> scanned
        </span>
        <span className="qi__bar-stat">
          <span className="num">{num(entry.ms, 1)}</span> ms
        </span>
        <span className="qi__bar-toggle">
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          <kbd>Ctrl /</kbd>
        </span>
      </button>

      {open && (
        <div className="qi__panel">
          <div className="qi__head">
            <div className="row gap-2">
              <p className="eyebrow">{entry.label}</p>
              {pinned && (
                <Button variant="ghost" size="sm" onClick={() => setPinnedId(null)}>
                  Back to the live query
                </Button>
              )}
              {entry.tables?.map((t) => (
                <Badge key={t} tone="muted">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="row gap-3">
              <Tooltip content="Turns every secondary index off, for this query and the ones after it. The same SQL then runs as a full table scan.">
                <span>
                  <Toggle checked={useIndexes} onChange={toggleIndexes} label="Use indexes" />
                </span>
              </Tooltip>
              <Button variant="ghost" size="sm" icon={X} aria-label="Close inspector" onClick={() => setOpen(false)} />
            </div>
          </div>

          <Tabs
            label="Query Inspector"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'sql', label: 'SQL' },
              { id: 'plan', label: 'Plan' },
              { id: 'history', label: 'History', count: history.length },
            ]}
          >
            {tab === 'sql' && (
              <div className="qi-grid">
                <CodeBlock title="The statement that ran" code={entry.sql} numbered />
                <div className="stack gap-3">
                  {comparison ? (
                    <>
                      <div className="qi-compare">
                        <RunStats stats={comparison.withIndexes} label="Index scan" tone="index" />
                        <RunStats stats={comparison.withoutIndexes} label="Sequential scan" tone="seq" />
                      </div>
                      {speedup > 1.2 && (
                        <p className="small muted">
                          <Gauge aria-hidden="true" className="qi-inline-icon" /> Indexes make this query{' '}
                          <span className="num">{speedup.toFixed(1)}×</span> faster and read{' '}
                          <span className="num">{Math.round(comparison.withoutIndexes.rowsScanned / Math.max(1, comparison.withIndexes.rowsScanned))}×</span> fewer rows.
                        </p>
                      )}
                      <p className="xsmall faint">
                        Both figures come from running this same statement twice, just now. Switching “Use indexes” off makes the{' '}
                        {useIndexes ? 'right' : 'left'} column the live plan.
                      </p>
                    </>
                  ) : (
                    <RunStats stats={entry} label={entry.kind === 'write' ? 'Write' : 'This run'} tone={entry.index ? 'index' : 'seq'} />
                  )}
                  {current && other && (
                    <p className="xsmall faint">
                      Live now: <span className="mono">{current.scan}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {tab === 'plan' && (
              <div className="stack gap-4">
                <div className="row between">
                  <p className="small muted">
                    {planVariant === 'optimized'
                      ? 'Selections pushed down to the relations they constrain — the joins then work on a fraction of the rows.'
                      : 'The naive tree: join everything first, filter at the end. Same result, far more rows touched.'}
                  </p>
                  <div className="segmented" role="group" aria-label="Plan variant">
                    <button type="button" aria-pressed={planVariant === 'optimized'} onClick={() => setPlanVariant('optimized')}>
                      Optimized
                    </button>
                    <button type="button" aria-pressed={planVariant === 'unoptimized'} onClick={() => setPlanVariant('unoptimized')}>
                      Unoptimized
                    </button>
                  </div>
                </div>
                <PlanTree plan={entry.plan} variant={planVariant} />
              </div>
            )}

            {tab === 'history' && (
              <Table
                dense
                rowKey="id"
                rows={history}
                maxHeight={280}
                empty="Nothing run yet."
                columns={[
                  { key: 'id', header: '#', type: 'id', width: 56 },
                  { key: 'label', header: 'Statement', render: (r) => <span className="truncate">{r.label}</span> },
                  { key: 'kind', header: 'Kind', width: 70, render: (r) => <span className="mono xsmall">{r.kind}</span> },
                  { key: 'tables', header: 'Tables', render: (r) => <span className="mono xsmall faint">{r.tables?.join(', ')}</span> },
                  { key: 'scan', header: 'Access path', render: (r) => <span className={`xsmall${r.index ? ' text-accent' : ''}`}>{r.scan}</span> },
                  { key: 'rowsScanned', header: 'Scanned', type: 'num', width: 84 },
                  { key: 'rowsReturned', header: 'Returned', type: 'num', width: 84 },
                  { key: 'ms', header: 'ms', type: 'num', width: 70, render: (r) => num(r.ms, 1) },
                ]}
                onRowClick={(r) => {
                  if (!r.sql) return;
                  setPinnedId(r.id);
                  setTab('sql');
                }}
              />
            )}
          </Tabs>
        </div>
      )}
    </section>
  );
}
