import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, SegmentedRule } from '../ui';

// UNF → 1NF → 2NF → 3NF on one real StudySwap record. Each step names the
// dependency being removed and shows the tables it leaves behind.
const STEPS = [
  {
    id: 'unf',
    name: 'UNF',
    title: 'One row per material, with everything crammed in',
    problem: 'Ratings repeat inside a single cell, so no column holds one value. Nothing can be queried without parsing text.',
    rule: 'A relation is in UNF while any attribute holds a repeating group.',
    tables: [
      {
        name: 'Material_Record',
        columns: ['material_id', 'title', 'subject_name', 'department', 'uploader_name', 'ratings'],
        rows: [
          ['1001', 'DBMS Unit 3 — Normalization', 'Database Systems', 'CSE', 'Aarav Mehta', '5 (Diya), 4 (Kabir), 5 (Ananya)'],
          ['1006', 'CN Unit 3 — Subnetting', 'Computer Networks', 'CSE', 'Ananya Iyer', '5 (Aarav), 4 (Diya)'],
        ],
        flag: [5],
      },
    ],
  },
  {
    id: '1nf',
    name: '1NF',
    title: 'Every cell holds one value',
    problem: 'The repeating group is gone, but the title, subject and uploader are copied on every rating row. Update one title and you must update them all.',
    rule: '1NF: atomic values, no repeating groups. Key is (material_id, rated_by).',
    tables: [
      {
        name: 'Material_Rating',
        columns: ['material_id', 'rated_by', 'score', 'title', 'subject_name', 'department', 'uploader_name'],
        rows: [
          ['1001', '103', '5', 'DBMS Unit 3 — Normalization', 'Database Systems', 'CSE', 'Aarav Mehta'],
          ['1001', '104', '4', 'DBMS Unit 3 — Normalization', 'Database Systems', 'CSE', 'Aarav Mehta'],
          ['1001', '102', '5', 'DBMS Unit 3 — Normalization', 'Database Systems', 'CSE', 'Aarav Mehta'],
          ['1006', '101', '5', 'CN Unit 3 — Subnetting', 'Computer Networks', 'CSE', 'Ananya Iyer'],
        ],
        flag: [3, 4, 5, 6],
      },
    ],
  },
  {
    id: '2nf',
    name: '2NF',
    title: 'Nothing depends on part of the key',
    problem: 'title, subject and uploader depended on material_id alone — half of the key. They move to their own table; only score stays with the full key.',
    rule: '2NF: no partial dependency on a composite key.',
    tables: [
      {
        name: 'Material',
        columns: ['material_id', 'title', 'subject_name', 'department', 'uploader_name'],
        rows: [
          ['1001', 'DBMS Unit 3 — Normalization', 'Database Systems', 'CSE', 'Aarav Mehta'],
          ['1006', 'CN Unit 3 — Subnetting', 'Computer Networks', 'CSE', 'Ananya Iyer'],
        ],
        flag: [2, 3, 4],
      },
      {
        name: 'Rating',
        columns: ['material_id', 'rated_by', 'score'],
        rows: [
          ['1001', '103', '5'],
          ['1001', '104', '4'],
          ['1001', '102', '5'],
          ['1006', '101', '5'],
        ],
      },
    ],
  },
  {
    id: '3nf',
    name: '3NF',
    title: 'Nothing depends on a non-key column',
    problem: 'None. department depended on subject_name, and the uploader name on the uploader — both transitive. Each now lives once, referenced by id.',
    rule: '3NF: no transitive dependency. This is the schema the app runs on.',
    tables: [
      {
        name: 'Material',
        columns: ['material_id', 'title', 'subject_id', 'uploaded_by'],
        rows: [
          ['1001', 'DBMS Unit 3 — Normalization', '3', '101'],
          ['1006', 'CN Unit 3 — Subnetting', '5', '102'],
        ],
      },
      {
        name: 'Subject',
        columns: ['subject_id', 'subject_name', 'department'],
        rows: [
          ['3', 'Database Systems', 'CSE'],
          ['5', 'Computer Networks', 'CSE'],
        ],
      },
      {
        name: 'Student',
        columns: ['student_id', 'name', 'department'],
        rows: [
          ['101', 'Aarav Mehta', 'CSE'],
          ['102', 'Ananya Iyer', 'CSE'],
        ],
      },
      {
        name: 'Rating',
        columns: ['material_id', 'rated_by', 'score'],
        rows: [
          ['1001', '103', '5'],
          ['1001', '104', '4'],
          ['1006', '101', '5'],
        ],
      },
    ],
  },
];

function NormTable({ table }) {
  const flag = new Set(table.flag || []);
  return (
    <figure className="norm-table">
      <figcaption className="mono small">{table.name}</figcaption>
      <div className="table-wrap">
        <table className="table table--dense">
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={c} scope="col" className={flag.has(i) ? 'norm-col--flag' : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, i) => (
                  <td key={table.columns[i]} className={`mono${flag.has(i) ? ' norm-col--flag' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export default function NormalizationWalkthrough() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  return (
    <div className="stack gap-5">
      <div className="norm__head">
        <div className="stack gap-2 grow">
          <SegmentedRule segments={STEPS.length} filled={step + 1} label={`Step ${step + 1} of ${STEPS.length}`} detail={s.name} ariaLabel={`Normal form ${s.name}`} />
          <ol className="norm__steps">
            {STEPS.map((x, i) => (
              <li key={x.id}>
                <button type="button" className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                  {x.name}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="row gap-2">
          <Button variant="secondary" size="sm" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((n) => n - 1)}>
            Back
          </Button>
          <Button variant="primary" size="sm" iconRight={ArrowRight} disabled={step === STEPS.length - 1} onClick={() => setStep((n) => n + 1)}>
            Next
          </Button>
        </div>
      </div>

      <div className="stack gap-2">
        <h3 className="section__title">{s.title}</h3>
        <p className="muted">{s.problem}</p>
        <p className="small mono faint">{s.rule}</p>
      </div>

      <div className="norm__tables" key={s.id}>
        {s.tables.map((t) => (
          <NormTable key={t.name} table={t} />
        ))}
      </div>
    </div>
  );
}
