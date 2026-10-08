import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, Modal, Textarea } from '../ui';

// Reject a Pending request with an optional reason shown to the requester.
export default function RejectModal({ request, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (request) setReason('');
  }, [request]);
  return (
    <Modal
      open={!!request}
      onClose={onClose}
      size="sm"
      title="Reject this request?"
      description={request ? `${request.requester?.name} asked for “${request.material?.title}”.` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep pending
          </Button>
          <Button variant="danger" icon={X} onClick={() => onConfirm(reason.trim() || null)}>
            Reject request
          </Button>
        </>
      }
    >
      <Textarea label="Reason (optional)" maxLength={200} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I'm updating these notes — ask again next week." hint="Shown to the requester. Sets status = 'Rejected' and response_date = CURRENT_DATE." />
    </Modal>
  );
}
