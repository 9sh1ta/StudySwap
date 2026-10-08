import { Check, X } from 'lucide-react';

// Pending → Accepted → Completed, drawn with rules and small dots.
// Rejected branches off after Pending in --danger.
export default function StatusStepper({ status }) {
  const rejected = status === 'Rejected';
  const steps = rejected ? ['Pending', 'Rejected'] : ['Pending', 'Accepted', 'Completed'];
  const current = steps.indexOf(status);
  return (
    <ol className={`stepper${rejected ? ' stepper--rejected' : ''}`} aria-label={`Request status: ${status}`}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s} className={`stepper__step stepper__step--${state}${s === 'Rejected' ? ' stepper__step--danger' : ''}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="stepper__dot" aria-hidden="true">
              {state === 'done' && <Check />}
              {s === 'Rejected' && <X />}
            </span>
            <span className="stepper__label">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
