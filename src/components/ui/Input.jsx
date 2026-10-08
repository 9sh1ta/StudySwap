import { forwardRef, useId } from 'react';
import Field, { Counter } from './Field.jsx';

// <Input label="Institutional email" column="Student.email" icon={Mail}
//        error="Campus email required" maxLength={100} showCount />
const Input = forwardRef(function Input(
  {
    label,
    column,
    hint,
    error,
    success,
    icon: Icon,
    suffix,
    mono = false,
    showCount = false,
    required,
    disabled,
    id: idProp,
    className = '',
    ...rest
  },
  ref
) {
  const autoId = useId();
  const id = idProp || autoId;
  const described = error || success || hint || showCount ? `${id}-msg` : undefined;
  const cls = [
    'control',
    error && 'control--error',
    disabled && 'control--disabled',
    mono && 'control--mono',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Field
      id={id}
      label={label}
      column={column}
      required={required}
      hint={hint}
      error={error}
      success={success}
      counter={showCount && rest.maxLength ? <Counter value={rest.value} max={rest.maxLength} /> : null}
    >
      <div className={cls}>
        {Icon && (
          <span className="control__adorn control__adorn--left" aria-hidden="true">
            <Icon />
          </span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          {...rest}
        />
        {suffix && <span className="control__adorn control__adorn--right">{suffix}</span>}
      </div>
    </Field>
  );
});

export default Input;
