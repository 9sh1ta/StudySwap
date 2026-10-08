import { Link } from 'react-router-dom';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { Button, Skeleton } from '../components/ui';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { db, students } from '../api/client.js';
import useAsync from '../hooks/useAsync.js';
import '../components/layout/layout.css';
import './pages.css';

const PILLARS = [
  {
    eyebrow: 'Discover',
    title: 'Find notes for your exact semester.',
    body: 'Filter 400 materials by subject, type and rating. Every filter is a WHERE clause, and you can watch it run.',
  },
  {
    eyebrow: 'Swap',
    title: 'Trade material for material.',
    body: 'Request a file and offer one of yours back. The uploader accepts or rejects; nothing costs money.',
  },
  {
    eyebrow: 'Earn credibility',
    title: 'Your score is an average, not a vote.',
    body: 'Credibility is AVG(Rating.score) across everything you upload — computed on read, never stored.',
  },
];

const ROLES = [
  ['Frontend & prototype', 'React UI on a mock data layer that mirrors the schema'],
  ['Database design', 'ER model, normalization to 3NF, DDL and constraints'],
  ['Backend & API', 'REST endpoints and SQL that replace the mock in week 3'],
];

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  // Live counts straight from the mock tables.
  const { data } = useAsync(async () => {
    const counts = db.counts();
    const top = await students.leaderboard({ limit: 1 });
    return { counts, top: top[0] };
  }, []);

  const stats = data && [
    [data.counts.Material, 'Material rows'],
    [data.counts.Student, 'Students'],
    [data.counts.Subject, 'Subjects'],
    [data.counts.Rating, 'Ratings'],
    [data.counts.Swap_Request, 'Swap requests'],
  ];

  return (
    <div className="landing page-fade">
      <header className="landing__top">
        <Link to="/" className="auth__brand">
          <span className="brand-mark" aria-hidden="true" />
          StudySwap
        </Link>
        <div className="row gap-2">
          {user ? (
            <Button as={Link} to="/dashboard" variant="secondary" size="sm">
              Go to dashboard
            </Button>
          ) : (
            <Button as={Link} to="/login" variant="ghost" size="sm">
              Sign in
            </Button>
          )}
          <Button variant="ghost" icon={theme === 'dark' ? Sun : Moon} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme} />
        </div>
      </header>

      <main id="main">
        <section className="hero ruled-paper" aria-labelledby="hero-title">
          <div className="hero__inner">
            <p className="eyebrow">Peer-to-peer study material exchange · one campus</p>
            <h1 id="hero-title" className="hero__title">
              Swap notes,
              <br />
              not money.
            </h1>
            <p className="hero__lede">
              StudySwap lets students on one campus trade handwritten notes, previous-year papers, assignments and summaries directly with each other.
              Ask for what you need, offer what you have, and let ratings show whose material is worth it.
            </p>
            <div className="row gap-3">
              <Button as={Link} to={user ? '/browse' : '/register'} variant="primary" size="lg" iconRight={ArrowRight}>
                {user ? 'Browse materials' : 'Create your account'}
              </Button>
              {!user && (
                <Button as={Link} to="/login" variant="secondary" size="lg">
                  Try a demo account
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="pillars" aria-label="How it works">
          {PILLARS.map((p) => (
            <div key={p.eyebrow} className="pillar">
              <p className="eyebrow">{p.eyebrow}</p>
              <h2 className="pillar__title">{p.title}</h2>
              <p className="muted">{p.body}</p>
            </div>
          ))}
        </section>

        <section className="stat-strip" aria-label="Live database counts">
          <p className="eyebrow">Live from the database</p>
          <dl className="stat-strip__row">
            {(stats || Array.from({ length: 5 }, (_, i) => [null, i])).map(([n, label]) => (
              <div key={label} className="stat-strip__item">
                <dd className="stat-strip__num">{n === null ? <Skeleton width={56} height={28} /> : n}</dd>
                <dt className="eyebrow">{typeof label === 'string' ? label : ' '}</dt>
              </div>
            ))}
          </dl>
          {data?.top && (
            <p className="small muted">
              Top contributor right now: <span style={{ color: 'var(--ink)' }}>{data.top.name}</span>,{' '}
              <span className="num">{data.top.credibility_score?.toFixed(2)}</span> over <span className="num">{data.top.rating_count}</span> ratings.
            </p>
          )}
        </section>
      </main>

      <footer className="landing__foot">
        <div>
          <p className="serif" style={{ fontSize: 'var(--fs-md)' }}>
            BACSE202 · Database Systems
          </p>
          <p className="small faint">Course project — Review 1 prototype</p>
        </div>
        <ul className="roles">
          {ROLES.map(([role, what]) => (
            <li key={role}>
              <p className="eyebrow">{role}</p>
              <p className="small muted">{what}</p>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
