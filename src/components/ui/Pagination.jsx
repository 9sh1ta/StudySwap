import { ChevronLeft, ChevronRight } from 'lucide-react';

// 1 … 4 5 [6] 7 8 … 34 — always shows first, last and two either side.
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const lo = Math.max(2, page - 2);
  const hi = Math.min(pages - 1, page + 2);
  if (lo > 2) out.push('…');
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

//   <Pagination page={2} pageSize={12} total={386} onChange={setPage} noun="materials" />
export default function Pagination({ page, pageSize, total, onChange, noun = 'results' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination__summary">
        Showing <span className="num">{from}–{to}</span> of <span className="num">{total}</span> {noun}
      </p>
      {pages > 1 && (
        <div className="pagination__pages">
          <button
            type="button"
            className="pagination__page"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className="pagination__page"
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            className="pagination__page"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => onChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
