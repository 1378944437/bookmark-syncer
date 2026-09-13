/**
 * 同步设置子页面（自动/定时同步、同步范围、设备标识、端到端加密、备份间隔）
 * 自 SettingsView 拆出
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clock } from 'lucide-react'
import { updateScheduledSync, getDeviceIdentity } from '../../application'
import { SYNC_SCOPE_KEYS, type SyncScope } from '../../core/bookmark'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { Input } from '../Input'
import { Label } from '../Label'
import { SubPageHeader } from './SettingsShared'
import { E2EEncryptionSection } from './E2EEncryptionSection'

// 同步设置子页面
export function SyncSettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [autoSyncEnabled, setAutoSyncEnabled] = useStorage('auto_sync_enabled', true)
  const [scheduledSyncEnabled, setScheduledSyncEnabled] = useStorage('scheduled_sync_enabled', false)
  const [scheduledSyncInterval, setScheduledSyncInterval] = useStorage('scheduled_sync_interval', 30)
  const [backupFileInterval, setBackupFileInterval] = useStorage('backup_file_interval', 1)
  const [missingFolderFallback, setMissingFolderFallback] = useStorage('missing_folder_fallback', false)
  const [deviceName, setDeviceName] = useStorage('device_name', '')
  const [deviceIdShort, setDeviceIdShort] = useState('')
  const [syncScope, setSyncScope] = useStorage<SyncScope>('sync_scope', {
    'bookmarks-bar': true,
    other: false,
    mobile: false,
  })

  // 同步范围：至少保留一项，防止“全关”导致同步静默失效
  const updateSyncScope = (key: keyof SyncScope, value: boolean) => {
    if (!value && !SYNC_SCOPE_KEYS.some((k) => k !== key && syncScope[k])) {
      toast.error(t('settings.sync.scopeAllOff'))
      return
    }
    setSyncScope({ ...syncScope, [key]: value })
  }

  // 监听定时同步配置变化，立即更新 Alarm
  useEffect(() => {
    const updateAlarm = async () => {
      try {
        await updateScheduledSync();
      } catch (error) {
        console.error('[Settings] Failed to update scheduled sync:', error);
      }
    };
    updateAlarm();
  }, [scheduledSyncEnabled, scheduledSyncInterval])

  // 设备标识：首次访问时生成并持久化，这里只取前 8 位用于展示
  useEffect(() => {
    getDeviceIdentity().then((d) => setDeviceIdShort(d.deviceId.slice(0, 8)))
  }, [])



  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.sync.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 自动同步 */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
          <div>
            <Label className="text-foreground">{t('settings.sync.autoSync')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.sync.autoSyncDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) => setAutoSyncEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* 同步范围 */}
        <div className="p-4 rounded-xl bg-secondary/30 space-y-3">
          <div>
            <Label className="text-foreground">{t('settings.sync.scopeSection')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.sync.scopeHint')}</p>
          </div>
          {SYNC_SCOPE_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-foreground">
                {t(`settings.sync.scope_${key.replace(/-/g, '_')}`)}
              </span>
              <input
                type="checkbox"
                checked={syncScope[key]}
                onChange={(e) => updateSyncScope(key, e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
            </label>
          ))}
        </div>

        {/* 定时同步 */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
          <div>
            <Label className="text-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" /> {t('settings.sync.scheduled')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.sync.scheduledDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={scheduledSyncEnabled}
              onChange={(e) => setScheduledSyncEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* 间隔设置 */}
        {scheduledSyncEnabled && (
          <div className="space-y-2 p-4 rounded-xl bg-secondary/30">
            <Label className="text-muted-foreground">{t('settings.sync.interval')}</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={scheduledSyncInterval}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1 && val <= 1440) setScheduledSyncInterval(val)
              }}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.sync.intervalHint')}
            </p>
          </div>
        )}

        {/* 缺失文件夹兜底 */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
          <div>
            <Label className="text-foreground">{t('settings.sync.missingFolderFallback')}</Label>
            <p className="text-xs text-muted-foreground max-w-[70%]">{t('settings.sync.missingFolderFallbackDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={missingFolderFallback}
              onChange={(e) => setMissingFolderFallback(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* 设备标识 */}
        <div className="p-4 rounded-xl bg-secondary/30 space-y-3">
          <div>
            <Label className="text-foreground">{t('settings.sync.deviceSection')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('settings.sync.deviceId')}: <span className="font-mono">{deviceIdShort || '········'}</span>
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">{t('settings.sync.deviceName')}</Label>
            <Input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={t('settings.sync.deviceNamePlaceholder')}
            />
          </div>
        </div>

        <E2EEncryptionSection />

        {/* 备份文件间隔 */}
        <div className="space-y-2 p-4 rounded-xl bg-secondary/30">
          <Label className="text-muted-foreground">{t('settings.sync.backupInterval')}</Label>
          <select
            value={backupFileInterval}
            onChange={(e) => setBackupFileInterval(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
          >
            <option value={1}>{t('settings.sync.minute1')}</option>
            <option value={5}>{t('settings.sync.minute5')}</option>
            <option value={10}>{t('settings.sync.minute10')}</option>
            <option value={30}>{t('settings.sync.minute30')}</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {t('settings.sync.backupIntervalHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
