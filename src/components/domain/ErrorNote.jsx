import { CircleAlert } from 'lucide-react';

// Shows a DbError the way the database reported it: the constraint message
// in mono, the human-readable detail beneath. Plain Errors render too.
export default function ErrorNote({ error, className = '' }) {
  if (!error) return null;
  return (
    <div className={`errnote ${className}`.trim()} role="alert">
      <CircleAlert aria-hidden="true" />
      <div>
        <p className="errnote__msg">{error.message}</p>
        {error.detail && <p className="errnote__detail">{error.detail}</p>}
      </div>
    </div>
  );
}

// Toast payload for a DbError.
export function errorToast(err, title) {
  return {
    tone: 'danger',
    title: title || err.message,
    description: title ? err.message + (err.detail ? ` — ${err.detail}` : '') : err.detail,
    duration: 6000,
  };
}
