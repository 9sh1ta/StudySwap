import { Navigate, useParams } from 'react-router-dom';
import ProfileView from '../components/domain/ProfileView.jsx';
import { useBreadcrumbs } from '../components/layout/Shell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import './pages.css';

export default function StudentProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  useBreadcrumbs([{ label: 'Students' }, { label: `student_id ${id}` }]);
  if (Number(id) === user.student_id) return <Navigate to="/profile" replace />;
  return <ProfileView studentId={Number(id)} viewerId={user.student_id} />;
}
