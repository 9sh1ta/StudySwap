import { useCallback, useState } from 'react';

// useState that mirrors its value into localStorage (JSON-encoded).
// Reads and writes are wrapped because storage can throw in private
// windows or when site data is blocked — the app must still work.
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage unavailable — keep in-memory value */
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, set];
}
