import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import Skeleton from './Skeleton.jsx';

// First-class data table.
//   columns: [{ key, header, align: 'left'|'right'|'center', type: 'id'|'num'|'mono',
//               sortable, sortValue: (row) => any, render: (row) => node, width }]
//   rows, rowKey ('material_id' or fn), maxHeight (sticky header scrolls inside),
//   sort / onSortChange (controlled) or defaultSort { key, dir } (uncontrolled),
//   onRowClick, loading, empty (node), dense, zebra, caption.
// Numbers are right-aligned by default when type is 'num' or 'id'.
export default function Table({
  columns,
  rows = [],
  rowKey = 'id',
  maxHeight,
  sort: sortProp,
  onSortChange,
  defaultSort = null,
  onRowClick,
  loading = false,
  loadingRows = 5,
  empty = 'No rows.',
  dense = false,
  zebra = false,
  caption,
  className = '',
}) {
  const [sortState, setSortState] = useState(defaultSort);
  const sort = sortProp !== undefined ? sortProp : sortState;

  const sorted = useMemo(() => {
    if (!sort || onSortChange) return rows; // controlled: parent sorts (e.g. server-side)
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = col.sortValue || ((r) => r[col.key]);
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
  }, [rows, sort, columns, onSortChange]);

  function toggleSort(key) {
    const next =
      !sort || sort.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null;
    if (onSortChange) onSortChange(next);
    else setSortState(next);
  }

  const keyOf = (row, i) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? i);
  const alignOf = (c) => c.align || (c.type === 'num' ? 'right' : 'left');

  const cls = [
    'table',
    dense && 'table--dense',
    zebra && 'table--zebra',
    onRowClick && 'table--clickable',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`table-wrap ${className}`.trim()} style={maxHeight ? { maxHeight } : undefined} tabIndex={maxHeight ? 0 : undefined}>
      <table className={cls}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined;
              const Caret = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
              return (
                <th key={c.key} scope="col" className={`align-${alignOf(c)}`} style={c.width ? { width: c.width } : undefined} aria-sort={ariaSort}>
                  {c.sortable ? (
                    <button type="button" className={`table__sort${active ? ' table__sort--active' : ''}`} onClick={() => toggleSort(c.key)}>
                      {c.header}
                      <Caret aria-hidden="true" />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: loadingRows }, (_, i) => (
              <tr key={`sk-${i}`} aria-hidden="true">
                {columns.map((c) => (
                  <td key={c.key} className={`align-${alignOf(c)}`}>
                    <Skeleton height={12} width={c.type === 'num' || c.type === 'id' ? 40 : '70%'} style={{ display: 'inline-block' }} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && sorted.length === 0 && (
            <tr>
              <td className="table__empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          )}
          {!loading &&
            sorted.map((row, i) => (
              <tr
                key={keyOf(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={[`align-${alignOf(c)}`, c.type].filter(Boolean).join(' ')}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
