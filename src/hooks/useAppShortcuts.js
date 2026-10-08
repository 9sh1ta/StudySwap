import { useEffect, useRef } from 'react';

// App-wide keys, including the two-key "g then d" sequences. Plain keys are
// ignored while typing, and any key with a modifier other than the palette's
// own is left to the browser.
const GO = {
  d: '/dashboard',
  b: '/browse',
  r: '/requests',
  m: '/matches',
  l: '/leaderboard',
  x: '/db-lab',
  p: '/profile',
  u: '/upload',
};

function isTyping(el) {
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

export default function useAppShortcuts({ navigate, onPalette, onHelp, onTheme, onExamMode, enabled = true }) {
  const handlers = useRef({});
  handlers.current = { navigate, onPalette, onHelp, onTheme, onExamMode };
  const awaitingG = useRef(false);
  const gTimer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    function onKeyDown(e) {
      const h = handlers.current;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        h.onPalette();
        return;
      }
      if (mod || e.altKey) return; // Ctrl+/ belongs to the Inspector
      if (isTyping(e.target)) return;

      const key = e.key;

      if (awaitingG.current) {
        awaitingG.current = false;
        clearTimeout(gTimer.current);
        const to = GO[key.toLowerCase()];
        if (to) {
          e.preventDefault();
          h.navigate(to);
          return;
        }
      }

      if (key === 'g') {
        awaitingG.current = true;
        clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => {
          awaitingG.current = false;
        }, 1200);
        return;
      }
      if (key === '?') {
        e.preventDefault();
        h.onHelp();
      } else if (key === 't') {
        e.preventDefault();
        h.onTheme();
      } else if (key === 'e') {
        e.preventDefault();
        h.onExamMode();
      } else if (key === 'u') {
        e.preventDefault();
        h.navigate('/upload');
      } else if (key === '/') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(gTimer.current);
    };
  }, [enabled]);
}
