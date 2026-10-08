import { useEffect, useRef } from 'react';

// Binds a single-key or modifier shortcut on window.
//   useKeyboardShortcut('t', toggleTheme)
//   useKeyboardShortcut('mod+k', openPalette)   // mod = Cmd on macOS, Ctrl elsewhere
// Plain-key shortcuts are ignored while the user is typing in a field.
export default function useKeyboardShortcut(combo, handler, { enabled = true } = {}) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop();
    const needsMod = parts.includes('mod');

    function onKeyDown(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (needsMod !== mod || e.altKey) return;
      if (e.key.toLowerCase() !== key) return;
      if (!needsMod && isTyping(e.target)) return;
      e.preventDefault();
      handlerRef.current(e);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled]);
}

function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
