import { useEffect, useRef } from 'react';
import { db } from '../api/client.js';

// Calls `onWrite(entry)` after every committed write — from the real backend
// (API mode) or the mock DB (DB Lab). Used for live badges and header refreshes.
export default function useDbWrites(onWrite, tables = null) {
  const ref = useRef(onWrite);
  ref.current = onWrite;
  useEffect(
    () =>
      db.onWrite((entry) => {
        if (tables && !entry.tables?.some((t) => tables.includes(t))) return;
        ref.current(entry);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tables && tables.join()]
  );
}
