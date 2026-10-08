import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage.js';

const ThemeContext = createContext(null);

function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Theme is 'light' | 'dark', persisted under studyswap.theme and applied
// as <html data-theme>. index.html applies it before first paint too.
export function ThemeProvider({ children }) {
  const [theme, setStoredTheme] = useLocalStorage('studyswap.theme', systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Apply the attribute immediately (not only in the effect) so components
  // that read resolved CSS colours during render — the charts — see the new theme.
  const setTheme = useCallback(
    (next) =>
      setStoredTheme((prev) => {
        const t = typeof next === 'function' ? next(prev) : next;
        document.documentElement.dataset.theme = t;
        return t;
      }),
    [setStoredTheme]
  );

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
