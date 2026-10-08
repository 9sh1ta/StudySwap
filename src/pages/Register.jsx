import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, UserPlus } from 'lucide-react';
import { Button, Input, SegmentedRule, Select } from '../components/ui';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import ErrorNote from '../components/domain/ErrorNote.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { auth as authApi } from '../api/client.js';
import { CAMPUS_DOMAIN, DEPARTMENTS, LIMITS, SEMESTER_RANGE } from '../data/schema.js';
import useDebounce from '../hooks/useDebounce.js';
import './pages.css';

const SEMESTERS = Array.from({ length: SEMESTER_RANGE.max - SEMESTER_RANGE.min + 1 }, (_, i) => SEMESTER_RANGE.min + i);

function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) s++;
  return pw.length < 8 ? Math.min(s, 1) : s;
}
const STRENGTH = [
  ['Too short', 'danger'],
  ['Weak', 'danger'],
  ['Fair', 'warn'],
  ['Good', 'ok'],
  ['Strong', 'ok'],
];

// Fields map 1:1 to Student columns. Validation mirrors the DDL:
// name NOT NULL, email UNIQUE NOT NULL + campus-domain CHECK,
// semester CHECK BETWEEN 1 AND 8.
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', department: '', semester: '', password: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [emailCheck, setEmailCheck] = useState({ email: '', result: 'idle' }); // result: ok | domain | taken
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const debouncedEmail = useDebounce(form.email.trim().toLowerCase(), 400);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  // Live checks: domain (CHECK) first, then uniqueness against the table.
  useEffect(() => {
    if (!debouncedEmail) return undefined;
    if (!/^[^@\s]+@/.test(debouncedEmail) || !debouncedEmail.endsWith(`@${CAMPUS_DOMAIN}`)) {
      setEmailCheck({ email: debouncedEmail, result: 'domain' });
      return undefined;
    }
    let live = true;
    authApi.emailTaken(debouncedEmail).then((taken) => live && setEmailCheck({ email: debouncedEmail, result: taken ? 'taken' : 'ok' }));
    return () => {
      live = false;
    };
  }, [debouncedEmail]);
  const typedEmail = form.email.trim().toLowerCase();
  const emailState = !typedEmail ? 'idle' : emailCheck.email !== typedEmail ? 'checking' : emailCheck.result;

  const strength = strengthOf(form.password);
  const errors = {
    name: !form.name.trim() ? 'Name is required (NOT NULL).' : null,
    email:
      emailState === 'domain'
        ? 'Campus email required — StudySwap is institution-only'
        : emailState === 'taken'
          ? 'This email is already registered (UNIQUE).'
          : !form.email.trim()
            ? 'Email is required (NOT NULL).'
            : null,
    department: !form.department ? 'Choose your department.' : null,
    semester: !form.semester ? 'Choose your semester.' : null,
    password: form.password.length < 8 ? 'At least 8 characters.' : null,
    confirm: form.confirm !== form.password ? 'Passwords do not match.' : null,
  };
  const show = (k) => fieldErrors[k] || (touched[k] ? errors[k] : null);
  const valid = Object.values(errors).every((e) => !e) && emailState === 'ok';

  async function submit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, department: true, semester: true, password: true, confirm: true });
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await register({ name: form.name, email: form.email, department: form.department, semester: Number(form.semester), password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Map a constraint error back onto its field when we can.
      if (err.column && form[err.column] !== undefined) setFieldErrors({ [err.column]: `${err.message}. ${err.detail || ''}` });
      else setError(err);
      setBusy(false);
    }
  }

  const emailProps = {
    idle: { hint: `Use your @${CAMPUS_DOMAIN} address.` },
    checking: { hint: 'Checking institutional domain…' },
    ok: { success: 'Institutional email — available' },
    domain: {},
    taken: {},
  }[emailState];

  return (
    <AuthLayout
      title="Create your account"
      lede="Each field below is a column in the Student table."
      aside={
        <div className="stack gap-3">
          <p className="serif" style={{ fontSize: 'var(--fs-xl)', lineHeight: 1.2 }}>
            Your credibility starts empty and is earned one rating at a time.
          </p>
          <p className="muted">
            It is never typed in or stored — the database averages the scores on everything you upload each time it is read.
          </p>
        </div>
      }
    >
      <form className="stack gap-4" onSubmit={submit} noValidate>
        <Input label="Full name" column="Student.name" required maxLength={LIMITS['Student.name']} value={form.name} onChange={set('name')} onBlur={blur('name')} error={show('name')} autoComplete="name" />
        <Input
          label="Institutional email"
          column="Student.email"
          type="email"
          icon={Mail}
          required
          maxLength={LIMITS['Student.email']}
          value={form.email}
          onChange={set('email')}
          onBlur={blur('email')}
          autoComplete="email"
          placeholder={`firstname.lastname@${CAMPUS_DOMAIN}`}
          error={show('email') || (emailState === 'domain' || emailState === 'taken' ? errors.email : null)}
          {...emailProps}
        />
        <div className="grid-2">
          <Select
            label="Department"
            column="Student.department"
            required
            placeholder="Choose…"
            value={form.department}
            onChange={set('department')}
            onBlur={blur('department')}
            error={show('department')}
            options={DEPARTMENTS.map((d) => ({ value: d.code, label: d.name }))}
          />
          <Select
            label="Semester"
            column="Student.semester"
            required
            placeholder="Choose…"
            value={form.semester}
            onChange={set('semester')}
            onBlur={blur('semester')}
            error={show('semester')}
            options={SEMESTERS.map((s) => ({ value: String(s), label: `Semester ${s}` }))}
          />
        </div>
        <div className="stack gap-2">
          <Input label="Password" type="password" icon={Lock} required value={form.password} onChange={set('password')} onBlur={blur('password')} error={show('password')} autoComplete="new-password" />
          <SegmentedRule segments={4} filled={strength} tone={STRENGTH[strength][1]} label="Strength" detail={form.password ? STRENGTH[strength][0] : ''} ariaLabel={`Password strength: ${STRENGTH[strength][0]}`} />
        </div>
        <Input label="Confirm password" type="password" icon={Lock} required value={form.confirm} onChange={set('confirm')} onBlur={blur('confirm')} error={show('confirm')} autoComplete="new-password" />
        <ErrorNote error={error} />
        <Button type="submit" variant="primary" size="lg" icon={UserPlus} loading={busy} block>
          Create account
        </Button>
        <p className="xsmall faint">
          Passwords live in a prototype-only credential store, not in the Student table. The real backend keeps hashes in its own auth table.
        </p>
      </form>
      <p className="small muted">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
