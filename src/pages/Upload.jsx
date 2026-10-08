import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Copy, FileText, FileUp, Plus, RotateCcw } from 'lucide-react';
import { Button, Input, ProgressRule, SegmentedRule, Table, Textarea, Toggle } from '../components/ui';
import PageHeader from '../components/layout/PageHeader.jsx';
import SubjectPicker from '../components/domain/SubjectPicker.jsx';
import AddSubjectModal from '../components/domain/AddSubjectModal.jsx';
import { PageSheet } from '../components/domain/MaterialPreview.jsx';
import ErrorNote from '../components/domain/ErrorNote.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { materials, subjects as subjectsApi } from '../api/client.js';
import { LIMITS, MATERIAL_TYPES } from '../data/schema.js';
import useAsync from '../hooks/useAsync.js';
import useDebounce from '../hooks/useDebounce.js';
import { fileSize } from '../lib/format.js';
import './pages.css';

const STEPS = ['File', 'Details', 'Review'];
const TYPE_HINT = {
  Notes: 'Lecture or self-made notes for a unit',
  PYQ: 'A previous-year question paper, solved or not',
  Assignment: 'Assignment questions with your answers',
  Summary: 'A cheat sheet, formula sheet or one-pager',
};
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx';
const MAX_BYTES = 25 * 1024 * 1024;

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time, like CURRENT_DATE

