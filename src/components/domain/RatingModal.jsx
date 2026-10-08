import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Modal, StarRating, Textarea, Tooltip } from '../ui';
import { LIMITS, RATING_RANGE } from '../../data/schema.js';
import ErrorNote from './ErrorNote.jsx';

// Three sub-scores are collected, averaged and rounded into the single
// Rating.score column the Review 1 schema stores (§7.5). Keeping them as
// their own columns — or their own table — is a 4NF question for later.
const DIMENSIONS = [
  { key: 'completeness', label: 'Completeness', hint: 'Does it cover the whole unit?' },
  { key: 'legibility', label: 'Legibility', hint: 'Can you actually read it?' },
  { key: 'accuracy', label: 'Accuracy', hint: 'Are the answers right?' },
];

export default function RatingModal({ open, material, title = 'Rate this material', description, submitLabel = 'Submit rating', onClose, onSubmit }) {
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setScores({});
      setComment('');
      setError(null);
    }
  }, [open]);

  const given = DIMENSIONS.map((d) => scores[d.key]).filter(Boolean);
  const complete = given.length === DIMENSIONS.length;
  const mean = complete ? given.reduce((a, b) => a + b, 0) / DIMENSIONS.length : null;
  const stored = complete ? Math.round(mean) : null;

  async function submit(e) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Sending the three parts: the data layer does the averaging, exactly
      // as a stored procedure would.
      await onSubmit({ ...scores, comment: comment.trim() || null, score: stored });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Star} loading={busy} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form className="stack gap-4" onSubmit={submit}>
        {material && (
          <p className="serif" style={{ fontSize: 'var(--fs-md)' }}>
            {material.title} <span className="mono xsmall faint">#{material.material_id}</span>
          </p>
        )}

        <fieldset className="dims">
          <legend className="field__label" style={{ width: '100%' }}>
            <span>Score each part</span>
            <span className="field__col">Rating.score</span>
          </legend>
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="dims__row">
              <div className="stack gap-1">
                <span className="dims__label">{d.label}</span>
                <span className="xsmall faint">{d.hint}</span>
              </div>
              <StarRating value={scores[d.key] || 0} onChange={(v) => setScores((s) => ({ ...s, [d.key]: v }))} max={RATING_RANGE.max} label={d.label} />
            </div>
          ))}
        </fieldset>

        <Tooltip content="The three parts are averaged into one INT so the Review 1 schema stays untouched. Storing them separately is a candidate 4NF extension for the final review.">
          <div className="dims__result" tabIndex={0}>
            <span className="eyebrow">Stored as</span>
            <span className="mono small">
              Rating.score = <span className="num">{stored ?? '—'}</span>
            </span>
            <span className="xsmall faint">{complete ? `ROUND(AVG(${given.join(', ')})) = ROUND(${mean.toFixed(2)})` : 'Score all three to see the value that will be inserted.'}</span>
          </div>
        </Tooltip>

        <Textarea
          label="Comment (optional)"
          column="Rating.comment"
          maxLength={LIMITS['Rating.comment']}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What was useful? What was missing?"
        />
        <ErrorNote error={error} />
      </form>
    </Modal>
  );
}
