import { forwardRef, useId } from 'react';
import Field, { Counter } from './Field.jsx';

// maxLength mirrors the column's VARCHAR limit, e.g. Swap_Request.message → 255.
// The counter is always shown when maxLength is set.
const Textarea = forwardRef(function Textarea(
  { label, column, hint, error, required, disabled, rows = 4, id: idProp, className = '', ...rest },
  ref
) {
  const autoId = useId();
  const id = idProp || autoId;
  const cls = ['control', error && 'control--error', disabled && 'control--disabled', className].filter(Boolean).join(' ');

  return (
    <Field
      id={id}
      label={label}
      column={column}
      required={required}
      hint={hint}
      error={error}
      counter={rest.maxLength ? <Counter value={rest.value} max={rest.maxLength} /> : null}
    >
      <div className={cls}>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint || rest.maxLength ? `${id}-msg` : undefined}
          {...rest}
        />
      </div>
    </Field>
  );
});

export default Textarea;
