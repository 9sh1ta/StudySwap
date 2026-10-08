import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Bell, BookOpen, ChevronRight, LogOut, Moon, PlayCircle, RotateCcw, Search, Star, Sun, Upload, User, Users } from 'lucide-react';
import { Avatar, Button, Dropdown, Modal, Tooltip } from '../ui';
import { TierLabel } from '../domain/CredibilityMark.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useExamMode } from '../../context/ExamModeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { db } from '../../api/client.js';
import { relativeDate } from '../../lib/format.js';
import useLocalStorage from '../../hooks/useLocalStorage.js';

const ACTIVITY_TEXT = {
  request: (a) => `${a.actor} requested ${a.title}`,
  response: (a) => `${a.actor} ${a.status === 'Rejected' ? 'rejected' : 'accepted'} your request for ${a.title}`,
  rating: (a) => `${a.actor} rated ${a.title} ${a.score}★`,
};
const ACTIVITY_ICON = { request: ArrowLeftRight, response: ArrowLeftRight, rating: Star };

export default function Topbar({ crumbs, activity = [], onStartDemo, onOpenPalette }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { examMode, toggleExamMode } = useExamMode();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [seen, setSeen] = useLocalStorage(`studyswap.seen.${user?.student_id}`, '');
  const unread = activity.filter((a) => a.at > seen).length;

  function submitSearch(e) {
    e.preventDefault();
    navigate(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setQ('');
  }

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function reset() {
    setResetting(true);
    const counts = await db.reset();
    toast({ tone: 'ok', title: 'Demo data reset', description: `All five tables were re-seeded — ${counts.Material} materials, ${counts.Student} students.` });
    window.location.assign('/dashboard'); // full reload so every screen re-reads the fresh tables
  }

  return (
    <header className="topbar">
      <Link to="/dashboard" className="topbar__brand" aria-label="StudySwap home">
        <span className="brand-mark" aria-hidden="true" />
      </Link>
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          {crumbs.map((c, i) => (
            <li key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight aria-hidden="true" />}
              {c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
            </li>
          ))}
        </ol>
      </nav>

      <form className="topbar__search control" role="search" onSubmit={submitSearch}>
        <span className="control__adorn control__adorn--left" aria-hidden="true">
          <Search />
        </span>
        <input id="global-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search material titles" aria-label="Search material titles" />
        <button type="button" className="topbar__palette" onClick={onOpenPalette} aria-label="Open the command palette">
          <kbd>Ctrl K</kbd>
        </button>
      </form>

      <div className="topbar__actions">
        <Tooltip content={examMode ? 'Leave Exam Mode' : 'Exam Mode: what everyone is asking for this week, plus cram packs'}>
          <button type="button" className={`exam-toggle${examMode ? ' exam-toggle--on' : ''}`} aria-pressed={examMode} onClick={toggleExamMode}>
            <BookOpen aria-hidden="true" />
            <span className="exam-toggle__label">Exam Mode</span>
          </button>
        </Tooltip>
        <Dropdown
          align="right"
          label="Notifications"
          heading="Recent activity"
          menuClassName="notif-menu"
          onOpenChange={(open) => {
            if (open && activity[0]) setSeen(activity[0].at);
          }}
          trigger={(p) => (
            <span className="notif">
              <Button {...p} variant="ghost" icon={Bell} aria-label={`Notifications${unread ? `, ${unread} new` : ''}`} />
              {unread > 0 && (
                <span className="notif__dot" aria-hidden="true">
                  {unread}
                </span>
              )}
            </span>
          )}
          items={
            activity.length
              ? activity.slice(0, 6).map((a) => ({
                  key: `${a.kind}-${a.ref}`,
                  icon: ACTIVITY_ICON[a.kind],
                  label: (
                    <span className="stack gap-1">
                      <span className="clamp-2">{ACTIVITY_TEXT[a.kind](a)}</span>
                      <span className="xsmall faint">{relativeDate(a.at)}</span>
                    </span>
                  ),
                  onSelect: () => navigate(a.kind === 'rating' ? `/material/${a.material_id}` : '/requests'),
                }))
              : [{ key: 'none', label: 'Nothing yet — requests and ratings on your uploads appear here.', disabled: true }]
          }
        />
        <Button variant="ghost" icon={theme === 'dark' ? Sun : Moon} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme} />
        <Dropdown
          align="right"
          label="Account"
          heading={
            <span className="stack gap-1" style={{ textTransform: 'none', letterSpacing: 0 }}>
              <span style={{ color: 'var(--ink)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{user?.name}</span>
              <span className="row gap-2">
                <span className="mono">student_id {user?.student_id}</span>
                <TierLabel score={user?.credibility_score} count={user?.rating_count ?? 0} withTooltip={false} />
              </span>
            </span>
          }
          trigger={(p) => (
            <button type="button" className="topbar__user" {...p}>
              <Avatar name={user?.name} size="sm" decorative />
              <span className="topbar__username">{user?.name?.split(' ')[0]}</span>
            </button>
          )}
          items={[
            { label: 'Profile', icon: User, onSelect: () => navigate('/profile') },
            { label: 'Upload material', icon: Upload, onSelect: () => navigate('/upload') },
            { separator: true },
            { label: 'Guided demo', icon: PlayCircle, onSelect: () => onStartDemo?.() },
            {
              label: 'Switch account',
              icon: Users,
              hint: 'demo',
              onSelect: async () => {
                await logout();
                navigate('/login');
              },
            },
            { label: 'Reset demo data', icon: RotateCcw, onSelect: () => setResetOpen(true) },
            {
              label: 'Sign out',
              icon: LogOut,
              danger: true,
              onSelect: async () => {
                await logout();
                navigate('/login');
              },
            },
          ]}
        />
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        size="sm"
        title="Reset the demo data?"
        description="Everything goes back to the seeded campus."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="danger" icon={RotateCcw} loading={resetting} onClick={reset}>
              Reset demo data
            </Button>
          </>
        }
      >
        <div className="stack gap-3">
          <p className="muted">
            Materials you uploaded, requests you sent and ratings you gave during this session are deleted, and the seeded rows come back.
          </p>
          <p className="muted">
            Accounts registered through the sign-up form are <strong>kept</strong>, so you can still sign in afterwards.
          </p>
        </div>
      </Modal>
    </header>
  );
}
