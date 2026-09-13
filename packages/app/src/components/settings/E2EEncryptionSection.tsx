/**
 * 端到端加密设置区块
 * 采用显式保存与草稿隔离架构，彻底杜绝打字即落盘；
 * 清晰划分「未配置」、「已启用保护」、「修改主密码」三大状态，支持密码强度分析与安全关闭防手滑确认
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react'
import { clearLastBackupFileInfo, getWebDAVConfig } from '../../application'
import { smartPushInBackground } from '../../application/background-ops'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { Button } from '../Button'
import { Input } from '../Input'
import { Label } from '../Label'
import { cn } from '../../infrastructure/utils/format'
import { PasswordStrengthBar } from './PasswordStrengthBar'
import { DisableE2EConfirmCard } from './DisableE2EConfirmCard'
import { E2EEnabledCard } from './E2EEnabledCard'
import { HelpTip } from '../HelpTip'

export function E2EEncryptionSection() {
  const { t } = useI18n()
  const [e2eEnabled, setE2eEnabled] = useStorage('e2e_enabled', false)
  const [e2ePassphrase, setE2ePassphrase] = useStorage('e2e_passphrase', '')

  // 纯本地草稿状态：未点击保存前绝不写入持久化存储
  const [draftPassword, setDraftPassword] = useState('')
  const [draftConfirm, setDraftConfirm] = useState('')
  const [showDraftPassword, setShowDraftPassword] = useState(false)

  // 界面模式控制
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [reuploading, setReuploading] = useState(false)

  const isMismatch = draftConfirm.length > 0 && draftPassword !== draftConfirm

  // 重新加密云端备份
  const handleReupload = async () => {
    try {
      setReuploading(true)
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
      setReuploading(false)
    }
  }

  // 首次启用并保存加密密码
  const handleEnableAndSave = () => {
    if (draftPassword.length < 8) {
      toast.error(t('settings.security.passwordMinLength'))
      return
    }
    if (draftPassword !== draftConfirm) {
      toast.error(t('settings.security.passwordMismatch'))
      return
    }
    setE2ePassphrase(draftPassword)
    setE2eEnabled(true)
    setDraftPassword('')
    setDraftConfirm('')
    toast.success(t('settings.sync.e2eOnToast'))
    void handleReupload()
  }

  // 保存修改后的新密码
  const handleSaveNewPassword = (newPass: string) => {
    setE2ePassphrase(newPass)
    toast.success(t('settings.security.savedToast'))
    void handleReupload()
  }

  // 请求关闭开关时触发二次确认弹窗
  const handleToggleClick = (nextChecked: boolean) => {
    if (!nextChecked) {
      setShowDisableConfirm(true)
    } else {
      // 若此前已有记忆密码，直接重新启用
      if (e2ePassphrase && e2ePassphrase.length >= 8) {
        setE2eEnabled(true)
        toast.success(t('settings.sync.e2eOnToast'))
        void handleReupload()
      } else {
        // 无有效密码时保持关闭，提醒用户先输入密码
        toast.error(t('settings.security.passwordMinLength'))
      }
    }
  }

  // 确认关闭端到端加密（保留本地密码，仅停用加密行为）
  const confirmDisable = () => {
    setE2eEnabled(false)
    setShowDisableConfirm(false)
    toast.success(t('settings.sync.e2eOffToast'))
  }

  return (
    <div className="space-y-4">
      {/* 核心卡片容器 */}
      <div className="p-4 surface-card space-y-4 border border-border/60 dark:border-white/[0.08]">
        {/* 顶部标题与主开关 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Label className="text-foreground text-sm font-semibold flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-primary" />
              <span>{t('settings.sync.e2eSection')}</span>
            </Label>
            <HelpTip content={t('settings.sync.e2eDesc')} />
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={e2eEnabled}
              onChange={(e) => handleToggleClick(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-300/70 dark:bg-white/15 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* 状态 1：已开启端到端加密 */}
        {e2eEnabled ? (
          <E2EEnabledCard
            passphrase={e2ePassphrase}
            onSaveNewPassword={handleSaveNewPassword}
            onReupload={() => void handleReupload()}
            reuploading={reuploading}
          />
        ) : (
          /* 状态 2：未开启端到端加密表单 */
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('settings.sync.e2ePassword')}</Label>
              <div className="relative">
                <Input
                  type={showDraftPassword ? 'text' : 'password'}
                  value={draftPassword}
                  onChange={(e) => setDraftPassword(e.target.value)}
                  placeholder={t('settings.sync.e2ePasswordPlaceholder')}
                  className="pr-10 text-xs h-9"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowDraftPassword(!showDraftPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showDraftPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 密码强度条 */}
            <PasswordStrengthBar password={draftPassword} t={t} />

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('settings.sync.e2eConfirm')}</Label>
              <Input
                type={showDraftPassword ? 'text' : 'password'}
                value={draftConfirm}
                onChange={(e) => setDraftConfirm(e.target.value)}
                placeholder={t('settings.sync.e2eConfirmPlaceholder')}
                className={cn("text-xs h-9", isMismatch && "border-rose-500 focus-visible:ring-rose-500")}
                autoComplete="new-password"
              />
              {isMismatch && (
                <p className="text-[11px] text-rose-500 font-medium">
                  {t('settings.security.passwordMismatch')}
                </p>
              )}
            </div>

            <p className="text-[11px] text-amber-600 dark:text-amber-400/90 leading-normal">
              {t('settings.sync.e2eWarn')}
            </p>

            <Button
              size="sm"
              onClick={handleEnableAndSave}
              disabled={reuploading || draftPassword.length < 8 || draftPassword !== draftConfirm}
              className="w-full h-8 text-xs font-medium shadow-sm"
            >
              {reuploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
              {t('settings.security.enableAndSave')}
            </Button>
          </div>
        )}
      </div>

      {/* 关闭加密确认防手滑弹层 */}
      {showDisableConfirm && (
        <DisableE2EConfirmCard
          onCancel={() => setShowDisableConfirm(false)}
          onConfirm={confirmDisable}
          t={t}
        />
      )}
    </div>
  )
}
