import ProfileView from '../components/domain/ProfileView.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import './pages.css';

export default function Profile() {
  const { user } = useAuth();
  return <ProfileView studentId={user.student_id} viewerId={user.student_id} self />;
}
