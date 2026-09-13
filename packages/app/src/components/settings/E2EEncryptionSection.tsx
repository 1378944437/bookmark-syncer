/**
 * 端到端加密设置区块
 * 自 SyncSettingsPage 拆出：自包含状态（密码/开关/重传中）与行为
 * （开启即触发一次加密上传、关闭清除本地密码）
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { clearLastBackupFileInfo, getWebDAVConfig } from '../../application'
import { smartPushInBackground } from '../../application/background-ops'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { Button } from '../Button'
import { Input } from '../Input'
import { Label } from '../Label'

export function E2EEncryptionSection() {
  const { t } = useI18n()
  const [e2eEnabled, setE2eEnabled] = useStorage('e2e_enabled', false)
  const [e2ePassphrase, setE2ePassphrase] = useStorage('e2e_passphrase', '')
  const [e2eConfirm, setE2eConfirm] = useState('')
  const [showE2ePassword, setShowE2ePassword] = useState(false)
  const [e2eReuploading, setE2eReuploading] = useState(false)

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
  // 端到端加密设置区块
  return (
        <div className="p-4 surface-card space-y-3">
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
              <div className="w-11 h-6 bg-zinc-300/70 dark:bg-white/15 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
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
            <p className="text-xs text-amber-600 dark:text-amber-400">{t('settings.sync.e2eWarn')}</p>
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

  )
}
