import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';

// There are no real files in the prototype, so each page is drawn from
// the material's id: a ruled sheet with a header block and "handwriting"
// or typed lines. Deterministic, so the same material always looks the same.
function rng(seed) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

export function PageSheet({ materialId, page, type, title, small = false }) {
  const rand = rng(materialId * 97 + page * 13);
  const lines = [];
  const handwritten = type === 'Notes' && materialId % 3 !== 0;
  const top = page === 1 ? 64 : 22;
  for (let y = top; y < 262; y += 12) {
    if (rand() < 0.1) continue; // paragraph gap
    const w = 40 + rand() * 120;
    lines.push({ y, w, indent: rand() < 0.15 ? 12 : 0 });
  }
  return (
    <svg viewBox="0 0 200 280" className={`sheet${small ? ' sheet--small' : ''}`} role="img" aria-label={`Page ${page} preview`}>
      <rect x="0.5" y="0.5" width="199" height="279" className="sheet__paper" />
      {Array.from({ length: 21 }, (_, i) => (
        <line key={i} x1="0" x2="200" y1={22 + i * 12} y2={22 + i * 12} className="sheet__rule" />
      ))}
      <line x1="24" x2="24" y1="0" y2="280" className="sheet__margin" />
      {page === 1 && (
        <>
          <rect x="32" y="16" width="120" height="9" className="sheet__head" />
          <rect x="32" y="31" width="80" height="5" className="sheet__ink" opacity=".5" />
          <text x="32" y="52" className="sheet__label">
            {type.toUpperCase()} · #{materialId}
          </text>
        </>
      )}
      {lines.map((l, i) =>
        handwritten ? (
          <path
            key={i}
            d={`M ${32 + l.indent} ${l.y - 3} q 6 -3 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0`}
            className="sheet__hand"
            strokeDasharray={`${l.w} 400`}
          />
        ) : (
          <rect key={i} x={32 + l.indent} y={l.y - 5} width={l.w} height="3" className="sheet__ink" />
        )
      )}
      {title && page === 1 && <title>{title}</title>}
    </svg>
  );
}

// Framed preview with page navigation and a thumbnail strip.
export default function MaterialPreview({ material }) {
  const pages = Math.max(1, material._ui?.pageCount || 1);
  const [page, setPage] = useState(1);
  const thumbs = Array.from({ length: Math.min(pages, 6) }, (_, i) => i + 1);
  return (
    <div className="preview">
      <div className="preview__frame">
        <PageSheet materialId={material.material_id} page={page} type={material.material_type} title={material.title} />
      </div>
      <div className="preview__nav">
        <Button variant="ghost" size="sm" icon={ChevronLeft} aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
        <span className="small muted">
          Page <span className="num">{page}</span> of <span className="num">{pages}</span>
        </span>
        <Button variant="ghost" size="sm" icon={ChevronRight} aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} />
      </div>
      <div className="preview__thumbs" role="list" aria-label="Pages">
        {thumbs.map((p) => (
          <button key={p} type="button" role="listitem" className="preview__thumb" aria-current={p === page ? 'true' : undefined} aria-label={`Page ${p}`} onClick={() => setPage(p)}>
            <PageSheet materialId={material.material_id} page={p} type={material.material_type} small />
          </button>
        ))}
        {pages > 6 && <span className="xsmall faint preview__more">+{pages - 6} more</span>}
      </div>
    </div>
  );
}
