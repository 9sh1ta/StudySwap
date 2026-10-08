import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Shell, { RedirectIfAuthed, RequireAuth } from './components/layout/Shell.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Browse from './pages/Browse.jsx';
import MaterialDetail from './pages/MaterialDetail.jsx';
import NotFound from './pages/NotFound.jsx';
import { Skeleton } from './components/ui';

// The demo path (landing → browse → material) is in the main bundle.
// Heavier, less-travelled screens load on demand — the charts and the
// DB Lab pull in recharts and the whole schema.
const Upload = lazy(() => import('./pages/Upload.jsx'));
const Requests = lazy(() => import('./pages/Requests.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const StudentProfile = lazy(() => import('./pages/StudentProfile.jsx'));
const SwapMatches = lazy(() => import('./pages/SwapMatches.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const DbLab = lazy(() => import('./pages/DbLab.jsx'));
const KitchenSink = lazy(() => import('./pages/KitchenSink.jsx'));

function PageFallback() {
  return (
    <div className="stack gap-4" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton width={260} height={34} />
      <Skeleton height={92} />
      <Skeleton height={320} />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthed>
              <Register />
            </RedirectIfAuthed>
          }
        />
        <Route path="/kitchen-sink" element={<KitchenSink />} />

        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/material/:id" element={<MaterialDetail />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/matches" element={<SwapMatches />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/db-lab" element={<DbLab />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/student/:id" element={<StudentProfile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
