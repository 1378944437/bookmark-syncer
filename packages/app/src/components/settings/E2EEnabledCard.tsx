/**
 * 端到端加密已启用状态展示卡片
 * 封装当前密码展示、修改密码折叠面板以及重新加密上传云端操作
 */
import { FC, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import { useI18n } from '../../i18n'
import { Button } from '../Button'
import { Input } from '../Input'
import { Label } from '../Label'
import { cn } from '../../infrastructure/utils/format'
import { PasswordStrengthBar } from './PasswordStrengthBar'

interface E2EEnabledCardProps {
  /** 当前生效的加密密码 */
  passphrase: string
  /** 保存新密码回调 */
  onSaveNewPassword: (newPass: string) => void
  /** 触发重新加密上传云端备份 */
  onReupload: () => void
  /** 正在重新加密上传中标识 */
  reuploading: boolean
}

export const E2EEnabledCard: FC<E2EEnabledCardProps> = ({
  passphrase,
  onSaveNewPassword,
  onReupload,
  reuploading,
}) => {
  const { t } = useI18n()
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [isEditingPassword, setIsEditingPassword] = useState(false)
  const [draftPassword, setDraftPassword] = useState('')
  const [draftConfirm, setDraftConfirm] = useState('')
  const [showDraftPassword, setShowDraftPassword] = useState(false)

  const isMismatch = draftConfirm.length > 0 && draftPassword !== draftConfirm

  // 提交修改的新密码
  const handleSave = () => {
    if (draftPassword.length < 8) {
      toast.error(t('settings.security.passwordMinLength'))
      return
    }
    if (draftPassword !== draftConfirm) {
      toast.error(t('settings.security.passwordMismatch'))
      return
    }
    onSaveNewPassword(draftPassword)
    setDraftPassword('')
    setDraftConfirm('')
    setIsEditingPassword(false)
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border/50">
      {/* 当前密码展示与修改入口 */}
      <div className="p-3 rounded-lg bg-background/80 border border-border/60 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('settings.security.currentPassword')}
          </span>
          <p className="text-sm font-mono tracking-wider text-foreground select-all">
            {showCurrentPassword ? passphrase : '••••••••••••'}
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

      {/* 折叠面板：修改主密码 */}
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
          <PasswordStrengthBar password={draftPassword} t={t} />

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
            onClick={handleSave}
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
          onClick={onReupload}
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
  )
}
