import { useId } from 'react';

// Hairline range input with a mono read-out.
//   <Slider label="Min. uploader credibility" min={0} max={5} step={0.5}
//           value={v} onChange={setV} format={(v) => v.toFixed(1)} />
export default function Slider({ label, value, onChange, min = 0, max = 100, step = 1, format = String, showScale = true }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider__head">
        <label htmlFor={id} className="eyebrow">
          {label}
        </label>
        <output htmlFor={id} className="slider__value">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {showScale && (
        <div className="slider__scale" aria-hidden="true">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      )}
    </div>
  );
}
