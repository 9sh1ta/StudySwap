import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Badge, Button, Modal, Select, Textarea } from '../ui';
import { LIMITS } from '../../data/schema.js';
import { materials as materialsApi } from '../../api/client.js';
import { subjectClass } from '../../lib/format.js';

// Collects a Swap_Request: message (VARCHAR 255) and an optional offer of
// one of your own materials. Pass `material` for a fixed target, or
// `choices` (the other student's uploads) to let the user pick one.
// `onSubmit({ material_id, message, offer_material_id })` runs after the
// dialog closes, so the caller can update optimistically and roll back.
export default function RequestSwapModal({ open, material, choices, userId, onClose, onSubmit }) {
  const [message, setMessage] = useState('');
  const [offer, setOffer] = useState('');
  const [target, setTarget] = useState('');
  const [mine, setMine] = useState([]);

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setOffer('');
    setTarget(choices?.[0]?.material_id ? String(choices[0].material_id) : '');
    materialsApi.byUploader(userId).then(setMine, () => setMine([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const selected = material || choices?.find((c) => String(c.material_id) === target);

  function submit(e) {
    e?.preventDefault();
    if (!selected) return;
    onClose();
    onSubmit({ material_id: selected.material_id, message: message.trim() || null, offer_material_id: offer ? Number(offer) : null });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request swap"
      description="The uploader sees your message and chooses to accept or reject."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Send} onClick={submit} disabled={!selected}>
            Send request
          </Button>
        </>
      }
    >
      <form className="stack gap-4" onSubmit={submit}>
        {choices && (
          <Select
            label="Material"
            column="Swap_Request.material_id"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            options={choices.map((c) => ({ value: String(c.material_id), label: `${c.title} (${c.material_type})` }))}
          />
        )}
        {selected && (
          <div className={`mini-card ${subjectClass(selected.subject_id)}`}>
            <div className="row between">
              <Badge>{selected.material_type}</Badge>
              <span className="mono xsmall faint">material_id {selected.material_id}</span>
            </div>
            <p className="serif" style={{ fontSize: 'var(--fs-md)' }}>
              {selected.title}
            </p>
            {selected.subject && (
              <p className="small muted">
                {selected.subject.subject_name} · <span className="mono">{selected.subject.code}</span>
              </p>
            )}
          </div>
        )}
        <Textarea
          label="Message"
          column="Swap_Request.message"
          maxLength={LIMITS['Swap_Request.message']}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Say which unit you need and what you can offer back."
        />
        <Select
          label="Offer in return (optional)"
          placeholder={mine.length ? 'Nothing — a one-way request' : 'You have no uploads to offer yet'}
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          disabled={!mine.length}
          options={mine.map((m) => ({ value: String(m.material_id), label: `${m.title} (${m.material_type})` }))}
          hint="Stored with the request so the uploader sees what you can trade back."
        />
      </form>
    </Modal>
  );
}
