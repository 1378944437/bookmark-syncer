import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clock, Eye, EyeOff, Globe, Info, Link2, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateScheduledSync, getDeviceIdentity, clearLastBackupFileInfo, getWebDAVConfig } from '../application'
import { SYNC_SCOPE_KEYS, type SyncScope } from '../core/bookmark'
import { smartPushInBackground, webdavTestInBackground } from '../application/background-ops'
import { useI18n, writeLanguageSetting, type LanguageSetting } from '../i18n'
import { useStorage } from '../hooks/useStorage'
import { Button } from './Button'
import { Input } from './Input'
import { Label } from './Label'

type SubPage = 'main' | 'webdav' | 'sync' | 'general' | 'about'

// 设置项组件
function SettingsItem({ icon: Icon, label, description, onClick }: {
  icon: React.ElementType
  label: string
  description?: string
  onClick: () => void
}) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
  )
}

// 子页面头部
function SubPageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={onBack}
        className="w-8 h-8 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-foreground" />
      </button>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </div>
  )
}

// WebDAV 配置子页面
function WebDAVPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [webdavUrl, setWebdavUrl] = useStorage('webdav_url', '')
  const [username, setUsername] = useStorage('webdav_username', '')
  const [password, setPassword] = useStorage('webdav_password', '')
  const [testing, setTesting] = useState(false)

  // 记录上次已保存（挂载时）的配置，用于检测真正的变更
  // 注意：不能直接比较当前 state——用户输入过程中 state 已变化，
  // trim 后再比较当前值是恒等的（死代码）
  const savedUrlRef = useRef(webdavUrl)
  const savedUsernameRef = useRef(username)

  const testConnection = async () => {
    setTesting(true)
    try {
      // 保存时自动 trim 去除首尾空格（密码保留原样，避免破坏含首尾空格的真实密码）
      const trimmedUrl = webdavUrl.trim();
      const trimmedUsername = username.trim();

      // URL 基本格式校验
      if (trimmedUrl && !/^https?:\/\/.+/i.test(trimmedUrl)) {
        toast.error(t('settings.webdav.urlInvalid'), { description: t('settings.webdav.urlInvalidDesc') })
        return;
      }
      
      // 与上次保存的配置比较（检测换服务器/换账号的场景）
      const configChanged = 
        (savedUrlRef.current && savedUrlRef.current !== trimmedUrl) || 
        (savedUsernameRef.current && savedUsernameRef.current !== trimmedUsername);
      
      // 测试连接（在后台 Service Worker 中执行）
      const testResult = await webdavTestInBackground({
        url: trimmedUrl,
        username: trimmedUsername,
        password: password
      })
      if (!testResult.ok) {
        throw new Error(testResult.error)
      }
      
      // 更新存储的值
      if (trimmedUrl !== webdavUrl) setWebdavUrl(trimmedUrl);
      if (trimmedUsername !== username) setUsername(trimmedUsername);
      
      // 记录本次保存的配置，供下次变更检测
      savedUrlRef.current = trimmedUrl;
      savedUsernameRef.current = trimmedUsername;
      
      // 配置变更且连接成功 → 自动备份
      if (configChanged && savedUrlRef.current) { // 确保之前有配置（不是首次设置）
        toast.info(t('settings.webdav.configChanged'), { duration: 2000 });
        try {
          // 在后台 Service Worker 中执行自动备份，关闭面板不会中断
          const result = await smartPushInBackground(
            { url: trimmedUrl, username: trimmedUsername, password: password }
          );
          
          if (result.success) {
            toast.success(t('settings.webdav.connected'), { 
              description: t('settings.webdav.connectedBackupDesc') 
            });
          } else {
            console.warn('[Settings] Auto backup skipped:', result.message);
            toast.success(t('settings.webdav.connected'), { 
              description: t('settings.webdav.connectedDesc') 
            });
          }
        } catch (backupError) {
          console.warn('[Settings] Auto backup failed:', backupError);
          toast.success(t('settings.webdav.connected'), { 
            description: t('settings.webdav.connectedNoBackupDesc') 
          });
        }
      } else {
        toast.success(t('settings.webdav.connected'), { description: t('settings.webdav.connectedDesc') });
      }
    } catch (e) {
      toast.error(t('settings.webdav.connectFailed'), { description: (e as Error).message || t('common.unknownError') })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.webdav.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('settings.webdav.serverUrl')}</Label>
          <Input
            placeholder="https://dav.example.com/"
            value={webdavUrl}
            onChange={(e) => setWebdavUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('settings.webdav.username')}</Label>
          <Input
            placeholder="user@example.com"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('settings.webdav.password')}</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button onClick={testConnection} disabled={testing} className="w-full mt-4">
          {testing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('settings.webdav.testing')}</>
          ) : (
            t('settings.webdav.testBtn')
          )}
        </Button>
      </div>
    </div>
  )
}

