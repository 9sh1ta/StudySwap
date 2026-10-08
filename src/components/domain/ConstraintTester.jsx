import { useMemo, useState } from 'react';
import { CircleCheck, Play } from 'lucide-react';
import { Badge, Button, CodeBlock, Input, Select } from '../ui';
import ErrorNote from './ErrorNote.jsx';
import { db } from '../../api/client.js';
import { TABLES, TABLE_NAMES } from '../../data/schema.js';

// Try an INSERT and watch the database accept or refuse it. Every attempt
// runs inside a transaction that is always rolled back, so the tables the
// rest of the demo uses never change.
const PRESETS = [
  { label: "material_type = 'Essay'", table: 'Material', values: { title: 'Blockchain Unit 2 Essay', subject_id: '15', uploaded_by: '101', material_type: 'Essay', file_link: 'x.pdf' }, expect: 'CHECK' },
  { label: 'score = 9', table: 'Rating', values: { material_id: '1001', rated_by: '104', score: '9' }, expect: 'CHECK' },
  { label: 'semester = 12', table: 'Student', values: { name: 'Test Student', email: 'test.student@vitstudent.ac.in', department: 'CSE', semester: '12' }, expect: 'CHECK' },
  { label: 'email on gmail.com', table: 'Student', values: { name: 'Test Student', email: 'test@gmail.com', department: 'CSE', semester: '5' }, expect: 'CHECK' },
  { label: 'subject_id = 999', table: 'Material', values: { title: 'Orphan material', subject_id: '999', uploaded_by: '101', material_type: 'Notes', file_link: 'x.pdf' }, expect: 'FOREIGN KEY' },
  { label: 'title left empty', table: 'Material', values: { title: '', subject_id: '3', uploaded_by: '101', material_type: 'Notes', file_link: 'x.pdf' }, expect: 'NOT NULL' },
  { label: 'a valid row', table: 'Material', values: { title: 'A perfectly good upload', subject_id: '3', uploaded_by: '101', material_type: 'Notes', file_link: 'x.pdf' }, expect: 'accepted' },
];

const writable = (table) => TABLES[table].columns.filter((c) => !c.pk && !c.derived);

export default function ConstraintTester() {
  const [table, setTable] = useState('Material');
  const [values, setValues] = useState(PRESETS[0].values);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const columns = useMemo(() => writable(table), [table]);

  const sql = useMemo(() => {
    const cols = columns.filter((c) => values[c.name] !== undefined && values[c.name] !== '');
    const quote = (c) => (c.type === 'INT' ? values[c.name] || 'NULL' : `'${values[c.name]}'`);
    return `INSERT INTO ${table} (${cols.map((c) => c.name).join(', ')})\nVALUES (${cols.map(quote).join(', ')});`;
  }, [table, columns, values]);

  function usePreset(p) {
    setTable(p.table);
    setValues(p.values);
    setResult(null);
    setError(null);
  }

  async function run() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const row = await db.tryInsert(table, values);
      setResult(row);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack gap-5">
      <div className="stack gap-2">
        <p className="eyebrow">Try one of these</p>
        <div className="row gap-2">
          {PRESETS.map((p) => (
            <Button key={p.label} variant="secondary" size="sm" onClick={() => usePreset(p)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="tester">
        <div className="stack gap-4">
          <Select
            label="Table"
            value={table}
            onChange={(e) => {
              setTable(e.target.value);
              setValues({});
              setResult(null);
              setError(null);
            }}
            options={TABLE_NAMES.map((t) => ({ value: t, label: t }))}
          />
          {columns.map((c) => (
            <Input
              key={c.name}
              label={c.name}
              column={`${c.type === 'VARCHAR' ? `VARCHAR(${c.length})` : c.type}${c.notNull ? ' NOT NULL' : ''}`}
              mono
              value={values[c.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [c.name]: e.target.value }))}
              placeholder={c.check?.in ? c.check.in.join(' | ') : c.check?.min !== undefined ? `${c.check.min}–${c.check.max}` : c.default ? `default ${c.default}` : ''}
            />
          ))}
          <Button variant="primary" icon={Play} loading={busy} onClick={run}>
            Run the INSERT
          </Button>
        </div>

        <div className="stack gap-3">
          <CodeBlock title="Statement" code={`BEGIN;\n${sql}\nROLLBACK;  -- always, so the demo data is untouched`} />
          {error && (
            <div className="stack gap-2">
              <div className="row gap-2">
                <Badge tone="danger">Refused</Badge>
                <span className="mono xsmall faint">{error.code}</span>
              </div>
              <ErrorNote error={error} />
            </div>
          )}
          {result && (
            <div className="tester__ok">
              <div className="row gap-2">
                <Badge tone="ok" icon={CircleCheck}>
                  Accepted
                </Badge>
                <span className="small muted">and rolled back — nothing was kept.</span>
              </div>
              <p className="small muted">The row the database would have stored, defaults filled in:</p>
              <CodeBlock
                title={`${table} row`}
                language="text"
                code={Object.entries(result)
                  .filter(([k]) => k !== '_ui')
                  .map(([k, v]) => `${k.padEnd(16)} ${v === null ? 'NULL' : v}`)
                  .join('\n')}
              />
            </div>
          )}
          {!error && !result && <p className="small faint">Fill the fields, or pick an example above, then run it.</p>}
        </div>
      </div>
    </div>
  );
}
