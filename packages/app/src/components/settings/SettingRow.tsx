/**
 * 统一设置行与分组原子组件
 * 提供分组卡片、平滑开关、导航跳转与选择控件标准封装
 */
import type { ElementType, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../infrastructure/utils/format'

export interface SettingGroupProps {
  title?: string
  children: ReactNode
  className?: string
}

export function SettingGroup({ title, children, className }: SettingGroupProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {title && (
        <div className="px-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden divide-y divide-border/60 shadow-sm">
        {children}
      </div>
    </div>
  )
}

export interface SettingRowProps {
  icon?: ElementType<{ className?: string }>
  iconColor?: string
  label: string
  description?: string
  type?: 'navigation' | 'switch' | 'select' | 'custom'
  checked?: boolean
  disabled?: boolean
  onClick?: () => void
  onCheckedChange?: (checked: boolean) => void
  children?: ReactNode
}

export function SettingRow({
  icon: Icon,
  iconColor = 'text-primary bg-primary/10',
  label,
  description,
  type = 'navigation',
  checked = false,
  disabled = false,
  onClick,
  onCheckedChange,
  children,
}: SettingRowProps) {
  const isClickable = (type === 'navigation' || type === 'switch') && !disabled

  const handleClick = () => {
    if (disabled) return
    if (type === 'switch' && onCheckedChange) {
      onCheckedChange(!checked)
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <div
      role={type === 'navigation' ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick()
        }
      }}
      className={cn(
        'flex items-center justify-between p-3.5 transition-colors select-none',
        isClickable && 'cursor-pointer hover:bg-secondary/60 active:bg-secondary/80',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center">
        {type === 'navigation' && (
          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        )}

        {type === 'switch' && (
          <label
            className="relative inline-flex items-center cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => onCheckedChange?.(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-zinc-300/80 dark:bg-white/15 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        )}

        {(type === 'select' || type === 'custom') && children}
      </div>
    </div>
  )
}
