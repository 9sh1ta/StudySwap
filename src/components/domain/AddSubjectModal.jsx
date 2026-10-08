import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input, Modal, Select } from '../ui';
import ErrorNote from './ErrorNote.jsx';
import { subjects as subjectsApi } from '../../api/client.js';
import { DEPARTMENTS, LIMITS, SEMESTER_RANGE } from '../../data/schema.js';

const SEMESTERS = Array.from({ length: SEMESTER_RANGE.max - SEMESTER_RANGE.min + 1 }, (_, i) => SEMESTER_RANGE.min + i);

// Adds a row to Subject so a material can be filed under a subject the
// catalogue does not have yet. Material.subject_id needs a Subject row to
// point at — this is the foreign key being satisfied, in the open.
export default function AddSubjectModal({ open, defaultName = '', department, semester, onClose, onCreated }) {
  const [form, setForm] = useState({ subject_name: '', department: '', semester: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ subject_name: defaultName, department: department || '', semester: semester ? String(semester) : '' });
      setError(null);
    }
  }, [open, defaultName, department, semester]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await subjectsApi.create(form);
      onCreated(created);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a subject"
      description="It joins the catalogue for everyone, so file it the way your department names it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Plus} loading={busy} onClick={submit}>
            Add subject
          </Button>
        </>
      }
    >
      <form className="stack gap-4" onSubmit={submit}>
        <Input
          label="Subject name"
          column="Subject.subject_name"
          required
          maxLength={LIMITS['Subject.subject_name']}
          showCount
          value={form.subject_name}
          onChange={set('subject_name')}
          placeholder="e.g. Blockchain Technology"
        />
        <div className="grid-2">
          <Select label="Department" column="Subject.department" required placeholder="Choose…" value={form.department} onChange={set('department')} options={DEPARTMENTS.map((d) => ({ value: d.code, label: d.name }))} />
          <Select label="Semester" column="Subject.semester" required placeholder="Choose…" value={form.semester} onChange={set('semester')} options={SEMESTERS.map((n) => ({ value: String(n), label: `Semester ${n}` }))} />
        </div>
        <p className="xsmall faint">
          Inserts one row into <span className="mono">Subject</span>. Your material then points at it through{' '}
          <span className="mono">Material.subject_id</span>.
        </p>
        <ErrorNote error={error} />
      </form>
    </Modal>
  );
}
