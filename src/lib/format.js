// Display formatting shared by every screen.
// Rule from the design system: relative dates in the UI, absolute in the tooltip.

const DAY = 86400000;

function parse(iso) {
  // DATE columns are 'YYYY-MM-DD'; read them as local noon to dodge TZ edges.
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

export function relativeDate(iso) {
  if (!iso) return '—';
  const d = parse(iso);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const days = Math.round((now - d) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return '1 month ago';
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export function absoluteDate(iso) {
  if (!iso) return '';
  return parse(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortDate(iso) {
  if (!iso) return '—';
  return parse(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function monthLabel(yyyyMm) {
  return new Date(`${yyyyMm}-15T12:00:00`).toLocaleDateString('en-IN', { month: 'short' });
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function score(v) {
  return v === null || v === undefined ? '—' : Number(v).toFixed(2);
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Spine colour class for a subject: sub-1 … sub-6.
export function subjectClass(subjectId) {
  return `sub-${((Number(subjectId) - 1) % 6) + 1}`;
}

export const firstName = (name = '') => name.split(' ')[0];
