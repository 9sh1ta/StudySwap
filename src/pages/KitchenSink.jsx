import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Database,
  FileText,
  Inbox,
  LogOut,
  Mail,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Sun,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Chip,
  CodeBlock,
  Dropdown,
  EmptyState,
  Input,
  Loading,
  Modal,
  Pagination,
  ProgressRule,
  Rule,
  SegmentedRule,
  Select,
  Skeleton,
  Slider,
  StarRating,
  Stat,
  StatRow,
  Table,
  Tabs,
  Textarea,
  Toggle,
  Tooltip,
} from '../components/ui';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './KitchenSink.css';

// ── Specimen data ─────────────────────────────────────────────
// Phase 2 moves the enums into data/schema.js and the rows into seed.js.
// They live here only so the kit can be reviewed before the data layer exists.
const MATERIAL_TYPES = ['Notes', 'PYQ', 'Assignment', 'Summary'];
const REQUEST_STATUS = ['Pending', 'Accepted', 'Rejected', 'Completed'];

const SUBJECTS = [
  { subject_id: 1, code: 'BCSE302L', subject_name: 'Database Systems', department: 'CSE' },
  { subject_id: 2, code: 'BCSE202L', subject_name: 'Data Structures and Algorithms', department: 'CSE' },
  { subject_id: 3, code: 'BMAT205L', subject_name: 'Discrete Mathematics', department: 'CSE' },
  { subject_id: 4, code: 'BCSE303L', subject_name: 'Operating Systems', department: 'CSE' },
  { subject_id: 5, code: 'BECE301L', subject_name: 'Digital Signal Processing', department: 'ECE' },
  { subject_id: 6, code: 'BMEE203L', subject_name: 'Engineering Thermodynamics', department: 'MECH' },
];

const MATERIALS = [
  { material_id: 1042, title: 'DBMS Unit 3 — Normalization, Handwritten', subject_id: 1, material_type: 'Notes', uploader: 'Aarav Mehta', avg: 4.6, ratings: 18, upload_date: '2026-09-12' },
  { material_id: 1107, title: 'CN Mid-Sem PYQ 2023 with Solutions', subject_id: 4, material_type: 'PYQ', uploader: 'Diya Raghavan', avg: 4.2, ratings: 11, upload_date: '2026-09-03' },
  { material_id: 988, title: 'DSA Assignment 4 — AVL and Red-Black Trees', subject_id: 2, material_type: 'Assignment', uploader: 'Kabir Sethi', avg: 3.8, ratings: 7, upload_date: '2026-08-21' },
  { material_id: 1150, title: 'Discrete Maths — Graph Theory One-Page Summary', subject_id: 3, material_type: 'Summary', uploader: 'Ananya Iyer', avg: 4.9, ratings: 23, upload_date: '2026-09-16' },
  { material_id: 873, title: 'OS Process Scheduling — FCFS, SJF, RR worked problems', subject_id: 4, material_type: 'Notes', uploader: 'Rohan Kulkarni', avg: 3.4, ratings: 5, upload_date: '2026-07-30' },
  { material_id: 1011, title: 'DSP End-Sem PYQ 2024 — Z-Transform and FIR Design', subject_id: 5, material_type: 'PYQ', uploader: 'Meera Nair', avg: 4.1, ratings: 9, upload_date: '2026-08-28' },
  { material_id: 764, title: 'Thermodynamics Unit 2 — First Law for Open Systems', subject_id: 6, material_type: 'Notes', uploader: 'Ishaan Verma', avg: 3.9, ratings: 6, upload_date: '2026-06-18' },
  { material_id: 1133, title: 'DBMS SQL Joins Cheat Sheet with Relational Algebra', subject_id: 1, material_type: 'Summary', uploader: 'Aarav Mehta', avg: 4.4, ratings: 14, upload_date: '2026-09-14' },
];

const subjectOf = (id) => SUBJECTS.find((s) => s.subject_id === id);

