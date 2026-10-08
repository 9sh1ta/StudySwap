import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Rows3, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { Badge, Button, Chip, EmptyState, Input, Modal, Pagination, Select, Slider, Table, Tooltip } from '../components/ui';
import PageHeader from '../components/layout/PageHeader.jsx';
import MaterialCard, { MaterialCardSkeleton } from '../components/domain/MaterialCard.jsx';
import SubjectPicker from '../components/domain/SubjectPicker.jsx';
import { TierLabel } from '../components/domain/CredibilityMark.jsx';
import { materials, subjects as subjectsApi } from '../api/client.js';
import { MATERIAL_TYPES, SEMESTER_RANGE } from '../data/schema.js';
import useAsync from '../hooks/useAsync.js';
import useDebounce from '../hooks/useDebounce.js';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { useExamMode } from '../context/ExamModeContext.jsx';
import CramPacks from '../components/domain/CramPacks.jsx';
import { absoluteDate, relativeDate, score, subjectClass } from '../lib/format.js';
import './pages.css';

const PAGE_SIZE = 12;
const SORTS = [
  { value: 'requested_week', label: 'Most requested this week', examOnly: true },
  { value: 'newest', label: 'Newest first' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'requested', label: 'Most requested' },
  { value: 'credibility', label: 'Uploader credibility' },
];
const RATING_STEPS = [0, 2, 3, 4, 4.5];
const SEMESTERS = Array.from({ length: SEMESTER_RANGE.max }, (_, i) => i + 1);

// ── URL <-> filter state ─────────────────────────────────────
const list = (v) => (v ? v.split(',').filter(Boolean) : []);
function readFilters(p) {
  return {
    q: p.get('q') || '',
    subjects: list(p.get('subject')).map(Number),
    types: list(p.get('type')).filter((t) => MATERIAL_TYPES.includes(t)),
    minRating: Number(p.get('minRating')) || 0,
    semester: p.get('semester') || '',
    minCred: Number(p.get('minCred')) || 0,
    from: p.get('from') || '',
    to: p.get('to') || '',
    sort: SORTS.some((s) => s.value === p.get('sort')) ? p.get('sort') : null, // null = the default for the current mode
    page: Math.max(1, Number(p.get('page')) || 1),
  };
}
function toParams(f) {
  const out = {};
  if (f.q) out.q = f.q;
  if (f.subjects.length) out.subject = f.subjects.join(',');
  if (f.types.length) out.type = f.types.join(',');
  if (f.minRating) out.minRating = String(f.minRating);
  if (f.semester) out.semester = f.semester;
  if (f.minCred) out.minCred = String(f.minCred);
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.sort) out.sort = f.sort;
  if (f.page > 1) out.page = String(f.page);
  return out;
}

