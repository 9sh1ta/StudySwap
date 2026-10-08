// Mono initials on a sunk circle with a 1px rule. No colour fills, no photos.
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 'md', className = '', decorative = false }) {
  return (
    <span
      className={`avatar${size !== 'md' ? ` avatar--${size}` : ''} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : name}
    >
      {initials(name)}
    </span>
  );
}