const SAMPLE_SQL = `-- Browse: Notes for Database Systems, best rated first
SELECT m.material_id, m.title, s.subject_name, st.name AS uploader,
       AVG(r.score) AS avg_rating
FROM Material m
JOIN Subject s   ON m.subject_id  = s.subject_id
JOIN Student st  ON m.uploaded_by = st.student_id
LEFT JOIN Rating r ON r.material_id = m.material_id
WHERE m.subject_id = 1 AND m.material_type = 'Notes'
GROUP BY m.material_id, s.subject_name, st.name
ORDER BY avg_rating DESC
LIMIT 12;`;

const TODAY = new Date('2026-09-19T12:00:00');

function relativeDate(iso) {
  const days = Math.round((TODAY - new Date(`${iso}T12:00:00`)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} wk ago`;
  return `${Math.round(days / 30)} mo ago`;
}
function absoluteDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['type', 'Typography'],
  ['buttons', 'Buttons'],
  ['fields', 'Form fields'],
  ['controls', 'Controls'],
  ['badges', 'Badges & chips'],
  ['people', 'Avatars & stats'],
  ['tabs', 'Tabs'],
  ['table', 'Table & pagination'],
  ['overlays', 'Modal, toast, dropdown, tooltip'],
  ['loading', 'Skeleton & empty'],
  ['code', 'Code block'],
];

export default function KitchenSink() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="ks page-fade">
      <header className="ks-top">
        <div className="row gap-3 nowrap">
          <span className="ks-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">StudySwap · Phase 1</p>
            <h1 className="ks-title">Ink &amp; Index — component kit</h1>
          </div>
        </div>
        <Button variant="secondary" icon={theme === 'dark' ? Sun : Moon} onClick={toggleTheme}>
          {theme === 'dark' ? 'Light' : 'Dark'} theme
        </Button>
      </header>

      <div className="ks-layout">
        <nav className="ks-nav" aria-label="Kit sections">
          <p className="eyebrow">Contents</p>
          <ol>
            {SECTIONS.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span> {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="ks-main">
          <TokensSection />
          <TypeSection />
          <ButtonsSection />
          <FieldsSection />
          <ControlsSection />
          <BadgesSection />
          <PeopleSection />
          <TabsSection />
          <TableSection />
          <OverlaysSection />
          <LoadingSection />
          <CodeSection />
          <p className="faint small ks-foot">
            BACSE202 · Database Systems · Review 1 prototype. No shadows, no gradients, radii ≤ 6px.
          </p>
        </main>
      </div>
    </div>
  );
}

function Section({ id, n, title, note, children }) {
  return (
    <section id={id} className="ks-section" aria-labelledby={`${id}-h`}>
      <div className="ks-section__head">
        <span className="num faint">{String(n).padStart(2, '0')}</span>
        <h2 id={`${id}-h`}>{title}</h2>
      </div>
      {note && <p className="muted ks-note">{note}</p>}
      <div className="stack gap-5">{children}</div>
    </section>
  );
}

function Specimen({ label, children }) {
  return (
    <div className="ks-specimen">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}

// ── 01 Tokens ─────────────────────────────────────────────────
const SWATCHES = [
  ['--paper', 'page ground'],
  ['--paper-raised', 'cards, panels'],
  ['--paper-sunk', 'inputs, code'],
  ['--ink', 'text'],
  ['--ink-2', 'secondary'],
  ['--ink-3', 'labels'],
  ['--rule', 'every border'],
  ['--rule-strong', 'hover border'],
  ['--accent', 'action, nav, links'],
  ['--accent-wash', 'active fill'],
  ['--ok', 'Accepted'],
  ['--warn', 'Pending'],
  ['--danger', 'Rejected, errors'],
];

function TokensSection() {
  return (
    <Section id="tokens" n={1} title="Tokens" note="Both themes rendered side by side from the same variables. The page theme toggle switches everything else.">
      <div className="ks-themes">
        {['light', 'dark'].map((t) => (
          <div key={t} data-theme={t} className="ks-theme">
            <p className="eyebrow">{t}</p>
            <ul className="ks-swatches">
              {SWATCHES.map(([v, use]) => (
                <li key={v}>
                  <span className="ks-swatch" style={{ background: `var(${v})` }} />
                  <span className="mono small">{v}</span>
                  <span className="faint xsmall">{use}</span>
                </li>
              ))}
            </ul>
            <p className="eyebrow" style={{ marginTop: 'var(--sp-4)' }}>
              Subject spines
            </p>
            <div className="ks-spines">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <span key={n} className={`ks-spine sub-${n}`}>
                  <span className="mono xsmall">--sub-{n}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── 02 Typography ─────────────────────────────────────────────
function TypeSection() {
  return (
    <Section id="type" n={2} title="Typography" note="Hierarchy is carried by size, weight and serif-versus-sans — not colour, not boxes.">
      <div className="stack gap-4">
        <p className="eyebrow">Display · Fraunces 600, −0.02em</p>
        <p className="ks-hero-type">Swap notes, not money.</p>
        <h1>Browse materials</h1>
        <h2>DBMS Unit 3 — Normalization, Handwritten</h2>
        <h3>More from this subject</h3>
      </div>
      <Rule />
      <div className="ks-cols">
        <div className="stack gap-2">
          <p className="eyebrow">Body · IBM Plex Sans 15/1.55</p>
          <p>
            StudySwap lets students on one campus trade notes, previous-year question papers and summaries directly
            with each other. Every swap is a request, every rating feeds the uploader’s credibility.
          </p>
          <p className="muted">Secondary copy uses ink-2 for supporting detail beneath a primary line.</p>
        </div>
        <div className="stack gap-2">
          <p className="eyebrow">Mono · IBM Plex Mono, tabular</p>
          <p className="mono">
            material_id <span className="faint">=</span> 1042
          </p>
          <p className="mono">Swap_Request.status · Rating.score</p>
          <p className="num">4.35 · 0.41 ms · 18 / 400 rows</p>
        </div>
      </div>
    </Section>
  );
}

// ── 03 Buttons ────────────────────────────────────────────────
function ButtonsSection() {
  const [busy, setBusy] = useState(false);
  return (
    <Section id="buttons" n={3} title="Buttons">
      <Specimen label="Variants">
        <div className="row">
          <Button variant="primary" icon={Send}>
            Request swap
          </Button>
          <Button variant="secondary" icon={Upload}>
            Upload material
          </Button>
          <Button variant="ghost">View profile</Button>
          <Button variant="danger" icon={Trash2}>
            Delete upload
          </Button>
        </div>
      </Specimen>
      <Specimen label="Sizes">
        <div className="row">
          <Button variant="primary" size="sm">
            Accept
          </Button>
          <Button variant="primary">Accept</Button>
          <Button variant="primary" size="lg" iconRight={ArrowRight}>
            Get started
          </Button>
        </div>
      </Specimen>
      <Specimen label="States">
        <div className="row">
          <Button
            variant="primary"
            loading={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => setBusy(false), 1400);
            }}
          >
            {busy ? 'Sending…' : 'Send request'}
          </Button>
          <Button variant="primary" disabled>
            Request pending
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" icon={Settings} aria-label="Settings" />
          <Button variant="ghost" icon={Search} aria-label="Search" />
        </div>
      </Specimen>
    </Section>
  );
}

// ── 04 Form fields ────────────────────────────────────────────
function FieldsSection() {
  const [email, setEmail] = useState('aarav.mehta2023@vitstudent.ac.in');
  const [emailState, setEmailState] = useState('ok');
  const [message, setMessage] = useState('Hi! I have the Unit 4 transactions notes if you want to trade for this.');
  const [type, setType] = useState('Notes');
  const [title, setTitle] = useState('DBMS Unit 3 — Normalization, Handwritten');

  useEffect(() => {
    if (!email) {
      setEmailState('idle');
      return undefined;
    }
    setEmailState('checking');
    const t = setTimeout(() => {
      setEmailState(/@vitstudent\.ac\.in$/i.test(email) ? 'ok' : 'error');
    }, 500);
    return () => clearTimeout(t);
  }, [email]);

  const emailProps = {
    checking: { hint: 'Checking institutional domain…' },
    ok: { success: 'Institutional domain verified' },
    error: { error: 'Campus email required — StudySwap is institution-only' },
    idle: { hint: 'Use your @vitstudent.ac.in address' },
  }[emailState];

  return (
    <Section id="fields" n={4} title="Form fields" note="Labels sit above in small caps; the DDL column each field writes to is shown on the right.">
      <div className="ks-grid-2">
        <Input
          label="Institutional email"
          column="Student.email"
          type="email"
          icon={Mail}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...emailProps}
        />
        <Input label="Full name" column="Student.name" required defaultValue="Aarav Mehta" />
        <Input
          label="Title"
          column="Material.title"
          maxLength={150}
          showCount
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Select
          label="Material type"
          column="Material.material_type"
          options={MATERIAL_TYPES}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Select
          label="Subject"
          column="Material.subject_id"
          placeholder="Choose a subject"
          defaultValue=""
          options={['CSE', 'ECE', 'MECH'].map((d) => ({
            group: d,
            options: SUBJECTS.filter((s) => s.department === d).map((s) => ({ value: s.subject_id, label: `${s.subject_name} · ${s.code}` })),
          }))}
        />
        <Input label="Search" icon={Search} placeholder="Search titles, e.g. normalization" suffix={<kbd>/</kbd>} />
        <Input label="Semester" column="Student.semester" type="number" min={1} max={8} defaultValue={9} error="CHECK constraint violated: semester BETWEEN 1 AND 8" mono />
        <Input label="Student ID" column="Student.student_id" value="21BCE1042" readOnly mono hint="Primary key — assigned on insert, read-only" />
      </div>
      <Textarea
        label="Message to uploader"
        column="Swap_Request.message"
        maxLength={255}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        hint="VARCHAR(255)"
      />
    </Section>
  );
}

// ── 05 Controls ───────────────────────────────────────────────
function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) s++;
  return s;
}

function ControlsSection() {
  const [useIndexes, setUseIndexes] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [minCred, setMinCred] = useState(3.5);
  const [semester, setSemester] = useState(5);
  const [score, setScore] = useState(4);
  const [pw, setPw] = useState('Normal1sation');
  const [progress, setProgress] = useState(0.42);
  const [step, setStep] = useState(2);
  const strength = strengthOf(pw);
  const strengthWord = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthTone = ['danger', 'danger', 'warn', 'ok', 'ok'][strength];

  return (
    <Section id="controls" n={5} title="Controls">
      <div className="ks-grid-2">
        <Specimen label="Toggle">
          <div className="stack gap-3">
            <Toggle checked={useIndexes} onChange={setUseIndexes} label="Use indexes" />
            <Toggle checked={anonymous} onChange={setAnonymous} label="Upload anonymously" />
            <Toggle checked={false} onChange={() => {}} label="Exam mode (disabled)" disabled />
          </div>
        </Specimen>
        <Specimen label="Star rating — input · Rating.score">
          <div className="stack gap-3">
            <StarRating value={score} onChange={setScore} label="Your rating" />
            <StarRating value={4.35} count={23} />
            <StarRating value={2.8} count={4} size={12} />
          </div>
        </Specimen>
        <Specimen label="Slider">
          <div className="stack gap-5">
            <Slider label="Min. uploader credibility" min={0} max={5} step={0.5} value={minCred} onChange={setMinCred} format={(v) => v.toFixed(1)} />
            <Slider label="Semester" min={1} max={8} value={semester} onChange={setSemester} />
          </div>
        </Specimen>
        <Specimen label="Rules — progress, steps, strength">
          <div className="stack gap-5">
            <div className="stack gap-2">
              <ProgressRule value={progress} label="Uploading dbms-unit3.pdf" detail={`${(2.4 * progress).toFixed(1)} / 2.4 MB`} />
              <div className="row gap-2">
                <Button size="sm" onClick={() => setProgress((p) => Math.min(1, p + 0.2))}>
                  Advance
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setProgress(0)}>
                  Reset
                </Button>
              </div>
            </div>
            <div className="stack gap-2">
              <SegmentedRule segments={3} filled={step} label={`Step ${step} of 3`} detail={['File', 'Details', 'Review'][step - 1]} />
              <div className="row gap-2">
                <Button size="sm" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
                <Button size="sm" disabled={step === 3} onClick={() => setStep((s) => s + 1)}>
                  Next
                </Button>
              </div>
            </div>
            <div className="stack gap-2">
              <Input label="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              <SegmentedRule segments={4} filled={strength} tone={strengthTone} label="Strength" detail={strengthWord} ariaLabel={`Password strength: ${strengthWord}`} />
            </div>
          </div>
        </Specimen>
      </div>
    </Section>
  );
}

// ── 06 Badges & chips ─────────────────────────────────────────
function BadgesSection() {
  const [filters, setFilters] = useState([
    ['Subject', 'Database Systems'],
    ['Type', 'Notes'],
    ['Min rating', '4+'],
    ['Semester', '5'],
  ]);
  const [statuses, setStatuses] = useState(['Pending']);
  const toggle = (s) => setStatuses((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  return (
    <Section id="badges" n={6} title="Badges & chips" note="Badges are outlined, never filled. Status always pairs colour with an icon and a word.">
      <Specimen label="Material_type">
        <div className="row gap-2">
          {MATERIAL_TYPES.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
          <Badge tone="accent" icon={BookOpen}>
            Top contributor
          </Badge>
        </div>
      </Specimen>
      <Specimen label="Swap_Request.status">
        <div className="row gap-2">
          {REQUEST_STATUS.map((s) => (
            <Badge key={s} status={s} />
          ))}
        </div>
      </Specimen>
      <Specimen label="Active filters — removable">
        <div className="row gap-2">
          {filters.map(([k, v]) => (
            <Chip key={k} label={k} onRemove={() => setFilters((f) => f.filter(([kk]) => kk !== k))}>
              {v}
            </Chip>
          ))}
          {filters.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setFilters([])}>
              Clear all
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={Plus}
              onClick={() =>
                setFilters([
                  ['Subject', 'Database Systems'],
                  ['Type', 'Notes'],
                ])
              }
            >
              Restore filters
            </Button>
          )}
        </div>
      </Specimen>
      <Specimen label="Status filter — toggle">
        <div className="row gap-2">
          {REQUEST_STATUS.map((s) => (
            <Chip key={s} selected={statuses.includes(s)} onClick={() => toggle(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </Specimen>
      <Specimen label="Subject chips — spine colour only">
        <div className="row gap-2">
          {SUBJECTS.map((s) => (
            <Chip key={s.subject_id} subject={s.subject_id} code={s.code}>
              {s.subject_name}
            </Chip>
          ))}
        </div>
      </Specimen>
    </Section>
  );
}

// ── 07 Avatars & stats ────────────────────────────────────────
function PeopleSection() {
  return (
    <Section id="people" n={7} title="Avatars & stats">
      <Specimen label="Avatar — mono initials, no fills">
        <div className="row gap-4">
          <Avatar name="Aarav Mehta" size="xs" />
          <Avatar name="Diya Raghavan" size="sm" />
          <Avatar name="Kabir Sethi" />
          <Avatar name="Ananya Iyer" size="lg" />
          <Avatar name="Rohan Kulkarni" size="xl" />
          <div className="row gap-2 nowrap">
            <Avatar name="Meera Nair" size="sm" decorative />
            <div>
              <div style={{ fontWeight: 600 }}>Meera Nair</div>
              <div className="faint small">ECE · Semester 5</div>
            </div>
          </div>
        </div>
      </Specimen>
      <Specimen label="Stat row — separated by rules, not boxes">
        <StatRow>
          <Stat label="Uploads" value={5} delta={2} hint="this month" />
          <Stat label="Swaps completed" value={12} hint="since Mar 2026" />
          <Stat label="Credibility" value="4.21" unit="/ 5" hint="AVG over 23 ratings" />
          <Stat label="Pending requests" value={3} hint="awaiting your response" />
        </StatRow>
      </Specimen>
    </Section>
  );
}

// ── 08 Tabs ───────────────────────────────────────────────────
function TabsSection() {
  const [tab, setTab] = useState('incoming');
  const copy = {
    incoming: 'Three students have asked for your uploads. Accept to share the file link; reject with an optional reason.',
    outgoing: 'Two of your requests were accepted. Mark each one received, then rate it to complete the swap.',
    history: 'Completed and rejected requests, newest first, with their response_date.',
  };
  return (
    <Section id="tabs" n={8} title="Tabs" note="Arrow keys move between tabs; Home and End jump to the ends.">
      <Tabs
        label="Swap requests"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'incoming', label: 'Incoming', count: 3 },
          { id: 'outgoing', label: 'Outgoing', count: 2 },
          { id: 'history', label: 'History', count: 14 },
        ]}
      >
        <p className="muted">{copy[tab]}</p>
      </Tabs>
    </Section>
  );
}

// ── 09 Table & pagination ─────────────────────────────────────
function TableSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emptyMode, setEmptyMode] = useState(false);
  const [page, setPage] = useState(3);

  const columns = [
    { key: 'material_id', header: 'material_id', type: 'id', sortable: true, width: 110 },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (m) => (
        <div className="stack gap-1" style={{ minWidth: 220 }}>
          <span style={{ fontWeight: 500 }}>{m.title}</span>
          <span className="faint xsmall">{subjectOf(m.subject_id).subject_name}</span>
        </div>
      ),
    },
    { key: 'material_type', header: 'Type', sortable: true, render: (m) => <Badge>{m.material_type}</Badge> },
    { key: 'uploader', header: 'Uploaded by', sortable: true },
    { key: 'avg', header: 'Avg score', type: 'num', sortable: true, render: (m) => m.avg.toFixed(2) },
    { key: 'ratings', header: 'Ratings', type: 'num', sortable: true },
    {
      key: 'upload_date',
      header: 'Uploaded',
      type: 'num',
      sortable: true,
      render: (m) => (
        <Tooltip content={absoluteDate(m.upload_date)}>
          <time dateTime={m.upload_date} tabIndex={0}>
            {relativeDate(m.upload_date)}
          </time>
        </Tooltip>
      ),
    },
  ];

  return (
    <Section id="table" n={9} title="Table & pagination" note="Sortable headers, sticky header inside a scrolling region, mono IDs and right-aligned numerals. Click a row.">
      <div className="row gap-4">
        <Toggle checked={loading} onChange={setLoading} label="Loading state" />
        <Toggle checked={emptyMode} onChange={setEmptyMode} label="Empty result" />
      </div>
      <Table
        columns={columns}
        rows={emptyMode ? [] : MATERIALS}
        rowKey="material_id"
        loading={loading}
        maxHeight={340}
        defaultSort={{ key: 'avg', dir: 'desc' }}
        onRowClick={(m) => toast({ title: `Opening material_id ${m.material_id}`, description: m.title })}
        empty="No Material rows match subject_id = 1 AND material_type = 'Assignment'."
      />
      <Pagination page={page} pageSize={12} total={386} onChange={setPage} noun="materials" />
    </Section>
  );
}

// ── 10 Overlays ───────────────────────────────────────────────
function OverlaysSection() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [offer, setOffer] = useState('');
  const [sending, setSending] = useState(false);
  const material = MATERIALS[0];

  function send() {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setOpen(false);
      setMessage('');
      toast({
        tone: 'ok',
        title: 'Swap request sent',
        description: (
          <>
            <code>request_id 318</code> · status <code>'Pending'</code>
          </>
        ),
        action: { label: 'Undo', onClick: () => toast({ title: 'Request withdrawn', description: 'Swap_Request 318 deleted.' }) },
      });
    }, 700);
  }

  return (
    <Section id="overlays" n={10} title="Modal, toast, dropdown, tooltip">
      <Specimen label="Modal — focus trapped, Esc closes, focus returns">
        <div className="row">
          <Button variant="primary" icon={Send} onClick={() => setOpen(true)}>
            Request swap
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
            Delete material
          </Button>
        </div>
      </Specimen>

      <Specimen label="Toast — bottom-left, 4s, pauses on hover">
        <div className="row">
          <Button onClick={() => toast({ title: 'Material uploaded', description: 'Inserted as material_id 1151.', tone: 'ok' })}>Success</Button>
          <Button onClick={() => toast({ title: 'Request accepted', description: 'Diya Raghavan can now access the file.', action: { label: 'Undo', onClick: () => {} } })}>
            Info with undo
          </Button>
          <Button onClick={() => toast({ tone: 'warn', title: 'Mid-sem in 6 days', description: 'Exam Mode re-sorts Browse by most requested this week.' })}>Warning</Button>
          <Button
            onClick={() =>
              toast({
                tone: 'danger',
                title: 'CHECK constraint violated: material_type',
                description: (
                  <>
                    <code>'Essay'</code> is not one of Notes, PYQ, Assignment, Summary.
                  </>
                ),
              })
            }
          >
            Constraint error
          </Button>
        </div>
      </Specimen>

      <div className="ks-grid-2">
        <Specimen label="Dropdown — arrow keys, Esc">
          <Dropdown
            label="Account menu"
            heading="Signed in as 21BCE1042"
            trigger={(p) => (
              <Button {...p} variant="secondary" iconRight={ChevronDown}>
                <Avatar name="Aarav Mehta" size="xs" decorative /> Aarav Mehta
              </Button>
            )}
            items={[
              { label: 'Profile', icon: User, hint: 'g p', onSelect: () => toast('Profile') },
              { label: 'My uploads', icon: FileText, onSelect: () => toast('My uploads') },
              { label: 'DB Lab', icon: Database, onSelect: () => toast('DB Lab') },
              { separator: true },
              { label: 'Sign out', icon: LogOut, danger: true, onSelect: () => toast('Signed out') },
            ]}
          />
        </Specimen>
        <Specimen label="Tooltip — hover or focus">
          <div className="stack gap-3">
            <Tooltip content="Uploaded 12 Sep 2026, 10:42 IST">
              <time dateTime="2026-09-12" tabIndex={0} className="small" style={{ width: 'fit-content' }}>
                1 wk ago
              </time>
            </Tooltip>
            <Tooltip content="DSP End-Sem PYQ 2024 — Z-Transform, FIR Filter Design by Windowing, and IIR Bilinear Transformation with Worked Solutions">
              <h4 className="clamp-2" tabIndex={0} style={{ maxWidth: 280 }}>
                DSP End-Sem PYQ 2024 — Z-Transform, FIR Filter Design by Windowing, and IIR Bilinear Transformation with Worked Solutions
              </h4>
            </Tooltip>
            <Tooltip content={<span className="mono">AVG(score) over 23 ratings = 4.35</span>}>
              <span tabIndex={0} className="num" style={{ width: 'fit-content', fontSize: 'var(--fs-lg)' }}>
                4.35
              </span>
            </Tooltip>
          </div>
        </Specimen>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request swap"
        description="The uploader sees your message and chooses to accept or reject."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={Send} loading={sending} onClick={send}>
              Send request
            </Button>
          </>
        }
      >
        <div className="stack gap-4">
          <div className={`ks-mini-card sub-${material.subject_id}`}>
            <div className="row between">
              <Badge>{material.material_type}</Badge>
              <span className="mono xsmall faint">material_id {material.material_id}</span>
            </div>
            <p className="serif" style={{ fontSize: 'var(--fs-md)' }}>
              {material.title}
            </p>
            <p className="small muted">
              {subjectOf(material.subject_id).subject_name} · <span className="mono">{subjectOf(material.subject_id).code}</span>
            </p>
          </div>
          <Textarea
            label="Message"
            column="Swap_Request.message"
            maxLength={255}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say which unit you need and what you can offer back."
          />
          <Select
            label="Offer in return (optional)"
            placeholder="Nothing — one-way request"
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            options={MATERIALS.filter((m) => m.uploader === 'Diya Raghavan' || m.uploader === 'Meera Nair').map((m) => ({
              value: m.material_id,
              label: m.title,
            }))}
          />
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Delete this material?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                setConfirmOpen(false);
                toast({
                  tone: 'danger',
                  title: 'FOREIGN KEY violation: Rating.material_id',
                  description: 'material_id 1042 is still referenced by 18 Rating rows and 2 Swap_Request rows.',
                });
              }}
            >
              Delete anyway
            </Button>
          </>
        }
      >
        <p className="muted">
          <span className="mono">material_id 1042</span> is referenced by <span className="num">18</span> rows in{' '}
          <span className="mono">Rating</span> and <span className="num">2</span> rows in <span className="mono">Swap_Request</span>. Deleting it
          would orphan those rows.
        </p>
      </Modal>
    </Section>
  );
}

// ── 11 Skeleton & empty ───────────────────────────────────────
function LoadingSection() {
  return (
    <Section id="loading" n={11} title="Skeleton & empty states">
      <Specimen label="Skeleton — material card shape, opacity pulse">
        <Loading label="Loading materials">
          <div className="ks-grid-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ks-skel-card">
                <div className="row between">
                  <Skeleton width={56} height={18} />
                  <Skeleton width={48} height={12} />
                </div>
                <Skeleton text lines={2} />
                <Skeleton width="55%" height={12} />
                <hr className="rule" />
                <div className="row gap-2 nowrap">
                  <Skeleton circle size={24} />
                  <Skeleton width="45%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </Loading>
      </Specimen>
      <div className="ks-grid-2">
        <EmptyState
          icon={Inbox}
          title="No incoming requests yet"
          text="When another student asks for one of your uploads, it lands here for you to accept or reject."
          action={
            <Button variant="primary" icon={Upload}>
              Upload a material
            </Button>
          }
        />
        <EmptyState
          icon={Search}
          title="Nothing matches “Assignment” in Discrete Mathematics"
          text="Material type is the narrowest filter here — 14 materials match without it."
          action={
            <>
              <Button variant="secondary">Drop the type filter</Button>
              <Button variant="ghost">Clear all</Button>
            </>
          }
        />
      </div>
    </Section>
  );
}

// ── 12 Code ───────────────────────────────────────────────────
function CodeSection() {
  return (
    <Section id="code" n={12} title="Code block" note="SQL highlighting for the Query Inspector and the DDL tab of the DB Lab.">
      <CodeBlock title="Browse query" code={SAMPLE_SQL} numbered />
      <CodeBlock
        title="DDL · Material"
        code={`CREATE TABLE Material (
  material_id   INT PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  subject_id    INT NOT NULL REFERENCES Subject(subject_id),
  uploaded_by   INT NOT NULL REFERENCES Student(student_id),
  material_type VARCHAR(20) CHECK (material_type IN ('Notes','PYQ','Assignment','Summary')),
  upload_date   DATE DEFAULT CURRENT_DATE,
  file_link     VARCHAR(255) NOT NULL
);`}
      />
    </Section>
  );
}
