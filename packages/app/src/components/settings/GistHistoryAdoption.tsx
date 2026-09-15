import { useState } from 'react';
import { toast } from 'sonner';
import type { GistConfig, CloudBackupFile } from '../../core/storage/types';
import { getCloudBackupList } from '../../core/sync/cloud-operations';
import { adoptBackupInBackground } from '../../application/background-ops';
import { useI18n } from '../../i18n';
import { Button } from '../Button';

export function GistHistoryAdoption({ config }: { config: GistConfig }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<CloudBackupFile[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (adopt: boolean) => {
    setBusy(true);
    try {
      if (adopt) {
        const result = await adoptBackupInBackground(config, selected);
        if (!result.success) throw new Error(result.message);
        setFiles([]); setSelected(''); toast.success(result.message);
      } else { setFiles(await getCloudBackupList(config, true)); setSelected(''); }
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <Button variant="outline" disabled={busy || !config.gistId} onClick={() => void run(false)}>{t('repair.gistHistory')}</Button>
    {files.length > 0 && <>
      <p className="text-xs text-muted-foreground">{t('repair.gistChooseHint')}</p>
      <select aria-label={t('repair.gistCurrent')} className="w-full bg-background border rounded p-2 text-xs" value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">{t('repair.gistCurrent')}</option>
        {files.map(file => <option key={file.path} value={file.path}>{file.name}</option>)}
      </select>
      <Button disabled={!selected || busy} onClick={() => void run(true)}>{t('common.confirm')}</Button>
    </>}
  </div>;
}
