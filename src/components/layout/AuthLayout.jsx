import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../ui';
import { useTheme } from '../../context/ThemeContext.jsx';
import './layout.css';

// Split layout for Login and Register: ruled-paper panel on the left with
// one line of context, the form on the right.
export default function AuthLayout({ title, lede, aside, children }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="auth page-fade">
      <aside className="auth__panel ruled-paper">
        <Link to="/" className="auth__brand">
          <span className="brand-mark" aria-hidden="true" />
          StudySwap
        </Link>
        <div className="auth__panel-body">{aside}</div>
        <p className="xsmall faint">BACSE202 · Database Systems · Review 1 prototype</p>
      </aside>
      <main className="auth__main" id="main">
        <div className="auth__topright">
          <Button variant="ghost" icon={theme === 'dark' ? Sun : Moon} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme} />
        </div>
        <div className="auth__form">
          <h1 className="auth__title">{title}</h1>
          {lede && <p className="muted">{lede}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
