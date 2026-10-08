import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ToastRegion } from '../components/ui/Toast.jsx';

const ToastContext = createContext(null);

// toast({ title, description, tone, action, duration }) → id
//   tone:   'info' | 'ok' | 'warn' | 'danger'   (default 'info')
//   action: { label: 'Undo', onClick }          (optional)
//   duration in ms, default 4000; 0 keeps it until dismissed.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts) => {
    const id = nextId.current++;
    const item = { tone: 'info', duration: 4000, ...(typeof opts === 'string' ? { title: opts } : opts), id };
    setToasts((list) => [...list.slice(-4), item]); // keep at most 5 stacked
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
