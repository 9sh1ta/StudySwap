import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import Field from './Field.jsx';

// Options come from schema.js — never hardcode them in JSX.
//   <Select label="Material type" options={MATERIAL_TYPES} placeholder="Any type" />
// options: string[] or { value, label, disabled }[]. Groups: { group, options: [...] }.
const Select = forwardRef(function Select(
  { label, column, hint, error, options = [], placeholder, required, disabled, id: idProp, className = '', ...rest },
  ref
) {
  const autoId = useId();
  const id = idProp || autoId;
  const cls = ['control', error && 'control--error', disabled && 'control--disabled', className].filter(Boolean).join(' ');

  return (
    <Field id={id} label={label} column={column} required={required} hint={hint} error={error}>
      <div className={cls}>
        <select
          ref={ref}
          id={id}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) =>
            o && o.group ? (
              <optgroup key={o.group} label={o.group}>
                {o.options.map(renderOption)}
              </optgroup>
            ) : (
              renderOption(o)
            )
          )}
        </select>
        <ChevronDown className="control__chevron" aria-hidden="true" />
      </div>
    </Field>
  );
});

function renderOption(o) {
  const opt = typeof o === 'object' ? o : { value: o, label: String(o) };
  return (
    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
      {opt.label}
    </option>
  );
}

export default Select;
