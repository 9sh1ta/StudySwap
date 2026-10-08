import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, LogIn, Mail, UserPlus } from 'lucide-react';
import { Avatar, Button, Input, Skeleton, Toggle } from '../components/ui';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import ErrorNote from '../components/domain/ErrorNote.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { auth as authApi } from '../api/client.js';
import { departmentName } from '../data/schema.js';
import useAsync from '../hooks/useAsync.js';
import './pages.css';

export default function Login() {
  const { login, loginAs } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'form' | student_id
  const demo = useAsync(() => authApi.demoAccounts(), []);

  async function submit(e) {
    e.preventDefault();
    setBusy('form');
    setError(null);
    try {
      await login(email, password, { remember });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err);
      setBusy(null);
    }
  }

  async function quick(id) {
    setBusy(id);
    setError(null);
    try {
      await loginAs(id);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err);
      setBusy(null);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      lede="Use your institutional email, or pick a demo account below."
      aside={
        <div className="stack gap-3">
          <p className="serif" style={{ fontSize: 'var(--fs-xl)', lineHeight: 1.2 }}>
            Every request you send is a row in <span className="mono" style={{ fontSize: '.8em' }}>Swap_Request</span>.
          </p>
          <p className="muted">Sign in to browse materials from your semester, answer requests for your uploads, and see your credibility update as ratings arrive.</p>
        </div>
      }
    >
      <section className="demo-panel" aria-labelledby="demo-h">
        <div className="row between">
          <h2 id="demo-h" className="eyebrow">
            1 · Use a demo account — one click, no typing
          </h2>
        </div>
        <ul className="demo-list">
          {demo.loading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="demo-item">
                <Skeleton circle size={32} />
                <span className="grow stack gap-1">
                  <Skeleton width="50%" height={12} />
                  <Skeleton width="80%" height={10} />
                </span>
              </li>
            ))}
          {demo.data?.map((a) => (
            <li key={a.student_id}>
              <button type="button" className="demo-item" onClick={() => quick(a.student_id)} disabled={busy !== null} aria-busy={busy === a.student_id || undefined}>
                <Avatar name={a.name} decorative />
                <span className="grow stack gap-1" style={{ minWidth: 0 }}>
                  <span className="row gap-2">
                    <span className="demo-item__name">{a.name}</span>
                    <span className="eyebrow">{a.label}</span>
                  </span>
                  <span className="xsmall faint">
                    {departmentName(a.department)} · Sem {a.semester} · {a.note}
                  </span>
                </span>
                {busy === a.student_id ? <span className="btn__spinner" aria-hidden="true" /> : <ArrowRight aria-hidden="true" className="demo-item__go" />}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="rule-labelled">
        <span className="eyebrow">2 · or sign in with your email</span>
      </div>

      <form className="stack gap-4" onSubmit={submit} noValidate>
        <Input label="Institutional email" type="email" icon={Mail} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="firstname.lastname24@vitstudent.ac.in" required />
        <Input
          label="Password"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`Demo accounts use “${authApi.demoPassword}”.`}
          required
        />
        <Toggle checked={remember} onChange={setRemember} label="Remember me on this device" showState={false} />
        <ErrorNote error={error} />
        <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={busy === 'form'} disabled={busy !== null && busy !== 'form'} block>
          Sign in
        </Button>
      </form>
      <div className="rule-labelled">
        <span className="eyebrow">3 · or create your own account</span>
      </div>

      <section className="signup-panel">
        <div className="stack gap-1">
          <p style={{ fontWeight: 600 }}>New to StudySwap?</p>
          <p className="small muted">
            Register with your campus email and start with an empty profile — no uploads, no credibility, nothing waiting on you.
          </p>
        </div>
        <Button as={Link} to="/register" variant="secondary" icon={UserPlus} iconRight={ArrowRight}>
          Create an account
        </Button>
      </section>
    </AuthLayout>
  );
}