// Most selective first — used to suggest which filter to drop on zero results.
const NARROWEST = ['q', 'from', 'to', 'minCred', 'minRating', 'types', 'semester', 'subjects'];

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { examMode, exam } = useExamMode();
  const raw = readFilters(params);
  // Exam Mode re-sorts to what is being requested right now.
  const filters = { ...raw, sort: raw.sort || (examMode ? 'requested_week' : 'newest') };
  const [view, setView] = useLocalStorage('studyswap.browse.view', 'grid');
  const [qInput, setQInput] = useState(filters.q);
  const q = useDebounce(qInput, 300);
  const [railOpen, setRailOpen] = useState(false);

  const subjects = useAsync(() => subjectsApi.list(), []);
  const subjectById = useMemo(() => new Map((subjects.data || []).map((s) => [s.subject_id, s])), [subjects.data]);

  const update = (patch, { keepPage = false } = {}) => setParams(toParams({ ...filters, ...patch, page: keepPage ? patch.page ?? filters.page : 1 }));

  // Debounced title search → URL.
  useEffect(() => {
    if (q !== filters.q) update({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  // URL changed from elsewhere (topbar search, back button) → input.
  useEffect(() => {
    setQInput(filters.q);
  }, [filters.q]);

  const key = params.toString();
  const results = useAsync(
    () =>
      materials.browse({
        q: filters.q,
        subjectId: filters.subjects,
        type: filters.types,
        minRating: filters.minRating,
        semester: filters.semester,
        minCredibility: filters.minCred,
        dateFrom: filters.from || null,
        dateTo: filters.to || null,
        sort: filters.sort,
        page: filters.page,
        pageSize: PAGE_SIZE,
      }),
    [key]
  );

  // Active filters as removable chips.
  const chips = [
    filters.q && { id: 'q', label: 'Title', value: `“${filters.q}”`, clear: { q: '' } },
    ...filters.subjects.map((sid) => ({
      id: `s${sid}`,
      subject: sid,
      value: subjectById.get(sid)?.subject_name || `subject_id ${sid}`,
      code: subjectById.get(sid)?.code,
      clear: { subjects: filters.subjects.filter((x) => x !== sid) },
    })),
    ...filters.types.map((t) => ({ id: `t${t}`, label: 'Type', value: t, clear: { types: filters.types.filter((x) => x !== t) } })),
    filters.minRating && { id: 'minRating', label: 'Rating', value: `≥ ${filters.minRating}`, clear: { minRating: 0 } },
    filters.semester && { id: 'semester', label: 'Semester', value: filters.semester, clear: { semester: '' } },
    filters.minCred && { id: 'minCred', label: 'Uploader credibility', value: `≥ ${filters.minCred.toFixed(1)}`, clear: { minCred: 0 } },
    filters.from && { id: 'from', label: 'From', value: filters.from, clear: { from: '' } },
    filters.to && { id: 'to', label: 'To', value: filters.to, clear: { to: '' } },
  ].filter(Boolean);
  const clearAll = () => {
    setQInput('');
    setParams(raw.sort ? { sort: raw.sort } : {});
  };

  const narrowest = NARROWEST.find((k) => (Array.isArray(filters[k]) ? filters[k].length : filters[k]));
  const narrowLabel = {
    q: `the title search “${filters.q}”`,
    from: 'the start date',
    to: 'the end date',
    minCred: `uploader credibility ≥ ${filters.minCred}`,
    minRating: `rating ≥ ${filters.minRating}`,
    types: `type ${filters.types.join(' / ')}`,
    semester: `semester ${filters.semester}`,
    subjects: 'the subject filter',
  }[narrowest];
  const dropNarrowest = () => {
    if (narrowest === 'q') setQInput('');
    update({ [narrowest]: Array.isArray(filters[narrowest]) ? [] : narrowest === 'minRating' || narrowest === 'minCred' ? 0 : '' });
  };

  const data = results.data;
  const rail = <FilterRail filters={filters} update={update} subjects={subjects.data} />;

  return (
    <div>
      <PageHeader eyebrow="Material · Subject · Student · Rating" title="Browse materials" description="Every filter below becomes part of one SQL query over the Material table." />

      {examMode && (
        <section className="section browse__cram">
          <div className="section__head">
            <h2 className="section__title">Cram packs · {exam.name} in {exam.daysLeft} days</h2>
            <span className="small faint">best Notes, PYQ and Summary per subject in your semester</span>
          </div>
          <CramPacks />
        </section>
      )}

      <div className="browse__search">
        <Input
          icon={Search}
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search titles — try “normalization”, “PYQ 2024”, “FFT”"
          aria-label="Search material titles"
          suffix={qInput && <Button variant="ghost" size="sm" icon={X} aria-label="Clear search" onClick={() => setQInput('')} />}
        />
      </div>

      <div className="browse">
        <aside className="browse__rail" aria-label="Filters">
          {rail}
        </aside>

        <div className="browse__results">
          <div className="browse__bar">
            <p className="browse__count" aria-live="polite">
              {data ? (
                <>
                  <span className="num">{data.total}</span> material{data.total === 1 ? '' : 's'}
                  {data.ms !== null && (
                    <span className="faint">
                      {' '}
                      · <span className="num">{data.ms.toFixed(1)}</span> ms
                    </span>
                  )}
                </>
              ) : (
                <span className="faint">Querying…</span>
              )}
            </p>
            <div className="row gap-2 nowrap">
              <Button className="browse__filters-btn" variant="secondary" size="sm" icon={SlidersHorizontal} onClick={() => setRailOpen(true)}>
                Filters{chips.length ? ` (${chips.length})` : ''}
              </Button>
              <label className="sr-only" htmlFor="sort">
                Sort by
              </label>
              <div className="control browse__sort">
                <select id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
                  {SORTS.filter((s) => !s.examOnly || examMode).map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="segmented" role="group" aria-label="View">
                <Tooltip content="Card grid">
                  <button type="button" aria-pressed={view === 'grid'} aria-label="Card grid" onClick={() => setView('grid')}>
                    <LayoutGrid aria-hidden="true" />
                  </button>
                </Tooltip>
                <Tooltip content="Table">
                  <button type="button" aria-pressed={view === 'table'} aria-label="Table" onClick={() => setView('table')}>
                    <Rows3 aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="browse__chips">
              {chips.map((c) => (
                <Chip key={c.id} label={c.label} subject={c.subject} code={c.code} onRemove={() => (c.id === 'q' ? setQInput('') : update(c.clear))}>
                  {c.value}
                </Chip>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            </div>
          )}

          <div aria-busy={results.loading} className={results.loading && data ? 'is-refreshing' : ''}>
            {results.error ? (
              <EmptyState icon={SearchX} title="The query failed" text={`${results.error.message}${results.error.detail ? ` — ${results.error.detail}` : ''}`} action={<Button onClick={() => results.reload()}>Run it again</Button>} />
            ) : !data ? (
              <div className="mgrid" role="status">
                <span className="sr-only">Loading materials</span>
                {Array.from({ length: 6 }, (_, i) => (
                  <MaterialCardSkeleton key={i} />
                ))}
              </div>
            ) : data.total === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No materials match these filters"
                text={narrowest ? `The narrowest filter is ${narrowLabel}. Dropping it is the quickest way to widen the search.` : 'The Material table has no rows yet.'}
                action={
                  narrowest && (
                    <>
                      <Button variant="primary" onClick={dropNarrowest}>
                        Drop {narrowLabel.replace(/^the /, '')}
                      </Button>
                      <Button variant="ghost" onClick={clearAll}>
                        Clear all filters
                      </Button>
                    </>
                  )
                }
              />
            ) : view === 'grid' ? (
              <div className="mgrid">
                {data.rows.map((m) => (
                  <MaterialCard key={m.material_id} material={m} />
                ))}
              </div>
            ) : (
              <Table
                rowKey="material_id"
                rows={data.rows}
                onRowClick={(m) => navigate(`/material/${m.material_id}`)}
                columns={[
                  { key: 'material_id', header: 'material_id', type: 'id', sortable: true, width: 104 },
                  {
                    key: 'title',
                    header: 'Title',
                    sortable: true,
                    render: (m) => (
                      <div className={`table-title ${subjectClass(m.subject_id)}`}>
                        <Link to={`/material/${m.material_id}`} onClick={(e) => e.stopPropagation()}>
                          {m.title}
                        </Link>
                        <span className="xsmall faint">
                          {m.subject.subject_name} · <span className="mono">{m.subject.code}</span>
                        </span>
                      </div>
                    ),
                  },
                  { key: 'material_type', header: 'Type', sortable: true, render: (m) => <Badge>{m.material_type}</Badge> },
                  {
                    key: 'uploader',
                    header: 'Uploaded by',
                    sortValue: (m) => m.uploader?.name,
                    sortable: true,
                    render: (m) => (
                      <span className="stack gap-1">
                        <span>{m.uploader?.name}</span>
                        <TierLabel score={m.uploader?.credibility_score} count={m.uploader?.rating_count ?? 0} withTooltip={false} />
                      </span>
                    ),
                  },
                  { key: 'avg_rating', header: 'Avg score', type: 'num', sortable: true, render: (m) => score(m.avg_rating) },
                  { key: 'rating_count', header: 'Ratings', type: 'num', sortable: true },
                  {
                    key: 'upload_date',
                    header: 'Uploaded',
                    type: 'num',
                    sortable: true,
                    render: (m) => <span title={absoluteDate(m.upload_date)}>{relativeDate(m.upload_date)}</span>,
                  },
                ]}
              />
            )}
          </div>

          {data && data.total > 0 && <Pagination page={data.page} pageSize={PAGE_SIZE} total={data.total} noun="materials" onChange={(page) => update({ page }, { keepPage: true })} />}
        </div>
      </div>

      <Modal
        open={railOpen}
        onClose={() => setRailOpen(false)}
        title="Filters"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={clearAll}>
              Clear all
            </Button>
            <Button variant="primary" onClick={() => setRailOpen(false)}>
              Show {data?.total ?? ''} results
            </Button>
          </>
        }
      >
        {rail}
      </Modal>
    </div>
  );
}

// ── Filter rail ──────────────────────────────────────────────
function FilterRail({ filters, update, subjects }) {
  const [cred, setCred] = useState(filters.minCred);
  const debouncedCred = useDebounce(cred, 250);
  useEffect(() => setCred(filters.minCred), [filters.minCred]);
  useEffect(() => {
    if (debouncedCred !== filters.minCred) update({ minCred: debouncedCred });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCred]);

  const toggleType = (t) => update({ types: filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t] });

  return (
    <div className="rail">
      <section className="rail__group">
        <h2 className="rail__title">
          Subject <span className="mono">subject_id</span>
        </h2>
        {subjects ? <SubjectPicker multiple subjects={subjects} value={filters.subjects} onChange={(v) => update({ subjects: v })} maxHeight={240} /> : <div className="skeleton" style={{ height: 240 }} />}
      </section>

      <section className="rail__group">
        <h2 className="rail__title">
          Material type <span className="mono">material_type</span>
        </h2>
        <div className="rail__checks">
          {MATERIAL_TYPES.map((t) => (
            <label key={t} className="rail__check">
              <input type="checkbox" checked={filters.types.includes(t)} onChange={() => toggleType(t)} />
              {t}
            </label>
          ))}
        </div>
      </section>

      <section className="rail__group">
        <h2 className="rail__title">
          Minimum rating <span className="mono">AVG(score)</span>
        </h2>
        <div className="row gap-1" role="radiogroup" aria-label="Minimum rating">
          {RATING_STEPS.map((r) => (
            <Chip key={r} selected={filters.minRating === r} onClick={() => update({ minRating: r })}>
              {r === 0 ? 'Any' : `${r}+`}
            </Chip>
          ))}
        </div>
      </section>

      <section className="rail__group">
        <Select
          label="Semester"
          column="Subject.semester"
          placeholder="Any semester"
          value={filters.semester}
          onChange={(e) => update({ semester: e.target.value })}
          options={SEMESTERS.map((s) => ({ value: String(s), label: `Semester ${s}` }))}
        />
      </section>

      <section className="rail__group">
        <Slider label="Uploader credibility ≥" min={0} max={5} step={0.5} value={cred} onChange={setCred} format={(v) => (v ? v.toFixed(1) : 'Any')} />
      </section>

      <section className="rail__group">
        <h2 className="rail__title">
          Uploaded between <span className="mono">upload_date</span>
        </h2>
        <div className="rail__dates">
          <Input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
          <Input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </div>
      </section>
    </div>
  );
}
