import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DEPARTMENTS } from '../../data/schema.js';
import { subjectClass } from '../../lib/format.js';

// Searchable subject list grouped by department.
//   multiple: value is subject_id[] (checkboxes) — Browse filter rail
//   single:   value is a subject_id | '' (radios) — Upload form
export default function SubjectPicker({ subjects = [], value, onChange, multiple = false, label = 'Subject', error, maxHeight = 260 }) {
  const [q, setQ] = useState('');
  const id = useId();
  const selected = multiple ? new Set(value) : new Set(value ? [Number(value)] : []);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return DEPARTMENTS.map((d) => ({
      ...d,
      items: subjects.filter((s) => s.department === d.code && (!term || `${s.subject_name} ${s.code}`.toLowerCase().includes(term))),
    })).filter((g) => g.items.length);
  }, [subjects, q]);

  function toggle(sid) {
    if (!multiple) return onChange(sid);
    const next = new Set(selected);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    onChange([...next]);
  }

  return (
    <fieldset className={`spicker${error ? ' spicker--error' : ''}`} aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="sr-only">{label}</legend>
      <div className="control spicker__search">
        <span className="control__adorn control__adorn--left" aria-hidden="true">
          <Search />
        </span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter subjects" aria-label={`Filter ${label.toLowerCase()} list`} />
      </div>
      <div className="spicker__list" style={{ maxHeight }}>
        {groups.length === 0 && <p className="small faint spicker__none">No subject matches “{q}”.</p>}
        {groups.map((g) => (
          <div key={g.code} role="group" aria-label={g.name}>
            <p className="eyebrow spicker__dept">{g.code}</p>
            {g.items.map((s) => (
              <label key={s.subject_id} className={`spicker__item ${subjectClass(s.subject_id)}`}>
                <input type={multiple ? 'checkbox' : 'radio'} name={id} checked={selected.has(s.subject_id)} onChange={() => toggle(s.subject_id)} />
                <span className="spicker__name">{s.subject_name}</span>
                <span className="spicker__meta mono">
                  {s.code}
                  {s.material_count !== undefined && <span className="faint"> · {s.material_count}</span>}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
      {error && (
        <p id={`${id}-err`} className="field__msg field__msg--error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
