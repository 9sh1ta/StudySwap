import { useEffect, useMemo, useRef, useState } from 'react';
import { FOREIGN_KEYS, INDEXES, TABLES } from '../../data/schema.js';
import { db } from '../../api/client.js';

// Fixed layout on a 920×580 canvas: the five tables placed the way the ER
// diagram in the documentation places them, with FK lines drawn between
// them. Tables flash as the app queries them.
const LAYOUT = {
  Student: { x: 24, y: 24, w: 216 },
  Subject: { x: 24, y: 356, w: 216 },
  Material: { x: 352, y: 170, w: 232 },
  Swap_Request: { x: 686, y: 24, w: 210 },
  Rating: { x: 686, y: 356, w: 210 },
};
const ROW_H = 19;
const HEAD_H = 34;
const CANVAS = { w: 920, h: 580 };

const heightOf = (table, expanded) => HEAD_H + (expanded ? TABLES[table].columns.length * ROW_H + 8 : 0);

// Anchor on the side of a card facing the other card.
function anchor(from, to, fromH, toH) {
  const fc = { x: from.x + from.w / 2, y: from.y + fromH / 2 };
  const tc = { x: to.x + to.w / 2, y: to.y + toH / 2 };
  const horizontal = Math.abs(tc.x - fc.x) > Math.abs(tc.y - fc.y);
  if (horizontal) {
    return tc.x > fc.x ? { x: from.x + from.w, y: fc.y, side: 'right' } : { x: from.x, y: fc.y, side: 'left' };
  }
  return tc.y > fc.y ? { x: fc.x, y: from.y + fromH, side: 'bottom' } : { x: fc.x, y: from.y, side: 'top' };
}

// Crow's foot (many) drawn at the child end of the relationship.
function crowsFoot({ x, y, side }) {
  const d = 9;
  const s = 6;
  if (side === 'left') return `M ${x - d} ${y - s} L ${x} ${y} L ${x - d} ${y + s} M ${x - d} ${y} L ${x} ${y}`;
  if (side === 'right') return `M ${x + d} ${y - s} L ${x} ${y} L ${x + d} ${y + s} M ${x + d} ${y} L ${x} ${y}`;
  if (side === 'top') return `M ${x - s} ${y - d} L ${x} ${y} L ${x + s} ${y - d} M ${x} ${y - d} L ${x} ${y}`;
  return `M ${x - s} ${y + d} L ${x} ${y} L ${x + s} ${y + d} M ${x} ${y + d} L ${x} ${y}`;
}

// A short bar across the line marks the "one" end.
function oneBar({ x, y, side }) {
  const d = 10;
  const s = 5;
  if (side === 'left' || side === 'right') {
    const px = side === 'left' ? x - d : x + d;
    return `M ${px} ${y - s} L ${px} ${y + s}`;
  }
  const py = side === 'top' ? y - d : y + d;
  return `M ${x - s} ${py} L ${x + s} ${py}`;
}

