import { CircleCheck, CircleDot, CircleX, Clock } from 'lucide-react';

// Swap_Request.status → tone + icon. Status is never shown by colour alone.
const STATUS = {
  Pending:   { tone: 'warn',   icon: Clock },
  Accepted:  { tone: 'ok',     icon: CircleCheck },
  Rejected:  { tone: 'danger', icon: CircleX },
  Completed: { tone: 'muted',  icon: CircleDot },
};

// <Badge>PYQ</Badge>   <Badge tone="accent" icon={Star}>Top</Badge>   <Badge status="Pending" />
export default function Badge({ tone = 'neutral', icon: Icon, status, className = '', children, ...rest }) {
  if (status) {
    const s = STATUS[status] || { tone: 'neutral' };
    tone = s.tone;
    Icon = Icon || s.icon;
    children = children || status;
  }
  return (
    <span className={`badge${tone !== 'neutral' ? ` badge--${tone}` : ''} ${className}`.trim()} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}
