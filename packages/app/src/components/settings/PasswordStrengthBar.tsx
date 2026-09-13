/**
 * 端到端加密密码强度指示条组件
 * 提供密码复杂度评估与可视化进度指示
 */
import { cn } from '../../infrastructure/utils/format'

export interface PasswordStrength {
  level: 1 | 2 | 3
  labelKey: string
  color: string
  width: string
}

/**
 * 密码强度辅助判定函数
 */
export function calculatePasswordStrength(pass: string): PasswordStrength {
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

export interface PasswordStrengthBarProps {
  password: string
  t: (key: string) => string
}

export function PasswordStrengthBar({ password, t }: PasswordStrengthBarProps) {
  if (!password || password.length === 0) return null

  const strength = calculatePasswordStrength(password)

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{t('settings.security.strengthLabel')}</span>
        <span className="font-medium">{t(strength.labelKey)}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={cn('h-full transition-all duration-300 rounded-full', strength.color, strength.width)} />
      </div>
    </div>
  )
}
