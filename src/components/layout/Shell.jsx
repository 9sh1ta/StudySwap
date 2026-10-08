import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import QueryInspector from '../domain/QueryInspector.jsx';
import GuidedDemo from '../domain/GuidedDemo.jsx';
import CommandPalette from './CommandPalette.jsx';
import ShortcutsOverlay from './ShortcutsOverlay.jsx';
import ExamStrip from './ExamStrip.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { activity as activityApi, students } from '../../api/client.js';
import useDbWrites from '../../hooks/useDbWrites.js';
import useLocalStorage from '../../hooks/useLocalStorage.js';
import useAppShortcuts from '../../hooks/useAppShortcuts.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useExamMode } from '../../context/ExamModeContext.jsx';
import './layout.css';

// Pages set their breadcrumb trail with useBreadcrumbs([...]).
const CrumbContext = createContext(() => {});

export function useBreadcrumbs(crumbs) {
  const set = useContext(CrumbContext);
  const { pathname } = useLocation();
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    set({ path: pathname, crumbs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname, set]);
}

const DEFAULT_CRUMBS = {
  dashboard: [{ label: 'Dashboard' }],
  browse: [{ label: 'Browse' }],
  upload: [{ label: 'Upload' }],
  requests: [{ label: 'Requests' }],
  matches: [{ label: 'Swap matches' }],
  leaderboard: [{ label: 'Leaderboard' }],
  'db-lab': [{ label: 'DB Lab' }],
  profile: [{ label: 'Profile' }],
};

// Signed-in layout: sidebar, topbar, and the routed page with a 120ms fade.
export default function Shell() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useLocalStorage('studyswap.sidebar.collapsed', false);
  const [pageCrumbs, setPageCrumbs] = useState({ path: null, crumbs: [] });
  const [counts, setCounts] = useState({});
  const [activity, setActivity] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const { examMode, toggleExamMode } = useExamMode();

  useAppShortcuts({
    navigate,
    onPalette: () => setPaletteOpen((o) => !o),
    onHelp: () => setHelpOpen((o) => !o),
    onTheme: toggleTheme,
    onExamMode: toggleExamMode,
    enabled: !demoOpen,
  });

  const section = location.pathname.split('/')[1];
  // A page's own trail wins; otherwise fall back to the section name.
  const crumbs = pageCrumbs.path === location.pathname ? pageCrumbs.crumbs : DEFAULT_CRUMBS[section] || [];

  // Badge counts and notifications, refreshed after every committed write.
  const refresh = useCallback(() => {
    if (!user) return;
    students.stats(user.student_id, { background: true }).then((s) => setCounts({ requests: s.pending_incoming }), () => {});
    activityApi.recent(user.student_id, { limit: 8, background: true }).then(setActivity, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);
  useEffect(refresh, [refresh]);
  useDbWrites(refresh, ['Swap_Request', 'Rating', 'Material']);

  return (
    <CrumbContext.Provider value={setPageCrumbs}>
      <div className={`shell${collapsed ? ' shell--collapsed' : ''}`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} counts={counts} />
        <div className="shell__main">
          <Topbar crumbs={crumbs} activity={activity} onStartDemo={() => setDemoOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
          {examMode && <ExamStrip />}
          <main id="main" className="shell__content page-fade" key={location.pathname} tabIndex={-1}>
            <Outlet />
          </main>
          <QueryInspector />
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onStartDemo={() => setDemoOpen(true)} />
          <ShortcutsOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
          <GuidedDemo open={demoOpen} onClose={() => setDemoOpen(false)} />
        </div>
      </div>
    </CrumbContext.Provider>
  );
}

// Route guard: waits for the stored session, then requires a user.
export function RequireAuth({ children }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="boot" role="status" aria-live="polite">
        <span className="brand-mark" aria-hidden="true" />
        <span className="sr-only">Restoring your session</span>
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

// Login / register are pointless when already signed in.
export function RedirectIfAuthed({ children }) {
  const { user, status } = useAuth();
  if (status === 'ready' && user) return <Navigate to="/dashboard" replace />;
  return children;
}
