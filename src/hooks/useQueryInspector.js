import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../api/client.js';
import useLocalStorage from './useLocalStorage.js';

// Feeds the Query Inspector: the screen's latest query, the recent history,
// and the global index switch. Subscribes to the log, so anything the app
// runs shows up without each page reporting it.
export default function useQueryInspector() {
  const [open, setOpen] = useLocalStorage('studyswap.inspector.open', false);
  const [entry, setEntry] = useState(() => db.latestQuery());
  const [history, setHistory] = useState(() => db.queryLog(20));
  const [useIndexes, setUseIndexesState] = useState(() => db.useIndexes());

  useEffect(
    () =>
      db.subscribe((e) => {
        setHistory(db.queryLog(20));
        if (e.primary !== false) setEntry(e);
      }),
    []
  );

  const toggleIndexes = useCallback((on) => {
    setUseIndexesState(db.toggleIndexes(on));
  }, []);

  return { open, setOpen, entry, history, useIndexes, toggleIndexes };
}

// Counts from the previous value to the new one, so the before/after
// numbers visibly move when indexes are switched off.
export function useCountUp(value, duration = 450) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof value !== 'number' || from.current === value) {
      from.current = value;
      setDisplay(value);
      return undefined;
    }
    const start = performance.now();
    const a = from.current ?? 0;
    const b = value;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(a + (b - a) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return display;
}
