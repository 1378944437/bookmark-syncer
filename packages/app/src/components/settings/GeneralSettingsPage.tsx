/**
 * 偏好与设备设置子页面
 * 整合设备身份备注、外观主题与界面语言
 */
import { useEffect, useState } from 'react'
import { Check, Copy, Laptop, Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useI18n, writeLanguageSetting, type LanguageSetting } from '../../i18n'
import { getDeviceIdentity } from '../../application'
import { useStorage } from '../../hooks/useStorage'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../infrastructure/utils/format'
import { SubPageHeader } from './SettingsShared'
import { SettingGroup } from './SettingRow'
import { SettingsMigrationSection } from './SettingsMigrationSection'
import { DangerZoneSection } from './DangerZoneSection'
import { Input } from '../Input'
import { Label } from '../Label'

const THEME_OPTIONS = [
  { value: 'light' as const, icon: Sun, labelKey: 'theme.light' },
  { value: 'dark' as const, icon: Moon, labelKey: 'theme.dark' },
  { value: 'system' as const, icon: Monitor, labelKey: 'theme.system' },
]

export function GeneralSettingsPage({ onBack }: { onBack: () => void }) {
  const { t, locale } = useI18n()
  const [languageSetting, setLanguageSetting] = useStorage<LanguageSetting>('app_language', 'auto')
  const [deviceName, setDeviceName] = useStorage('device_name', '')
  const [deviceIdShort, setDeviceIdShort] = useState('')
  const [fullDeviceId, setFullDeviceId] = useState('')
  const [copied, setCopied] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    getDeviceIdentity().then((d) => {
      setDeviceIdShort(d.deviceId.slice(0, 8))
      setFullDeviceId(d.deviceId)
    })
  }, [])

  const handleCopyDeviceId = async () => {
    if (!fullDeviceId) return
    try {
      await navigator.clipboard.writeText(fullDeviceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 容错降级
    }
  }

  const handleLanguageChange = async (value: LanguageSetting) => {
    setLanguageSetting(value)
    await writeLanguageSetting(value)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.general.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 设备标识 */}
        <SettingGroup title={t('settings.sync.deviceSection')}>
          <div className="p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>{t('settings.sync.deviceName')}</span>
                </Label>
                <button
                  type="button"
                  onClick={handleCopyDeviceId}
                  title={fullDeviceId || 'Device ID'}
                  className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 hover:text-foreground transition-colors px-1.5 py-0.5 rounded bg-muted/40 hover:bg-muted/70 cursor-pointer"
                >
                  <span>ID: {deviceIdShort || '········'}</span>
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-70" />
                  )}
                </button>
              </div>
              <Input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder={t('settings.sync.deviceNamePlaceholder')}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </SettingGroup>

        {/* 外观主题 */}
        <SettingGroup title={t('settings.general.appearance')}>
          <div className="p-3.5 space-y-2">
            <p className="text-[11px] text-muted-foreground">{t('settings.general.appearanceDesc')}</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border py-2 text-xs transition-colors',
                    theme === value
                      ? 'border-primary/60 bg-primary/10 text-foreground font-medium shadow-sm'
                      : 'border-border/70 text-muted-foreground hover:bg-secondary/60'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </SettingGroup>

        {/* 显示语言 */}
        <SettingGroup title={t('settings.general.language')}>
          <div className="p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">{t('settings.general.languageDesc')}</p>
            </div>
            <select
              value={languageSetting}
              onChange={(e) => handleLanguageChange(e.target.value as LanguageSetting)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none"
            >
              <option value="auto">{t('settings.general.language.auto')}</option>
              <option value="zh-CN">{t('settings.general.language.zh-CN')}</option>
              <option value="en">{t('settings.general.language.en')}</option>
            </select>
            {languageSetting === 'auto' && (
              <p className="text-[10px] text-muted-foreground">
                ({t('settings.general.currentLocale')}: {locale})
              </p>
            )}
          </div>
        </SettingGroup>

        {/* 配置迁移与备份 */}
        <SettingsMigrationSection />

        {/* 危险操作区 */}
        <DangerZoneSection />
      </div>
    </div>
  )
}
