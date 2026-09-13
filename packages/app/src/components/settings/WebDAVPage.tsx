/**
 * WebDAV 配置子页面
 * 提供常见服务商快捷模板、密码显隐切换及表单输入失焦持久化（降低 Storage I/O）
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Info, Loader2 } from 'lucide-react'
import { smartPushInBackground, webdavTestInBackground } from '../../application/background-ops'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { Button } from '../Button'
import { Input } from '../Input'
import { Label } from '../Label'
import { SubPageHeader } from './SettingsShared'
import { cn } from '../../infrastructure/utils/format'

export function WebDAVPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [webdavUrl, setWebdavUrl] = useStorage('webdav_url', '')
  const [username, setUsername] = useStorage('webdav_username', '')
  const [password, setPassword] = useStorage('webdav_password', '')
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // 本地受控状态：避免击键高频触发 browser.storage.local.set 广播
  const [localUrl, setLocalUrl] = useState(webdavUrl)
  const [localUsername, setLocalUsername] = useState(username)
  const [localPassword, setLocalPassword] = useState(password)

  // 异步加载存储初值时对齐本地状态
  useEffect(() => {
    setLocalUrl((prev) => (prev === '' ? webdavUrl : prev))
  }, [webdavUrl])
  useEffect(() => {
    setLocalUsername((prev) => (prev === '' ? username : prev))
  }, [username])
  useEffect(() => {
    setLocalPassword((prev) => (prev === '' ? password : prev))
  }, [password])

  // 记录上次已保存的配置，用于检测真正的变更
  const savedUrlRef = useRef(webdavUrl)
  const savedUsernameRef = useRef(username)

  // 将本地输入持久化到扩展存储（在失焦或点击测试提交时调用）
  const persistValues = (u = localUrl, un = localUsername, pw = localPassword) => {
    if (u !== webdavUrl) setWebdavUrl(u)
    if (un !== username) setUsername(un)
    if (pw !== password) setPassword(pw)
  }

  // 常见服务商快速配置模板
  const PROVIDER_TEMPLATES = [
    {
      id: 'jianguo',
      name: t('settings.webdav.providerJianguo'),
      url: 'https://dav.jianguoyun.com/dav/',
    },
    {
      id: 'nextcloud',
      name: t('settings.webdav.providerNextcloud'),
      url: 'https://your-cloud.com/remote.php/dav/files/USERNAME/',
    },
    {
      id: 'infini',
      name: t('settings.webdav.providerInfini'),
      url: 'https://teracloud.jp/dav/',
    },
  ]

  // 应用服务商预设
  const applyProviderTemplate = (templateUrl: string) => {
    setLocalUrl(templateUrl)
    persistValues(templateUrl, localUsername, localPassword)
  }

  // 检查是否应用了坚果云
  const isJianguoyun = localUrl.includes('jianguoyun.com')

  const testConnection = async () => {
    setTesting(true)
    try {
      // 保存时自动 trim 去除首尾空格（密码保留原样）
      const trimmedUrl = localUrl.trim()
      const trimmedUsername = localUsername.trim()

      // URL 基本格式校验
      if (trimmedUrl && !/^https?:\/\/.+/i.test(trimmedUrl)) {
        toast.error(t('settings.webdav.urlInvalid'), { description: t('settings.webdav.urlInvalidDesc') })
        return
      }

      // 与上次保存的配置比较（检测换服务器/换账号的场景）
      const configChanged =
        (savedUrlRef.current && savedUrlRef.current !== trimmedUrl) ||
        (savedUsernameRef.current && savedUsernameRef.current !== trimmedUsername)

      // 测试连接（在后台 Service Worker 中执行）
      const testResult = await webdavTestInBackground({
        url: trimmedUrl,
        username: trimmedUsername,
        password: localPassword,
      })
      if (!testResult.ok) {
        throw new Error(testResult.error)
      }

      // 更新存储与本地值
      setLocalUrl(trimmedUrl)
      setLocalUsername(trimmedUsername)
      persistValues(trimmedUrl, trimmedUsername, localPassword)

      // 记录本次保存的配置，供下次变更检测
      savedUrlRef.current = trimmedUrl
      savedUsernameRef.current = trimmedUsername

      // 配置变更且连接成功 → 自动备份
      if (configChanged && savedUrlRef.current) {
        toast.info(t('settings.webdav.configChanged'), { duration: 2000 })
        try {
          const result = await smartPushInBackground({
            url: trimmedUrl,
            username: trimmedUsername,
            password: localPassword,
          })

          if (result.success) {
            toast.success(t('settings.webdav.connected'), {
              description: t('settings.webdav.connectedBackupDesc'),
            })
          } else {
            toast.success(t('settings.webdav.connected'), {
              description: t('settings.webdav.connectedDesc'),
            })
          }
        } catch (backupError) {
          toast.success(t('settings.webdav.connected'), {
            description: t('settings.webdav.connectedNoBackupDesc'),
          })
        }
      } else {
        toast.success(t('settings.webdav.connected'), { description: t('settings.webdav.connectedDesc') })
      }
    } catch (e) {
      toast.error(t('settings.webdav.connectFailed'), {
        description: (e as Error).message || t('common.unknownError'),
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.webdav.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 常见服务商快速配置模板标签 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('settings.webdav.providerTemplates')}</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_TEMPLATES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyProviderTemplate(p.url)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-full border transition-all",
                  localUrl === p.url || (p.id === 'jianguo' && isJianguoyun)
                    ? "bg-primary/15 border-primary/40 text-primary font-medium shadow-sm"
                    : "bg-muted/50 hover:bg-muted border-border/70 text-muted-foreground hover:text-foreground"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 服务器地址输入框 */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('settings.webdav.serverUrl')}</Label>
          <Input
            placeholder="https://dav.example.com/"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            onBlur={() => persistValues(localUrl, localUsername, localPassword)}
          />
          {/* 坚果云专用密码温馨提示 */}
          {isJianguoyun && (
            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{t('settings.webdav.jianguoTip')}</span>
            </div>
          )}
        </div>

        {/* 用户名输入框 */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('settings.webdav.username')}</Label>
          <Input
            placeholder="user@example.com"
            value={localUsername}
            onChange={(e) => setLocalUsername(e.target.value)}
            onBlur={() => persistValues(localUrl, localUsername, localPassword)}
            autoComplete="username"
          />
        </div>

        {/* 密码输入框（带明文显隐控制） */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('settings.webdav.password')}</Label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={localPassword}
              onChange={(e) => setLocalPassword(e.target.value)}
              onBlur={() => persistValues(localUrl, localUsername, localPassword)}
              className="pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              title={showPassword ? t('settings.webdav.hidePassword') : t('settings.webdav.showPassword')}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 保存并测试连接按钮 */}
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
