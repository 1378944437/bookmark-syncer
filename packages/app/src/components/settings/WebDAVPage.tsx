/**
 * WebDAV 配置子页面
 * 自 SettingsView 拆出
 */
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { smartPushInBackground, webdavTestInBackground } from '../../application/background-ops'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { Button } from '../Button'
import { Input } from '../Input'
import { Label } from '../Label'
import { SubPageHeader } from './SettingsShared'

// WebDAV 配置子页面
export function WebDAVPage({ onBack }: { onBack: () => void }) {
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
