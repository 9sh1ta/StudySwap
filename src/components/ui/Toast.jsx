import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import Button from './Button.jsx';

const ICONS = { info: Info, ok: CircleCheck, warn: TriangleAlert, danger: CircleAlert };

// Rendered once by ToastProvider. Use the useToast() hook to show one.
export function ToastRegion({ toasts, onDismiss }) {
  return createPortal(
    <div className="toast-region" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}

function ToastItem({ toast, onDismiss }) {
  const { id, title, description, tone, action, duration } = toast;
  const Icon = ICONS[tone] || Info;
  const timer = useRef(null);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  const start = () => {
    if (!remaining.current) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onDismiss(id), remaining.current);
  };
  const pause = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current -= Date.now() - startedAt.current;
  };

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`toast toast--${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
    >
      <Icon className="toast__icon" aria-hidden="true" />
      <div className="toast__body">
        {title && <div className="toast__title">{title}</div>}
        {description && <div className="toast__desc">{description}</div>}
      </div>
      <div className="toast__actions">
        {action && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              action.onClick?.();
              onDismiss(id);
            }}
          >
            {action.label}
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={X} aria-label="Dismiss notification" onClick={() => onDismiss(id)} />
      </div>
    </div>
  );
}
