import { NavLink } from 'react-router-dom';
import { ArrowLeftRight, Database, LayoutDashboard, Library, PanelLeftClose, PanelLeftOpen, Repeat, Trophy, Upload, User } from 'lucide-react';
import { Tooltip } from '../ui';

export const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/browse', label: 'Browse', icon: Library },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/requests', label: 'Requests', icon: ArrowLeftRight, countKey: 'requests' },
  { to: '/matches', label: 'Matches', icon: Repeat },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/db-lab', label: 'DB Lab', icon: Database },
  { to: '/profile', label: 'Profile', icon: User },
];

// Flat text navigation. Active item: 2px accent bar, accent wash, weight 600.
// Collapses to icons (toggle, or automatically below 1024px) and becomes a
// bottom tab bar on phones — same element, restyled in layout.css.
export default function Sidebar({ collapsed, onToggle, counts = {} }) {
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar__brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="sidebar__word">StudySwap</span>
      </div>
      <ul className="sidebar__list">
        {NAV.map((item) => {
          const count = item.countKey ? counts[item.countKey] : 0;
          const link = (
            <NavLink to={item.to} className="sidebar__link" aria-label={count > 0 ? `${item.label}, ${count} pending` : item.label}>
              <item.icon aria-hidden="true" />
              <span className="sidebar__label">{item.label}</span>
              {count > 0 && (
                <span className="sidebar__count" aria-label={`${count} pending`}>
                  {count}
                </span>
              )}
            </NavLink>
          );
          return <li key={item.to}>{collapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link}</li>;
        })}
      </ul>
      <button type="button" className="sidebar__toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}>
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        <span className="sidebar__label">Collapse</span>
      </button>
    </nav>
  );
}