// Three steps: File → Details → Review. Review renders the exact Material
// row that will be inserted, column by column, before the INSERT runs.
export default function Upload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const subjects = useAsync(() => subjectsApi.list(), []);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null); // { name, size, pages }
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [form, setForm] = useState({ title: '', subject_id: '', material_type: '', tags: [], description: '', anonymous: false });
  const [tagInput, setTagInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addSubject, setAddSubject] = useState(false);
  const [dupes, setDupes] = useState([]);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  function accept(f) {
    setFileError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setFileError(`${f.name} is ${fileSize(f.size)} — the limit is 25 MB.`);
      return;
    }
    // Page count is estimated from size; the prototype never reads the file.
    const pages = Math.max(1, Math.round(f.size / (180 * 1024)));
    setFile({ name: f.name, size: f.size, pages });
    if (!form.title) {
      const guess = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      setForm((x) => ({ ...x, title: guess.slice(0, LIMITS['Material.title']) }));
    }
    setProgress(0);
    clearInterval(timer.current);
    // Keep the updater pure (StrictMode runs it twice): pick the step outside it.
    timer.current = setInterval(() => {
      const step = 0.08 + Math.random() * 0.12;
      setProgress((p) => Math.min(1, p + step));
    }, 120);
  }

  useEffect(() => {
    if (progress >= 1) clearInterval(timer.current);
  }, [progress]);

  // Duplicate detection (§7.7): fuzzy-match the title against titles in the
  // same subject. Above 0.7 similarity we show what already exists.
  const debouncedTitle = useDebounce(form.title.trim(), 400);
  useEffect(() => {
    if (!debouncedTitle || debouncedTitle.length < 8 || !form.subject_id) return setDupes([]);
    let live = true;
    materials.similar(debouncedTitle, form.subject_id, { threshold: 0.7, limit: 3 }).then((r) => live && setDupes(r), () => {});
    return () => {
      live = false;
    };
  }, [debouncedTitle, form.subject_id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (t && !form.tags.includes(t) && form.tags.length < 6) setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };

  // Client-side checks mirror the DDL; the database re-checks on INSERT.
  const errors = {
    title: !form.title.trim() ? 'Title is required (NOT NULL).' : form.title.length > LIMITS['Material.title'] ? `At most ${LIMITS['Material.title']} characters (VARCHAR(150)).` : null,
    subject_id: !form.subject_id ? 'Choose a subject (NOT NULL, FK → Subject).' : null,
    material_type: !form.material_type ? `Choose one of ${MATERIAL_TYPES.join(', ')} (CHECK).` : null,
  };
  const detailsValid = !errors.title && !errors.subject_id && !errors.material_type;
  const uploaded = file && progress >= 1;
  const subject = subjects.data?.find((s) => s.subject_id === Number(form.subject_id));
  const placeholderLink = useMemo(() => `https://files.studyswap.in/m/{material_id}.${(file?.name.split('.').pop() || 'pdf').toLowerCase()}`, [file]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await materials.create({
        title: form.title,
        subject_id: form.subject_id,
        uploaded_by: user.student_id,
        material_type: form.material_type,
        file_link: placeholderLink,
        _ui: {
          pageCount: file.pages,
          fileSize: file.size,
          tags: form.tags,
          description: form.description.trim(),
          syllabus_year: new Date().getFullYear(),
          anonymous: form.anonymous,
        },
      });
      toast({ tone: 'ok', title: `Inserted material_id ${created.material_id}`, description: `“${created.title}” is now listed under ${created.subject.subject_name}.` });
      navigate(`/material/${created.material_id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const row = [
    ['material_id', <span key="id" className="faint">DEFAULT — assigned on INSERT</span>],
    ['title', `'${form.title}'`],
    ['subject_id', <span key="s">{form.subject_id} <span className="faint">-- {subject?.subject_name}</span></span>],
    ['uploaded_by', <span key="u">{user.student_id} <span className="faint">-- {user.name}</span></span>],
    ['material_type', `'${form.material_type}'`],
    ['upload_date', <span key="d">CURRENT_DATE <span className="faint">-- {today()}</span></span>],
    ['file_link', `'${placeholderLink}'`],
  ].map(([column, value]) => ({ column, value }));

  return (
    <div className="upload">
      <PageHeader eyebrow="INSERT INTO Material" title="Upload a material" description="Three steps. You will see the exact row before it is inserted." />

      <div className="upload__progress">
        <SegmentedRule segments={3} filled={step + 1} label={`Step ${step + 1} of 3`} detail={STEPS[step]} ariaLabel={`Step ${step + 1} of 3: ${STEPS[step]}`} />
        <ol className="upload__steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : i === step ? 'current' : ''}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span> {s}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <section className="upload__panel stack gap-5" aria-labelledby="file-h">
          <h2 id="file-h" className="section__title">
            Choose a file
          </h2>
          <div
            className={`dropzone ruled-paper${drag ? ' dropzone--over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              accept(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="dropzone__inner">
              <FileUp aria-hidden="true" className="dropzone__icon" />
              <p className="serif" style={{ fontSize: 'var(--fs-lg)' }}>
                Drop a PDF, image or document here
              </p>
              <p className="small muted">PDF, PNG, JPG or DOCX · up to 25 MB</p>
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                Choose file
              </Button>
              <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => accept(e.target.files?.[0])} />
            </div>
          </div>
          {fileError && <ErrorNote error={{ message: 'File rejected', detail: fileError }} />}
          {file && (
            <div className="file-row">
              <FileText aria-hidden="true" />
              <div className="grow stack gap-2" style={{ minWidth: 0 }}>
                <div className="row between">
                  <span className="truncate" style={{ fontWeight: 500 }}>
                    {file.name}
                  </span>
                  <span className="num small muted">
                    {fileSize(file.size)} · ~{file.pages} page{file.pages === 1 ? '' : 's'}
                  </span>
                </div>
                <ProgressRule value={progress} label={uploaded ? 'Uploaded — stored as a placeholder file_link' : 'Uploading…'} detail={uploaded ? 'done' : `${Math.round(progress * 100)}%`} />
              </div>
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
            </div>
          )}
          <div className="upload__nav">
            <span />
            <Button variant="primary" iconRight={ArrowRight} disabled={!uploaded} onClick={() => setStep(1)}>
              Continue to details
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="upload__panel stack gap-5" aria-labelledby="details-h">
          <h2 id="details-h" className="section__title">
            Describe it
          </h2>
          <Input
            label="Title"
            column="Material.title"
            required
            maxLength={LIMITS['Material.title']}
            showCount
            value={form.title}
            onChange={set('title')}
            error={touched ? errors.title : null}
            placeholder="e.g. DBMS Unit 3 — Normalization, Handwritten"
          />
          {dupes.length > 0 && (
            <div className="dupes" role="status">
              <Copy aria-hidden="true" />
              <div className="stack gap-2">
                <p>
                  <strong>
                    {dupes.length} similar material{dupes.length === 1 ? '' : 's'} already exist{dupes.length === 1 ? 's' : ''} for this subject.
                  </strong>{' '}
                  Rating one of these may help more people than another copy.
                </p>
                <ul className="dupes__list">
                  {dupes.map((d) => (
                    <li key={d.material_id}>
                      <Link to={`/material/${d.material_id}`} target="_blank" rel="noreferrer">
                        {d.title}
                      </Link>
                      <span className="mono xsmall faint">
                        {Math.round(d.score * 100)}% similar · #{d.material_id}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="xsmall faint">Similarity is a bigram Dice coefficient over the titles, run against this subject only — an index scan, not the whole table.</p>
              </div>
            </div>
          )}

          <div className="stack gap-2">
            <span className="field__label">
              <span>
                Subject<span className="field__req">*</span>
              </span>
              <span className="field__col">Material.subject_id</span>
            </span>
            {subjects.data ? (
              <SubjectPicker subjects={subjects.data} value={form.subject_id} onChange={(v) => setForm((f) => ({ ...f, subject_id: v }))} error={touched ? errors.subject_id : null} />
            ) : (
              <div className="skeleton" style={{ height: 220 }} />
            )}
            <div className="row between">
              <p className="xsmall faint">Can’t find your subject? Add it and it joins the catalogue.</p>
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setAddSubject(true)}>
                Add a subject
              </Button>
            </div>
          </div>
          <fieldset className="typecards">
            <legend className="field__label">
              <span>
                Material type<span className="field__req">*</span>
              </span>
              <span className="field__col">Material.material_type</span>
            </legend>
            <div className="typecards__grid">
              {MATERIAL_TYPES.map((t) => (
                <label key={t} className={`typecard${form.material_type === t ? ' typecard--on' : ''}`}>
                  <input type="radio" name="material_type" value={t} checked={form.material_type === t} onChange={set('material_type')} />
                  <span className="typecard__name">{t}</span>
                  <span className="xsmall muted">{TYPE_HINT[t]}</span>
                </label>
              ))}
            </div>
            {touched && errors.material_type && <p className="field__msg field__msg--error">{errors.material_type}</p>}
          </fieldset>
          <div className="stack gap-2">
            <Input
              label="Tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="Type a tag and press Enter — e.g. bcnf, solved"
              hint="Up to 6. Prototype-only: kept outside the Material columns."
            />
            {form.tags.length > 0 && (
              <ul className="tags">
                {form.tags.map((t) => (
                  <li key={t}>
                    <span className="chip">
                      #{t}
                      <button type="button" className="chip__remove" aria-label={`Remove tag ${t}`} onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))}>
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Textarea label="Description" rows={3} maxLength={400} value={form.description} onChange={set('description')} placeholder="Which units does it cover? Handwritten or typed? Solutions included?" />
          <Toggle checked={form.anonymous} onChange={(v) => setForm((f) => ({ ...f, anonymous: v }))} label="Hide my name on this upload" showState={false} />
          <p className="xsmall faint" style={{ marginTop: 'calc(-1 * var(--sp-3))' }}>
            uploaded_by is still stored — the foreign key stays intact. Only the UI hides it.
          </p>
          <div className="upload__nav">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              variant="primary"
              iconRight={ArrowRight}
              onClick={() => {
                setTouched(true);
                if (detailsValid) setStep(2);
              }}
            >
              Review the row
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="upload__panel stack gap-5" aria-labelledby="review-h">
          <div className="review">
            <div className="stack gap-3">
              <h2 id="review-h" className="section__title">
                The row to be inserted
              </h2>
              <p className="small muted">
                These seven values are all that <span className="mono">Material</span> stores. The subject name, your name and every rating are reached by joins — never copied in.
              </p>
              <Table
                caption={<span className="mono small">INSERT INTO Material VALUES (…)</span>}
                rowKey="column"
                rows={row}
                columns={[
                  { key: 'column', header: 'Column', type: 'mono', width: 150 },
                  { key: 'value', header: 'Value', type: 'mono' },
                ]}
              />
              <ErrorNote error={error} />
            </div>
            <div className="review__thumb">
              <p className="eyebrow">Generated thumbnail</p>
              <PageSheet materialId={9999} page={1} type={form.material_type} title={form.title} />
            </div>
          </div>
          <div className="upload__nav">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(1)} disabled={busy}>
              Edit details
            </Button>
            <Button variant="primary" icon={Check} loading={busy} onClick={submit}>
              Insert material
            </Button>
          </div>
        </section>
      )}

      <AddSubjectModal
        open={addSubject}
        department={user.department}
        semester={user.semester}
        onClose={() => setAddSubject(false)}
        onCreated={(created) => {
          setAddSubject(false);
          setForm((f) => ({ ...f, subject_id: created.subject_id }));
          subjects.reload({ quiet: true });
          toast({ tone: 'ok', title: `Added subject_id ${created.subject_id}`, description: `“${created.subject_name}” is now in the catalogue and selected.` });
        }}
      />

      <p className="small faint upload__foot">
        Changed your mind? <Link to="/browse">Browse instead</Link>.
      </p>
    </div>
  );
}
