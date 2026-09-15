import { useState } from 'react';
import { toast } from 'sonner';
import { useStorage } from '../../hooks/useStorage';
import { useI18n } from '../../i18n';
import { restoreLocalSnapshotInBackground } from '../../application/background-ops';
import type { RecoveryRecord } from '../../core/sync/recovery';
import { Button } from '../Button';
import { Modal } from '../Modal';

export function RecoveryNotice() {
  const { t } = useI18n();
  const [recovery] = useStorage<RecoveryRecord | null>('bookmark_recovery', null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!recovery) return null;
  const restore = async () => {
    setBusy(true);
    try {
      const result = await restoreLocalSnapshotInBackground(recovery.snapshotId);
      if (!result.success) throw new Error(result.message);
      setConfirm(false); toast.success(result.message);
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };
  return <div role="alert" className="border border-amber-500 rounded-xl p-3 space-y-2">
    <p className="text-sm">{t('repair.recoveryNotice', { id: recovery.snapshotId })}</p>
    <Button onClick={() => setConfirm(true)}>{t('repair.recover')}</Button>
    <Modal isOpen={confirm} onClose={() => { if (!busy) setConfirm(false); }} title={t('repair.recover')}>
      <p className="text-sm mb-3">{t('repair.recoveryConfirm')}</p>
      <Button disabled={busy} onClick={() => void restore()}>{t('common.confirm')}</Button>
    </Modal>
  </div>;
}
