import { Check, X } from 'lucide-react';

// Three forms:
//   Removable filter chip  <Chip label="Type" onRemove={…}>PYQ</Chip>
//   Toggleable chip        <Chip selected={on} onClick={…}>Pending</Chip>
//   Subject chip           <Chip subject={3} code="BCSE302L">Database Systems</Chip>
// `subject` (1–6) picks the --sub-N spine colour; it is never a fill.
export default function Chip({ children, label, onRemove, selected, onClick, subject, code, className = '' }) {
  const subjectCls = subject ? ` chip--subject sub-${((subject - 1) % 6) + 1}` : '';

  if (onClick) {
    return (
      <button type="button" className={`chip${subjectCls} ${className}`.trim()} aria-pressed={!!selected} onClick={onClick}>
        {selected && <Check className="chip__check" aria-hidden="true" />}
        {children}
        {code && <span className="chip__code">{code}</span>}
      </button>
    );
  }

  return (
    <span className={`chip${onRemove ? '' : ' chip--static'}${subjectCls} ${className}`.trim()}>
      {label && <span className="chip__key">{label}:</span>}
      <span>{children}</span>
      {code && <span className="chip__code">{code}</span>}
      {onRemove && (
        <button
          type="button"
          className="chip__remove"
          aria-label={`Remove filter ${label ? `${label} ` : ''}${typeof children === 'string' ? children : ''}`.trim()}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
