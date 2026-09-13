/**
 * 同步策略子页面
 * 专注于同步行为：按触发机制、同步范围、高级规则清晰分三组
 */
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Clock, FolderTree, RefreshCw, Sliders } from 'lucide-react'
import { updateScheduledSync } from '../../application'
import { SYNC_SCOPE_KEYS, type SyncScope } from '../../core/bookmark'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { SubPageHeader } from './SettingsShared'
import { SettingGroup, SettingRow } from './SettingRow'
import { Input } from '../Input'

export function SyncSettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [autoSyncEnabled, setAutoSyncEnabled] = useStorage('auto_sync_enabled', true)
  const [scheduledSyncEnabled, setScheduledSyncEnabled] = useStorage('scheduled_sync_enabled', false)
  const [scheduledSyncInterval, setScheduledSyncInterval] = useStorage('scheduled_sync_interval', 30)
  const [backupFileInterval, setBackupFileInterval] = useStorage('backup_file_interval', 1)
  const [missingFolderFallback, setMissingFolderFallback] = useStorage('missing_folder_fallback', false)
  const [syncScope, setSyncScope] = useStorage<SyncScope>('sync_scope', {
    'bookmarks-bar': true,
    other: false,
    mobile: false,
  })

  // 同步范围校验：至少保留一项
  const updateSyncScope = (key: keyof SyncScope, value: boolean) => {
    if (!value && !SYNC_SCOPE_KEYS.some((k) => k !== key && syncScope[k])) {
      toast.error(t('settings.sync.scopeAllOff'))
      return
    }
    setSyncScope({ ...syncScope, [key]: value })
  }

  // 监听定时同步变化，立即同步 Alarm
  useEffect(() => {
    updateScheduledSync().catch((error) => {
      console.error('[Settings] Failed to update scheduled sync:', error)
    })
  }, [scheduledSyncEnabled, scheduledSyncInterval])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.sync.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 触发机制 */}
        <SettingGroup title={t('settings.sync.groupTrigger')}>
          <SettingRow
            icon={RefreshCw}
            iconColor="text-indigo-600 bg-indigo-500/10 dark:text-indigo-400"
            label={t('settings.sync.autoSync')}
            description={t('settings.sync.autoSyncDesc')}
            type="switch"
            checked={autoSyncEnabled}
            onCheckedChange={setAutoSyncEnabled}
          />
          <SettingRow
            icon={Clock}
            iconColor="text-sky-600 bg-sky-500/10 dark:text-sky-400"
            label={t('settings.sync.scheduled')}
            description={t('settings.sync.scheduledDesc')}
            type="switch"
            checked={scheduledSyncEnabled}
            onCheckedChange={setScheduledSyncEnabled}
          />
          {scheduledSyncEnabled && (
            <div className="p-3.5 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground font-medium">{t('settings.sync.interval')}</span>
                <span className="text-[11px] text-muted-foreground">{scheduledSyncInterval} min</span>
              </div>
              <Input
                type="number"
                min={1}
                max={1440}
                value={scheduledSyncInterval}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val) && val >= 1 && val <= 1440) setScheduledSyncInterval(val)
                }}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">{t('settings.sync.intervalHint')}</p>
            </div>
          )}
        </SettingGroup>

        {/* 同步范围 */}
        <SettingGroup title={t('settings.sync.groupScope')}>
          <div className="px-3.5 py-2 bg-muted/20 border-b border-border/50">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t('settings.sync.scopeHint')}</p>
          </div>
          {SYNC_SCOPE_KEYS.map((key) => (
            <SettingRow
              key={key}
              icon={FolderTree}
              iconColor="text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
              label={t(`settings.sync.scope_${key.replace(/-/g, '_')}`)}
              type="switch"
              checked={syncScope[key]}
              onCheckedChange={(checked) => updateSyncScope(key, checked)}
            />
          ))}
        </SettingGroup>

        {/* 高级规则 */}
        <SettingGroup title={t('settings.sync.groupAdvanced')}>
          <SettingRow
            icon={Sliders}
            iconColor="text-amber-600 bg-amber-500/10 dark:text-amber-400"
            label={t('settings.sync.missingFolderFallback')}
            description={t('settings.sync.missingFolderFallbackDesc')}
            type="switch"
            checked={missingFolderFallback}
            onCheckedChange={setMissingFolderFallback}
          />
          <SettingRow
            label={t('settings.sync.backupInterval')}
            description={t('settings.sync.backupIntervalHint')}
            type="select"
          >
            <select
              value={backupFileInterval}
              onChange={(e) => setBackupFileInterval(parseInt(e.target.value, 10))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground focus:outline-none"
            >
              <option value={1}>{t('settings.sync.minute1')}</option>
              <option value={5}>{t('settings.sync.minute5')}</option>
              <option value={10}>{t('settings.sync.minute10')}</option>
              <option value={30}>{t('settings.sync.minute30')}</option>
            </select>
          </SettingRow>
        </SettingGroup>
      </div>
    </div>
  )
}
