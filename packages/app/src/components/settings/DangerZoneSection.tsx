import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../Button';
import { maintenanceInBackground } from '../../application/background-ops';
import { useActiveStorage } from '../../hooks/useActiveStorage';
import { useI18n } from '../../i18n';
import type { StorageConfig } from '../../core/storage/types';

type Kind = 'local' | 'cloud' | 'factory';
export function DangerZoneSection() {
  const { t } = useI18n();
  const { isConfigured, getConfig, hostLabel, accountLabel } = useActiveStorage();
  const [pending, setPending] = useState<{ kind: Kind; config: StorageConfig; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await maintenanceInBackground(pending.kind, pending.config);
      toast.success(t('repair.dangerDone'));
      const reload = pending.kind === 'factory';
      setPending(null);
      if (reload) window.location.reload();
    } catch (error) { toast.error(t('repair.dangerFailed'), { description: (error as Error).message }); }
    finally { setBusy(false); }
  };
  const rows: { kind: Kind; title: string; hint: string }[] = [
    { kind: 'local', title: 'repair.dangerLocal', hint: 'repair.dangerLocalHint' },
    { kind: 'cloud', title: 'repair.dangerCloud', hint: 'repair.dangerCloudHint' },
    { kind: 'factory', title: 'repair.dangerFactory', hint: 'repair.dangerFactoryHint' },
  ];
  return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-3.5">
    <h3 className="text-sm text-destructive flex gap-2"><ShieldAlert className="w-4 h-4" />{t('repair.dangerTitle')}</h3>
    <p className="text-xs text-muted-foreground">{t('repair.dangerHint')}</p>
    {rows.map(row => <div key={row.kind} className="p-3 rounded-lg border border-border bg-background space-y-2">
      <h4 className="text-xs font-semibold">{t(row.title)}</h4>
      <p className="text-xs text-muted-foreground">{t(row.hint)}</p>
      {row.kind === 'cloud' && <p className="text-xs break-all">{pending?.kind === 'cloud' ? pending.label : `${hostLabel} · ${accountLabel}`}</p>}
      {pending?.kind === row.kind ? <div className="flex gap-2">
        <Button size="sm" disabled={busy} variant="outline" onClick={() => setPending(null)}>{t('common.cancel')}</Button>
        <Button size="sm" disabled={busy} variant="destructive" onClick={() => void run()}>{busy ? t('common.loading') : t('common.confirm')}</Button>
      </div> : <Button size="sm" variant="outline" disabled={busy || (row.kind === 'cloud' && !isConfigured)} onClick={() => setPending({ kind: row.kind, config: getConfig(), label: `${hostLabel} · ${accountLabel}` })}>{t(row.title)}</Button>}
    </div>)}
  </div>;
}
