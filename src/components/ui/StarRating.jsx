import { useRef, useState } from 'react';
import { Star } from 'lucide-react';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// Display:  <StarRating value={4.35} count={23} />
// Input:    <StarRating value={score} onChange={setScore} label="Rating.score" />
// max defaults to 5 to match CHECK (score BETWEEN 1 AND 5).
export default function StarRating({ value = 0, onChange, count, max = 5, size = 14, showValue = true, label = 'Rating' }) {
  if (onChange) return <StarInput value={value} onChange={onChange} max={max} label={label} />;

  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  const icons = Array.from({ length: max }, (_, i) => <Star key={i} size={size} strokeWidth={1.5} aria-hidden="true" />);

  return (
    <span className="stars" role="img" aria-label={`${value ? value.toFixed(2) : 'No'} out of ${max}${count !== undefined ? `, ${count} ratings` : ''}`}>
      <span className="stars__row">
        <span className="stars__icons">{icons}</span>
        <span className="stars__icons stars__icons--fill" style={{ width: `${pct}%` }}>
          {icons}
        </span>
      </span>
      {showValue && <span className="stars__value">{value ? value.toFixed(2) : '—'}</span>}
      {count !== undefined && <span className="stars__count">({count})</span>}
    </span>
  );
}

// Radio group: arrow keys move and select, like a native radio set.
function StarInput({ value, onChange, max, label }) {
  const [hover, setHover] = useState(0);
  const refs = useRef([]);
  const shown = hover || value;

  function onKeyDown(e) {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, (value || 0) + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, (value || 1) - 1);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  }

  return (
    <span className="stars stars--input">
      <span className="stars__radios" role="radiogroup" aria-label={label} onKeyDown={onKeyDown} onMouseLeave={() => setHover(0)}>
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          const checked = value === n;
          return (
            <button
              key={n}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${n} of ${max} — ${WORDS[n] || ''}`}
              tabIndex={checked || (!value && n === 1) ? 0 : -1}
              className={`stars__radio${n <= shown ? ' stars__radio--on' : ''}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => onChange(n)}
            >
              <Star strokeWidth={1.5} aria-hidden="true" />
            </button>
          );
        })}
      </span>
      <span className="stars__word" aria-hidden="true">
        {shown ? (
          <>
            <span className="num">{shown}</span> — {WORDS[shown]}
          </>
        ) : (
          'Not rated'
        )}
      </span>
    </span>
  );
}
