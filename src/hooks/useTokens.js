import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

// Resolved values of CSS custom properties, re-read when the theme flips.
// For libraries (recharts) that need literal colours rather than var(--x).
export default function useTokens(names) {
  const { theme } = useTheme();
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n.replace(/^--/, ''), cs.getPropertyValue(n).trim()]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, names.join()]);
}
