// Sunk blocks shaped like the real content, with a gentle opacity pulse.
//   <Skeleton width={120} height={16} />   <Skeleton text lines={3} />   <Skeleton circle size={32} />
export default function Skeleton({ width, height, circle, size, text, lines = 1, className = '', style }) {
  if (text) {
    return (
      <span className={className} style={{ display: 'block', ...style }} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="skeleton skeleton--text"
            style={{ width: i === lines - 1 && lines > 1 ? '62%' : width || '100%' }}
          />
        ))}
      </span>
    );
  }
  const w = circle ? size : width;
  const h = circle ? size : height;
  return (
    <span
      className={`skeleton${circle ? ' skeleton--circle' : ''} ${className}`.trim()}
      style={{ width: w, height: h, ...style }}
      aria-hidden="true"
    />
  );
}

// Wraps a loading region so screen readers get one announcement.
export function Loading({ label = 'Loading', children }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
