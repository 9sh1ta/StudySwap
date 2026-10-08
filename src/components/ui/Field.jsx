import { CircleAlert, CircleCheck } from 'lucide-react';

// Shared wrapper for Input, Select and Textarea: small-caps label above,
// optional schema column name on the right, and one message line below.
// `column` shows the DDL column the field maps to (e.g. "Student.email").
export default function Field({ id, label, column, required, hint, error, success, counter, children }) {
  const msgId = `${id}-msg`;
  const message = error || success || hint;
  return (
    <div className="field">
      {(label || column) && (
        <label className="field__label" htmlFor={id}>
          <span>
            {label}
            {required && <span className="field__req" aria-hidden="true">*</span>}
          </span>
          {column && <span className="field__col">{column}</span>}
        </label>
      )}
      {children}
      {(message || counter) && (
        <div
          id={msgId}
          className={`field__msg${error ? ' field__msg--error' : success ? ' field__msg--ok' : ''}`}
          aria-live={error ? 'polite' : undefined}
        >
          {error && <CircleAlert aria-hidden="true" />}
          {!error && success && <CircleCheck aria-hidden="true" />}
          {message && <span>{message}</span>}
          {counter}
        </div>
      )}
    </div>
  );
}

// Live "n / max" counter, turns danger when over the column limit.
export function Counter({ value = '', max }) {
  const n = String(value).length;
  return (
    <span className={`field__counter${n > max ? ' field__counter--over' : ''}`} aria-live="polite">
      {n} / {max}
    </span>
  );
}
