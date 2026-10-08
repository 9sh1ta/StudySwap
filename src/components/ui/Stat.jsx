import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

// A stat is a label, a mono numeral and an optional hint — never a box.
// Group them in <StatRow>, which separates them with vertical rules.
//   <Stat label="Credibility" value="4.21" unit="/ 5" hint="AVG over 23 ratings" />
//   <Stat label="Uploads" value={5} delta={+2} hint="this month" />
export default function Stat({ label, value, unit, hint, delta }) {
  const up = delta > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="stat">
      <span className="eyebrow">{label}</span>
      <span className="stat__value">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </span>
      {(hint || delta) && (
        <span className="stat__hint">
          {!!delta && (
            <span className={`row gap-1 nowrap stat__delta--${up ? 'up' : 'down'}`}>
              <Arrow aria-hidden="true" />
              <span className="num">
                {up ? '+' : '−'}
                {Math.abs(delta)}
              </span>
              <span className="sr-only">{up ? 'increase' : 'decrease'}</span>
            </span>
          )}
          {hint}
        </span>
      )}
    </div>
  );
}

export function StatRow({ children, className = '' }) {
  return <div className={`stat-row ${className}`.trim()}>{children}</div>;
}
