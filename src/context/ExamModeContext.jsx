import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage.js';

const ExamModeContext = createContext(null);

// Exam Mode (§7.6): Browse re-sorts to what everyone is asking for this
// week, a countdown appears, cram packs show up, and the accent shifts from
// ink blue to ochre. Nothing about the data changes — only what is surfaced.
const DEFAULT_EXAM = { name: 'Mid-sem', daysFromNow: 6 };

function isoIn(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ExamModeProvider({ children }) {
  const [state, setState] = useLocalStorage('studyswap.examMode', { on: false, name: DEFAULT_EXAM.name, date: null });

  useEffect(() => {
    document.documentElement.dataset.exam = state.on ? 'on' : 'off';
  }, [state.on]);

  const setOn = useCallback(
    (on) =>
      setState((s) => {
        document.documentElement.dataset.exam = on ? 'on' : 'off';
        // The date is fixed the first time it is switched on, so the
        // countdown does not move while you demo.
        return { ...s, on, date: s.date || isoIn(DEFAULT_EXAM.daysFromNow) };
      }),
    [setState]
  );

  const value = useMemo(() => {
    const date = state.date || isoIn(DEFAULT_EXAM.daysFromNow);
    const daysLeft = Math.max(0, Math.round((new Date(`${date}T12:00:00`) - new Date().setHours(12, 0, 0, 0)) / 86400000));
    return { examMode: state.on, setExamMode: setOn, toggleExamMode: () => setOn(!state.on), exam: { name: state.name, date, daysLeft } };
  }, [state, setOn]);

  return <ExamModeContext.Provider value={value}>{children}</ExamModeContext.Provider>;
}

export function useExamMode() {
  const ctx = useContext(ExamModeContext);
  if (!ctx) throw new Error('useExamMode must be used inside <ExamModeProvider>');
  return ctx;
}
