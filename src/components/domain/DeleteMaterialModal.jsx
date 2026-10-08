import { useEffect, useState } from 'react';
import { Trash2, TriangleAlert } from 'lucide-react';
import { Button, Modal, Skeleton, Table } from '../ui';
import ErrorNote from './ErrorNote.jsx';
import { materials } from '../../api/client.js';

// DELETE with ON DELETE RESTRICT made visible: first count the rows that
// reference the material, then let the user run the DELETE and see the
// database refuse it if anything still points here.
export default function DeleteMaterialModal({ material, userId, onClose, onDeleted }) {
  const [refs, setRefs] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!material) return;
    setRefs(null);
    setError(null);
    materials.references(material.material_id).then(setRefs, setError);
  }, [material]);

  const total = refs ? refs.Rating + refs.Swap_Request : 0;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await materials.remove(material.material_id, userId);
      onDeleted(material);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!material}
      onClose={onClose}
      title="Delete this material?"
      description={material ? `“${material.title}” · material_id ${material.material_id}` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" icon={Trash2} loading={busy} disabled={!refs} onClick={run}>
            {total ? 'Run DELETE anyway' : 'Delete material'}
          </Button>
        </>
      }
    >
      <div className="stack gap-4">
        {!refs && !error && <Skeleton text lines={3} />}
        {refs && total > 0 && (
          <div className="fk-warn">
            <TriangleAlert aria-hidden="true" />
            <div className="stack gap-2">
              <p>
                <strong>Other rows still reference this material.</strong> Every foreign key to <span className="mono">Material</span> is declared{' '}
                <span className="mono">ON DELETE RESTRICT</span>, so the database will refuse the DELETE rather than orphan them.
              </p>
            </div>
          </div>
        )}
        {refs && (
          <Table
            dense
            rowKey="table"
            rows={[
              { table: 'Rating', column: 'material_id', count: refs.Rating },
              { table: 'Swap_Request', column: 'material_id', count: refs.Swap_Request },
            ]}
            columns={[
              { key: 'table', header: 'Referencing table', type: 'mono' },
              { key: 'column', header: 'FK column', type: 'mono' },
              { key: 'count', header: 'Rows', type: 'num' },
            ]}
          />
        )}
        {refs && total === 0 && <p className="muted">Nothing references it, so the DELETE will succeed.</p>}
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}
