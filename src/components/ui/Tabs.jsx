import { useId, useRef } from 'react';

// Controlled tabs with roving focus (←/→, Home, End).
//   <Tabs value={tab} onChange={setTab} label="Swap requests"
//         tabs={[{ id: 'in', label: 'Incoming', count: 3 }, …]}>
//     {tab === 'in' && <Incoming />}
//   </Tabs>
export default function Tabs({ tabs, value, onChange, label, children, className = '' }) {
  const baseId = useId();
  const listRef = useRef(null);

  function onKeyDown(e) {
    const i = tabs.findIndex((t) => t.id === value);
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return (
    <div className={className}>
      <div ref={listRef} className="tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              className="tabs__tab"
              onClick={() => onChange(t.id)}
            >
              {t.icon && <t.icon size={16} aria-hidden="true" />}
              {t.label}
              {t.count !== undefined && <span className="tabs__count">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div
        className="tabs__panel"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${value}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
