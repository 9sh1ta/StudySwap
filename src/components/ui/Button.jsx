import { forwardRef } from 'react';

// <Button variant="primary|secondary|ghost|danger" size="sm|md|lg" icon={Upload}>
// Icon-only buttons (icon, no children) MUST pass aria-label.
// Pass `as={Link}` + `to` to render a router link styled as a button.
const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    block = false,
    as: Tag = 'button',
    className = '',
    children,
    disabled,
    type,
    ...rest
  },
  ref
) {
  const iconOnly = Icon && !children;
  if (iconOnly && !rest['aria-label'] && import.meta.env.DEV) {
    console.warn('Button: icon-only buttons need an aria-label.');
  }
  const cls = [
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    iconOnly && 'btn--icon',
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const tagProps = Tag === 'button' ? { type: type || 'button', disabled: disabled || loading } : {};

  return (
    <Tag ref={ref} className={cls} aria-busy={loading || undefined} {...tagProps} {...rest}>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight aria-hidden="true" />}
    </Tag>
  );
});

export default Button;