// 同步设置子页面
function SyncSettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [autoSyncEnabled, setAutoSyncEnabled] = useStorage('auto_sync_enabled', true)
  const [scheduledSyncEnabled, setScheduledSyncEnabled] = useStorage('scheduled_sync_enabled', false)
  const [scheduledSyncInterval, setScheduledSyncInterval] = useStorage('scheduled_sync_interval', 30)
  const [backupFileInterval, setBackupFileInterval] = useStorage('backup_file_interval', 1)
  const [missingFolderFallback, setMissingFolderFallback] = useStorage('missing_folder_fallback', false)
  const [deviceName, setDeviceName] = useStorage('device_name', '')
  const [deviceIdShort, setDeviceIdShort] = useState('')
  const [e2eEnabled, setE2eEnabled] = useStorage('e2e_enabled', false)
  const [e2ePassphrase, setE2ePassphrase] = useStorage('e2e_passphrase', '')
  const [e2eConfirm, setE2eConfirm] = useState('')
  const [showE2ePassword, setShowE2ePassword] = useState(false)
  const [e2eReuploading, setE2eReuploading] = useState(false)
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

  // 端到端加密开关：开启时要求密码至少 8 位且两次输入一致；
  // 开启成功后立即清除时间窗并触发一次后台推送，让加密保护即刻生效
  const onE2eToggle = (next: boolean) => {
    if (next && (e2ePassphrase.length < 8 || e2ePassphrase !== e2eConfirm)) {
      toast.error(t('settings.sync.e2eNeedValidPassword'))
      return
    }
    setE2eEnabled(next)
    if (next) {
      toast.success(t('settings.sync.e2eOnToast'))
      void onE2eReupload()
    } else {
      // 关闭时清除本地密码（更稳妥）；已上传的加密备份仍需原密码才能恢复
      setE2ePassphrase('')
      setE2eConfirm('')
      toast.success(t('settings.sync.e2eOffToast'))
    }
  }

  // 立即以加密格式重新上传一份备份（清除时间窗 → 后台推送）
  const onE2eReupload = async () => {
    try {
      setE2eReuploading(true)
      await clearLastBackupFileInfo()
      const { config } = await getWebDAVConfig()
      if (!config) {
        toast.error(t('settings.sync.e2eNeedWebdav'))
        return
      }
      const result = await smartPushInBackground(config)
      if (result.success) {
        toast.success(t('settings.sync.e2eReuploadDone'))
      } else {
        toast.error(result.message || t('settings.sync.e2eReuploadFailed'))
      }
    } catch (error) {
      toast.error((error as Error).message || t('settings.sync.e2eReuploadFailed'))
    } finally {
      setE2eReuploading(false)
    }
  }

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

        {/* 端到端加密 */}
        <div className="p-4 rounded-xl bg-secondary/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">{t('settings.sync.e2eSection')}</Label>
              <p className="text-xs text-muted-foreground max-w-[70%]">{t('settings.sync.e2eDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={e2eEnabled}
                onChange={(e) => onE2eToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-muted-foreground">{t('settings.sync.e2ePassword')}</Label>
              <div className="relative">
                <Input
                  type={showE2ePassword ? 'text' : 'password'}
                  value={e2ePassphrase}
                  onChange={(e) => setE2ePassphrase(e.target.value)}
                  placeholder={t('settings.sync.e2ePasswordPlaceholder')}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowE2ePassword(!showE2ePassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showE2ePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('settings.sync.e2eConfirm')}</Label>
              <Input
                type={showE2ePassword ? 'text' : 'password'}
                value={e2eConfirm}
                onChange={(e) => setE2eConfirm(e.target.value)}
                placeholder={t('settings.sync.e2eConfirmPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-amber-500">{t('settings.sync.e2eWarn')}</p>
          </div>
          {e2eEnabled && (
            <Button
              variant="outline"
              size="sm"
              disabled={e2eReuploading}
              onClick={() => void onE2eReupload()}
              className="w-full"
            >
              {e2eReuploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('settings.sync.e2eReuploading')}
                </>
              ) : (
                t('settings.sync.e2eReuploadButton')
              )}
            </Button>
          )}
        </div>

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

// 顶部引入 semver
import semver from 'semver'
import browser from 'webextension-polyfill'
// ...

// ...
function AboutPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null)
  
  // 获取当前版本
  const currentVersion = browser.runtime.getManifest().version 

  const checkUpdate = async () => {
    setChecking(true)
    try {
      const res = await fetch('https://api.github.com/repos/1378944437/marksync/releases/latest')
      const data = await res.json()
      // GitHub release tag might be "v1.0.1", semver needs "1.0.1"
      const remoteVersion = data.tag_name?.replace(/^v/, '')
      
      if (remoteVersion && semver.gt(remoteVersion, currentVersion)) {
        setUpdateAvailable(data.tag_name)
        toast.success(t('settings.about.newVersion', { version: data.tag_name }), {
          description: '',
          action: {
            label: t('settings.about.download'),
            onClick: () => window.open(data.html_url, '_blank')
          }
        })
      } else {
        toast.info(t('settings.about.upToDate'))
      }
    } catch (e) {
      toast.error(t('settings.about.checkFailed'), { description: t('settings.about.checkFailedDesc') })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.about.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        <div className="p-4 rounded-xl bg-secondary/30 text-center">
          <h3 className="text-xl font-bold text-foreground">MarkSync</h3>
          <p className="text-sm text-muted-foreground mt-1">v{currentVersion}</p>
        </div>
        <div className="p-4 rounded-xl bg-secondary/30">
          <p className="text-sm text-muted-foreground">
            {t('settings.about.desc')}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-secondary/30">
          <p className="text-xs text-muted-foreground">
            {t('settings.about.support')}
          </p>
        </div>
        
        {updateAvailable ? (
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={() => window.open(`https://github.com/1378944437/marksync/releases/tag/${updateAvailable}`, '_blank')}
          >
            {t('settings.about.downloadNew', { version: updateAvailable })}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={checkUpdate}
            disabled={checking}
          >
            {checking ? (
               <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('settings.about.checking')}</>
            ) : t('settings.about.checkUpdate')}
          </Button>
        )}
      </div>
    </div>
  )
}

// 通用/语言设置子页面
function GeneralSettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [languageSetting, setLanguageSetting] = useStorage<LanguageSetting>('app_language', 'auto')
  const { locale } = useI18n()

  const handleLanguageChange = async (value: LanguageSetting) => {
    setLanguageSetting(value)
    await writeLanguageSetting(value)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.general.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 语言 */}
        <div className="space-y-2 p-4 rounded-xl bg-secondary/30">
          <Label className="text-foreground">{t('settings.general.language')}</Label>
          <p className="text-xs text-muted-foreground mb-2">{t('settings.general.languageDesc')}</p>
          <select
            value={languageSetting}
            onChange={(e) => handleLanguageChange(e.target.value as LanguageSetting)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
          >
            <option value="auto">{t('settings.general.language.auto')}</option>
            <option value="zh-CN">{t('settings.general.language.zh-CN')}</option>
            <option value="en">{t('settings.general.language.en')}</option>
          </select>
          {languageSetting === 'auto' && (
            <p className="text-xs text-muted-foreground mt-1">
              ({t('settings.general.currentLocale')}: {locale})
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// 主设置视图
export function SettingsView() {
  const { t } = useI18n()
  const [subPage, setSubPage] = useState<SubPage>('main')

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  const direction = subPage === 'main' ? -1 : 1

  return (
    <div className="flex flex-col h-full pt-4">
      <AnimatePresence mode="wait" custom={direction}>
        {subPage === 'main' && (
          <motion.div
            key="main"
            custom={-1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1"
          >
            <div className="space-y-3">
              <SettingsItem
                icon={Link2}
                label={t('settings.item.webdav.label')}
                description={t('settings.item.webdav.desc')}
                onClick={() => setSubPage('webdav')}
              />
              <SettingsItem
                icon={RefreshCw}
                label={t('settings.item.sync.label')}
                description={t('settings.item.sync.desc')}
                onClick={() => setSubPage('sync')}
              />
              <SettingsItem
                icon={Globe}
                label={t('settings.item.general.label')}
                description={t('settings.item.general.desc')}
                onClick={() => setSubPage('general')}
              />
              <SettingsItem
                icon={Info}
                label={t('settings.item.about.label')}
                description={t('settings.item.about.desc')}
                onClick={() => setSubPage('about')}
              />
            </div>
          </motion.div>
        )}

        {subPage === 'webdav' && (
          <motion.div
            key="webdav"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <WebDAVPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}

        {subPage === 'sync' && (
          <motion.div
            key="sync"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <SyncSettingsPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}

        {subPage === 'general' && (
          <motion.div
            key="general"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <GeneralSettingsPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}

        {subPage === 'about' && (
          <motion.div
            key="about"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <AboutPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
