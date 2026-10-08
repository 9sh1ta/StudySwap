import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, Database, FileText, LayoutDashboard, Library, Moon, PlayCircle, Repeat, Search, Sun, Trophy, Upload, User, Users } from 'lucide-react';
import { Badge } from '../ui';
import { search as searchApi } from '../../api/client.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useExamMode } from '../../context/ExamModeContext.jsx';
import useDebounce from '../../hooks/useDebounce.js';

// ⌘K / Ctrl+K. Fuzzy search across Material, Subject and Student, plus the
// actions a reviewer reaches for. Arrow keys move, Enter runs, Esc closes.
export default function CommandPalette({ open, onClose, onStartDemo }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { examMode, toggleExamMode } = useExamMode();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [results, setResults] = useState(null);
  const term = useDebounce(q.trim(), 160);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !term) return setResults(null);
    let live = true;
    searchApi.all(term, { limit: 5 }).then((r) => live && setResults(r));
    return () => {
      live = false;
    };
  }, [term, open]);

  const actions = useMemo(
    () => [
      { id: 'go-dashboard', icon: LayoutDashboard, label: 'Dashboard', hint: 'g d', run: () => navigate('/dashboard') },
      { id: 'go-browse', icon: Library, label: 'Browse materials', hint: 'g b', run: () => navigate('/browse') },
      { id: 'go-upload', icon: Upload, label: 'Upload a material', hint: 'u', run: () => navigate('/upload') },
      { id: 'go-requests', icon: ArrowLeftRight, label: 'Swap requests', hint: 'g r', run: () => navigate('/requests') },
      { id: 'go-matches', icon: Repeat, label: 'Swap matches', hint: 'g m', run: () => navigate('/matches') },
      { id: 'go-leaderboard', icon: Trophy, label: 'Leaderboard', hint: 'g l', run: () => navigate('/leaderboard') },
      { id: 'go-dblab', icon: Database, label: 'DB Lab', hint: 'g x', run: () => navigate('/db-lab') },
      { id: 'go-profile', icon: User, label: 'Your profile', hint: 'g p', run: () => navigate('/profile') },
      { id: 'demo', icon: PlayCircle, label: 'Start the guided demo', run: () => onStartDemo?.() },
      { id: 'exam', icon: BookOpen, label: `${examMode ? 'Leave' : 'Enter'} Exam Mode`, run: toggleExamMode },
      { id: 'theme', icon: theme === 'dark' ? Sun : Moon, label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, hint: 't', run: toggleTheme },
    ],
    [navigate, theme, toggleTheme, examMode, toggleExamMode, onStartDemo]
  );

  // Flat list of everything selectable, in display order.
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    const matchedActions = actions.filter((a) => !t || a.label.toLowerCase().includes(t));
    const out = [];
    if (results?.materials?.length) {
      out.push({
        title: 'Materials',
        items: results.materials.map((m) => ({
          id: `m${m.material_id}`,
          icon: FileText,
          label: m.title,
          meta: <Badge>{m.material_type}</Badge>,
          hint: `#${m.material_id}`,
          run: () => navigate(`/material/${m.material_id}`),
        })),
      });
    }
    if (results?.subjects?.length) {
      out.push({
        title: 'Subjects',
        items: results.subjects.map((s) => ({
          id: `s${s.subject_id}`,
          icon: BookOpen,
          label: s.subject_name,
          hint: s.code,
          run: () => navigate(`/browse?subject=${s.subject_id}`),
        })),
      });
    }
    if (results?.students?.length) {
      out.push({
        title: 'Students',
        items: results.students.map((st) => ({
          id: `st${st.student_id}`,
          icon: Users,
          label: st.name,
          hint: `${st.department} · sem ${st.semester}`,
          run: () => navigate(`/student/${st.student_id}`),
        })),
      });
    }
    if (matchedActions.length) out.push({ title: 'Actions', items: matchedActions });
    return out;
  }, [results, actions, q, navigate]);

  const flat = groups.flatMap((g) => g.items);
  useEffect(() => setActive(0), [flat.length]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(1, flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[active];
      if (item) {
        onClose();
        item.run();
      }
    }
  }

  let index = -1;
  return createPortal(
    <div
      className="palette-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKeyDown}>
        <div className="palette__input control">
          <span className="control__adorn control__adorn--left" aria-hidden="true">
            <Search />
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[active] ? `${listId}-${flat[active].id}` : undefined}
            aria-autocomplete="list"
            placeholder="Search materials, subjects, students — or jump somewhere"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="palette__list" role="listbox" id={listId} aria-label="Results" ref={listRef}>
          {flat.length === 0 && <p className="palette__empty small faint">Nothing matches “{q}”. Try a subject code, a title, or a student’s name.</p>}
          {groups.map((g) => (
            <div key={g.title} className="palette__group" role="group" aria-label={g.title}>
              <p className="eyebrow palette__group-title">{g.title}</p>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={i === active}
                    className="palette__item"
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onClose();
                      item.run();
                    }}
                  >
                    <item.icon aria-hidden="true" />
                    <span className="palette__label truncate">{item.label}</span>
                    {item.meta}
                    {item.hint && <span className="palette__hint mono">{item.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="palette__foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>?</kbd> all shortcuts
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
