import { Link } from 'react-router-dom';
import { BookOpen, X } from 'lucide-react';
import { Button } from '../ui';
import { useExamMode } from '../../context/ExamModeContext.jsx';

// Exam Mode's countdown: a rule that fills as the exam approaches.
const WINDOW = 14; // the countdown starts two weeks out

export default function ExamStrip() {
  const { exam, setExamMode } = useExamMode();
  const filled = Math.min(1, Math.max(0, (WINDOW - exam.daysLeft) / WINDOW));
  return (
    <aside className="exam-strip" aria-label="Exam countdown">
      <span className="exam-strip__label">
        <BookOpen aria-hidden="true" />
        Exam Mode
      </span>
      <span className="exam-strip__count">
        {exam.name} in <span className="num">{exam.daysLeft}</span> {exam.daysLeft === 1 ? 'day' : 'days'}
      </span>
      <span className="exam-strip__rule" aria-hidden="true">
        <span className="exam-strip__fill" style={{ width: `${filled * 100}%` }} />
      </span>
      <Link to="/browse" className="small">
        What everyone is asking for
      </Link>
      <Button variant="ghost" size="sm" icon={X} aria-label="Leave Exam Mode" onClick={() => setExamMode(false)} />
    </aside>
  );
}