export default function ERDiagram({ counts, onSelectTable }) {
  const [expanded, setExpanded] = useState({ Material: true });
  const [flash, setFlash] = useState({});
  const timers = useRef({});

  // Flash a table whenever a statement touches it.
  useEffect(() => {
    const off = db.subscribe((entry) => {
      const now = Date.now();
      setFlash((f) => {
        const next = { ...f };
        for (const t of entry.tables || []) next[t] = now;
        return next;
      });
      for (const t of entry.tables || []) {
        clearTimeout(timers.current[t]);
        timers.current[t] = setTimeout(() => setFlash((f) => ({ ...f, [t]: 0 })), 900);
      }
    });
    const pending = timers.current;
    return () => {
      off();
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  const heights = useMemo(() => Object.fromEntries(Object.keys(LAYOUT).map((t) => [t, heightOf(t, expanded[t])])), [expanded]);

  const links = FOREIGN_KEYS.map((fk) => {
    const child = LAYOUT[fk.table];
    const parent = LAYOUT[fk.references];
    const a = anchor(child, parent, heights[fk.table], heights[fk.references]);
    const b = anchor(parent, child, heights[fk.references], heights[fk.table]);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { fk, a, b, mid };
  });

  const fkColumns = new Set(FOREIGN_KEYS.map((f) => `${f.table}.${f.column}`));
  const indexedColumns = new Set(INDEXES.map((i) => `${i.table}.${i.column}`));

  return (
    <div className="er">
      <div className="er__canvas" style={{ width: CANVAS.w, height: CANVAS.h }}>
        <svg className="er__lines" viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`} width={CANVAS.w} height={CANVAS.h} aria-hidden="true">
          {links.map(({ fk, a, b, mid }) => (
            <g key={`${fk.table}.${fk.column}`} className="er__link">
              <path d={`M ${a.x} ${a.y} L ${mid.x} ${a.y} L ${mid.x} ${b.y} L ${b.x} ${b.y}`} className="er__line" fill="none" />
              <path d={crowsFoot(a)} className="er__foot" fill="none" />
              <path d={oneBar(b)} className="er__foot" fill="none" />
            </g>
          ))}
        </svg>

        {Object.entries(LAYOUT).map(([table, pos]) => {
          const def = TABLES[table];
          const isOpen = !!expanded[table];
          return (
            <section
              key={table}
              className={`er__table${flash[table] ? ' er__table--flash' : ''}${isOpen ? ' er__table--open' : ''}`}
              style={{ left: pos.x, top: pos.y, width: pos.w }}
              aria-label={`${table} table`}
            >
              <button
                type="button"
                className="er__head"
                aria-expanded={isOpen}
                onClick={() => {
                  setExpanded((e) => ({ ...e, [table]: !e[table] }));
                  onSelectTable?.(table);
                }}
              >
                <span className="er__name mono">{table}</span>
                <span className="er__count num">{counts?.[table] ?? '—'}</span>
              </button>
              {isOpen && (
                <ul className="er__cols">
                  {def.columns.map((c) => {
                    const key = `${table}.${c.name}`;
                    return (
                      <li key={c.name} className={c.pk ? 'er__col er__col--pk' : fkColumns.has(key) ? 'er__col er__col--fk' : 'er__col'}>
                        <span className="er__marker">{c.pk ? 'PK' : fkColumns.has(key) ? 'FK' : ''}</span>
                        <span className="er__colname mono">{c.name}</span>
                        <span className="er__type">
                          {c.type === 'VARCHAR' ? `VARCHAR(${c.length})` : c.type}
                          {c.notNull && !c.pk ? ' ·' : ''}
                          {c.notNull && !c.pk ? <span className="er__flag"> NN</span> : null}
                          {c.unique ? <span className="er__flag"> UQ</span> : null}
                          {c.check ? <span className="er__flag"> CK</span> : null}
                          {c.derived ? <span className="er__flag er__flag--derived"> derived</span> : null}
                          {indexedColumns.has(key) ? <span className="er__flag er__flag--idx"> idx</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <ul className="er__legend">
        <li>
          <span className="er__marker">PK</span> primary key
        </li>
        <li>
          <span className="er__marker">FK</span> foreign key
        </li>
        <li>
          <span className="er__flag">NN</span> not null · <span className="er__flag">UQ</span> unique · <span className="er__flag">CK</span> check ·{' '}
          <span className="er__flag er__flag--idx">idx</span> indexed
        </li>
        <li>
          <svg width="46" height="12" aria-hidden="true" className="er__legend-svg">
            <path d="M 2 6 L 44 6" className="er__line" fill="none" />
            <path d="M 11 1 L 2 6 L 11 11 M 2 6 L 11 6" className="er__foot" fill="none" />
            <path d="M 38 1 L 38 11" className="er__foot" fill="none" />
          </svg>
          many → one
        </li>
        <li className="er__legend-flash">
          <span className="er__flashdot" aria-hidden="true" /> flashes when the app reads it
        </li>
      </ul>
    </div>
  );
}
