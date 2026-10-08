import { useId } from 'react';

// Squared switch. The knob position and the ON/OFF text carry state —
// never the fill colour alone.
//   <Toggle checked={useIndexes} onChange={setUseIndexes} label="Use indexes" />
export default function Toggle({ checked, onChange, label, showState = true, disabled = false, className = '' }) {
  const id = useId();
  return (
    <span className={`toggle${disabled ? ' toggle--disabled' : ''} ${className}`.trim()}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="toggle__track"
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__knob" />
      </button>
      {label && (
        <label htmlFor={id} className="toggle__label">
          {label}
        </label>
      )}
      {showState && (
        <span className="toggle__state" aria-hidden="true">
          {checked ? 'On' : 'Off'}
        </span>
      )}
    </span>
  );
}
