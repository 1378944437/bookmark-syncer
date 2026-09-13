/**
 * 端到端加密设置区块
 * 采用显式保存与草稿隔离架构，彻底杜绝打字即落盘；
 * 清晰划分「未配置」、「已启用保护」、「修改主密码」三大状态，支持密码强度分析与安全关闭防手滑确认
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Eye, EyeOff, KeyRound, Loader2, Lock, RefreshCw } from 'lucide-react'
import { clearLastBackupFileInfo, getWebDAVConfig } from '../../application'
import { smartPushInBackground } from '../../application/background-ops'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { Button } from '../Button'
import { Input } from '../Input'
import { Label } from '../Label'
import { cn } from '../../infrastructure/utils/format'

/**
 * 密码强度辅助判定函数
 */
function calculatePasswordStrength(pass: string): { level: 1 | 2 | 3; labelKey: string; color: string; width: string } {
  if (!pass || pass.length < 8) {
    return { level: 1, labelKey: 'settings.security.strengthWeak', color: 'bg-rose-500', width: 'w-1/3' }
  }
  let score = 0
  if (pass.length >= 10) score += 1
  if (pass.length >= 14) score += 1
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1
  if (/\d/.test(pass)) score += 1
  if (/[^A-Za-z0-9]/.test(pass)) score += 1

  if (score <= 2) {
    return { level: 1, labelKey: 'settings.security.strengthWeak', color: 'bg-rose-500', width: 'w-1/3' }
  }
  if (score <= 4) {
    return { level: 2, labelKey: 'settings.security.strengthMedium', color: 'bg-amber-500', width: 'w-2/3' }
  }
  return { level: 3, labelKey: 'settings.security.strengthStrong', color: 'bg-emerald-500', width: 'w-full' }
}

export function E2EEncryptionSection() {
  const { t } = useI18n()
  const [e2eEnabled, setE2eEnabled] = useStorage('e2e_enabled', false)
  const [e2ePassphrase, setE2ePassphrase] = useStorage('e2e_passphrase', '')

  // 纯本地草稿状态：未点击保存前绝不写入持久化存储
  const [draftPassword, setDraftPassword] = useState('')
  const [draftConfirm, setDraftConfirm] = useState('')
  const [showDraftPassword, setShowDraftPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)

  // 界面模式控制
  const [isEditingPassword, setIsEditingPassword] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [reuploading, setReuploading] = useState(false)

  const strength = calculatePasswordStrength(draftPassword)
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
  const handleSaveNewPassword = () => {
    if (draftPassword.length < 8) {
      toast.error(t('settings.security.passwordMinLength'))
      return
    }
    if (draftPassword !== draftConfirm) {
      toast.error(t('settings.security.passwordMismatch'))
      return
    }
    setE2ePassphrase(draftPassword)
    setDraftPassword('')
    setDraftConfirm('')
    setIsEditingPassword(false)
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
        // 无有效密码时保持关闭，聚焦让用户先设定
        setIsEditingPassword(true)
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
          <div className="space-y-0.5">
            <Label className="text-foreground text-sm font-semibold flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-primary" />
              <span>{t('settings.sync.e2eSection')}</span>
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
              {t('settings.sync.e2eDesc')}
            </p>
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
          <div className="space-y-3 pt-2 border-t border-border/50">
            {/* 当前密码展示行 */}
            <div className="p-3 rounded-lg bg-background/80 border border-border/60 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('settings.security.currentPassword')}
                </span>
                <p className="text-sm font-mono tracking-wider text-foreground select-all">
                  {showCurrentPassword ? e2ePassphrase : '••••••••••••'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Toggle visibility"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingPassword(!isEditingPassword)
                    setDraftPassword('')
                    setDraftConfirm('')
                  }}
                  className="text-xs h-7 px-2 text-primary hover:text-primary/80"
                >
                  {isEditingPassword ? t('settings.security.collapse') : t('settings.security.changePassword')}
                  {isEditingPassword ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                </Button>
              </div>
            </div>

            {/* 折叠区：修改主密码表单 */}
            {isEditingPassword && (
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 space-y-3 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('settings.security.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      type={showDraftPassword ? 'text' : 'password'}
                      value={draftPassword}
                      onChange={(e) => setDraftPassword(e.target.value)}
                      placeholder={t('settings.security.newPasswordPlaceholder')}
                      className="pr-10 text-xs h-9"
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

                {/* 密码强度指示条 */}
                {draftPassword.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{t('settings.security.strengthLabel')}</span>
                      <span className="font-medium">{t(strength.labelKey)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div className={cn("h-full transition-all duration-300 rounded-full", strength.color, strength.width)} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('settings.security.confirmNewPassword')}</Label>
                  <Input
                    type={showDraftPassword ? 'text' : 'password'}
                    value={draftConfirm}
                    onChange={(e) => setDraftConfirm(e.target.value)}
                    placeholder={t('settings.security.confirmNewPasswordPlaceholder')}
                    className={cn("text-xs h-9", isMismatch && "border-rose-500 focus-visible:ring-rose-500")}
                  />
                  {isMismatch && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {t('settings.security.passwordMismatch')}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={handleSaveNewPassword}
                  disabled={reuploading || draftPassword.length < 8 || draftPassword !== draftConfirm}
                  className="w-full h-8 text-xs font-medium"
                >
                  {reuploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                  {t('settings.security.saveNewPassword')}
                </Button>
              </div>
            )}

            {/* 独立重新加密上传操作 */}
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={reuploading}
                onClick={() => void handleReupload()}
                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                {reuploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {t('settings.sync.e2eReuploading')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    {t('settings.sync.e2eReuploadButton')}
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground/80 text-center mt-1.5">
                {t('settings.security.reencryptDesc')}
              </p>
            </div>
          </div>
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
            {draftPassword.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{t('settings.security.strengthLabel')}</span>
                  <span className="font-medium">{t(strength.labelKey)}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-300 rounded-full", strength.color, strength.width)} />
                </div>
              </div>
            )}

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
        <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground">
                {t('settings.security.disableConfirmTitle')}
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t('settings.security.disableConfirmDesc')}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDisableConfirm(false)}
              className="h-7 text-xs px-2.5"
            >
              {t('settings.security.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDisable}
              className="h-7 text-xs px-3"
            >
              {t('settings.security.disableConfirmBtn')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
