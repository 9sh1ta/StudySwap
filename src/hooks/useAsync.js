import { useCallback, useEffect, useRef, useState } from 'react';

// Runs an async loader and tracks { data, error, loading }.
//   const { data, error, loading, reload, setData } = useAsync(() => api.x(id), [id]);
// Stale responses (from an earlier deps value) are ignored. `setData` is for
// optimistic updates; `reload({ quiet: true })` refetches without a skeleton.
export default function useAsync(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const run = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(
    ({ quiet = false } = {}) => {
      const id = ++run.current;
      if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
      return Promise.resolve()
        .then(() => loaderRef.current())
        .then(
          (data) => {
            if (id === run.current) setState({ data, error: null, loading: false });
            return data;
          },
          (error) => {
            if (id === run.current) setState((s) => ({ ...s, error, loading: false }));
          }
        );
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (enabled) reload();
    return () => {
      run.current++; // drop in-flight responses on unmount / deps change
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  const setData = useCallback((next) => setState((s) => ({ ...s, data: typeof next === 'function' ? next(s.data) : next })), []);

  return { ...state, reload, setData };
}
