import { Award, ShieldCheck, Sprout } from 'lucide-react';
import { credibilityTier } from '../../data/schema.js';
import Tooltip from '../ui/Tooltip.jsx';

const TIER_ICON = { top: Award, trusted: ShieldCheck, new: Sprout };

function derivation(score, count) {
  if (!count) return 'No ratings yet — AVG(score) over 0 ratings is NULL';
  return `AVG(score) over ${count} rating${count === 1 ? '' : 's'} = ${Number(score).toFixed(2)}`;
}

// The tier label on its own — shown beside a student's name everywhere.
export function TierLabel({ score, count, withTooltip = true }) {
  const tier = credibilityTier(score, count);
  const Icon = TIER_ICON[tier.id];
  const label = (
    <span className={`tier tier--${tier.id}`} tabIndex={withTooltip ? 0 : undefined}>
      <Icon aria-hidden="true" />
      {tier.label}
    </span>
  );
  return withTooltip ? <Tooltip content={<span className="mono">{derivation(score, count)}</span>}>{label}</Tooltip> : label;
}

// Five one-point segments, each filled by the fraction of that point earned.
function Segments({ score }) {
  const s = score ?? 0;
  return (
    <span className="cred__segs" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="cred__seg">
          <span className="cred__fill" style={{ width: `${Math.max(0, Math.min(1, s - i)) * 100}%` }} />
        </span>
      ))}
    </span>
  );
}

// A printed mark: score in mono, a 5-segment rule, tier label in small caps.
//   size="lg" for profile / dashboard headers, "sm" inline in cards and rows.
export default function CredibilityMark({ score, count = 0, size = 'lg', showDerivation = false }) {
  const tier = credibilityTier(score, count);
  const text = derivation(score, count);
  return (
    <div className={`cred cred--${size}`}>
      <Tooltip content={<span className="mono">{text}</span>}>
        <div className="cred__score" tabIndex={0} aria-label={`Credibility ${score ?? 'not yet rated'}. ${text}. Tier: ${tier.label}.`}>
          <span className="cred__num">{score === null || score === undefined ? '—' : Number(score).toFixed(2)}</span>
          <Segments score={score} />
        </div>
      </Tooltip>
      <TierLabel score={score} count={count} withTooltip={false} />
      {showDerivation && (
        <p className="cred__derivation">
          Computed — <span className="mono">AVG(Rating.score)</span> over <span className="num">{count}</span> rating{count === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
