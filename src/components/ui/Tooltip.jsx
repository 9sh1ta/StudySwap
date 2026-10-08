import { cloneElement, isValidElement, useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 6;

// Shows on hover and keyboard focus; Esc hides it.
//   <Tooltip content="Uploaded 14 Mar 2026, 10:42"><time>3 days ago</time></Tooltip>
// The child must be a single element that can take a ref-less event handler
// (any DOM element or a component that forwards props to one).
export default function Tooltip({ content, children, placement = 'top', delay = 250 }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchor = useRef(null);
  const tip = useRef(null);
  const timer = useRef(null);

  const show = useCallback(
    (e) => {
      anchor.current = e.currentTarget;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(true), delay);
    },
    [delay]
  );
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return undefined;
    const a = anchor.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    let top = placement === 'bottom' ? a.bottom + GAP : a.top - t.height - GAP;
    if (top < 4) top = a.bottom + GAP; // flip when there is no room above
    if (top + t.height > window.innerHeight - 4) top = a.top - t.height - GAP;
    let left = a.left + a.width / 2 - t.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
    setPos({ top, left });

    const onKey = (e) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, placement, hide]);

  if (!content || !isValidElement(children)) return children;

  const merge = (ours, theirs) => (e) => {
    theirs?.(e);
    ours(e);
  };

  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : children.props['aria-describedby'],
    onMouseEnter: merge(show, children.props.onMouseEnter),
    onMouseLeave: merge(hide, children.props.onMouseLeave),
    onFocus: merge(show, children.props.onFocus),
    onBlur: merge(hide, children.props.onBlur),
  });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            className="tooltip"
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
