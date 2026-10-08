import { useEffect, useId, useRef, useState } from 'react';

// Menu button. Arrow keys move, Enter/Space selects, Esc closes and
// returns focus to the trigger; clicking outside closes.
//   <Dropdown align="right" label="Account"
//     trigger={(props) => <Button {...props} variant="ghost">Aarav</Button>}
//     items={[{ label: 'Profile', icon: User, onSelect }, { separator: true },
//             { label: 'Sign out', icon: LogOut, danger: true, onSelect }]} />
export default function Dropdown({ trigger, items, align = 'left', label, heading, footer, onOpenChange, menuClassName = '' }) {
  const [open, setOpen] = useState(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) onOpenChangeRef.current?.(open);
    mounted.current = true;
  }, [open]);
  const menuId = useId();
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  const actionable = items.map((it, i) => (!it.separator && !it.disabled ? i : null)).filter((i) => i !== null);

  function focusItem(pos) {
    const idx = actionable[(pos + actionable.length) % actionable.length];
    itemRefs.current[idx]?.focus();
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return undefined;
    focusItem(0);
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onMenuKeyDown(e) {
    const current = actionable.indexOf(itemRefs.current.indexOf(document.activeElement));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(actionable.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  const triggerProps = {
    ref: triggerRef,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    'aria-label': label,
    onClick: () => setOpen((o) => !o),
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
    },
  };

  return (
    <div className="dropdown" ref={wrapRef}>
      {trigger(triggerProps)}
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={`dropdown__menu dropdown__menu--${align} ${menuClassName}`.trim()} onKeyDown={onMenuKeyDown}>
          {heading && <div className="dropdown__label eyebrow">{heading}</div>}
          {items.map((it, i) =>
            it.separator ? (
              <div key={`sep-${i}`} role="separator" className="dropdown__sep" />
            ) : (
              <button
                key={it.key ?? it.label}
                ref={(el) => (itemRefs.current[i] = el)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={it.disabled}
                className={`dropdown__item${it.danger ? ' dropdown__item--danger' : ''}`}
                onClick={() => {
                  close();
                  it.onSelect?.();
                }}
              >
                {it.icon && <it.icon aria-hidden="true" />}
                <span className="dropdown__text">{it.label}</span>
                {it.hint && <span className="dropdown__hint">{it.hint}</span>}
              </button>
            )
          )}
          {footer && <div className="dropdown__footer">{footer}</div>}
        </div>
      )}
    </div>
  );
}
