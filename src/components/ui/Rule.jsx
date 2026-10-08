// Rules are this app's only depth device. Three shapes:
//   <Rule />                         plain 1px divider
//   <Rule label="Recommended" />     small-caps label followed by a rule
//   <ProgressRule value={0.62} />    a filling rule (upload progress)
//   <SegmentedRule segments={4} filled={3} />  wizard steps, password strength

export default function Rule({ label, strong = false, className = '', as: Tag = 'h3' }) {
  if (!label) return <hr className={`rule${strong ? ' rule-strong' : ''} ${className}`.trim()} />;
  return (
    <div className={`rule-labelled${strong ? ' rule-labelled--strong' : ''} ${className}`.trim()}>
      <Tag className="eyebrow" style={{ margin: 0 }}>
        {label}
      </Tag>
    </div>
  );
}

export function ProgressRule({ value = 0, label, detail }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="progress-rule">
      <div className="progress-rule__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label || 'Progress'}>
        <div className="progress-rule__fill" style={{ width: `${pct}%` }} />
      </div>
      {(label || detail) && (
        <div className="progress-rule__meta">
          <span>{label}</span>
          <span className="num">{detail ?? `${pct}%`}</span>
        </div>
      )}
    </div>
  );
}

// `tone` colours the filled segments via a token name ('accent', 'ok', 'warn', 'danger').
export function SegmentedRule({ segments = 4, filled = 0, tone = 'accent', label, detail, ariaLabel }) {
  return (
    <div className="seg-rule">
      <div
        className="seg-rule__segs"
        style={{ '--seg-c': `var(--${tone})` }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={segments}
        aria-valuenow={filled}
        aria-label={ariaLabel || label || 'Progress'}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={`seg-rule__seg${i < filled ? ' seg-rule__seg--on' : ''}`} />
        ))}
      </div>
      {(label || detail) && (
        <div className="seg-rule__label">
          <span>{label}</span>
          <span>{detail}</span>
        </div>
      )}
    </div>
  );
}
