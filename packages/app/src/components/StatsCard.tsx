/**
 * 书签数量统计卡片
 * 支持设备类型图标与两端数量一致性状态双勾图标微徽章（无冗余文本）
 */
import type { ComponentType } from 'react'
import { CheckCheck } from 'lucide-react'
import { cn } from '../infrastructure/utils/format'

export interface StatsCardProps {
  label: string
  count: number
  loading: boolean
  color: 'indigo' | 'zinc'
  icon?: ComponentType<{ className?: string }>
  isSynced?: boolean
  syncedTooltip?: string
}

export function StatsCard({
  label,
  count,
  loading,
  color,
  icon: Icon,
  isSynced,
  syncedTooltip,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 transition-all border flex flex-col justify-between",
        color === 'indigo'
          ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)] dark:border-indigo-400/30 dark:shadow-[0_0_30px_-5px_rgba(99,102,241,0.45)]"
          : "surface-card border-border"
      )}
    >
      {/* 只有 indigo 卡片有微光装饰 */}
      {color === 'indigo' && (
        <div className="absolute top-0 right-0 p-3 pointer-events-none">
          <div className="w-16 h-16 rounded-full blur-xl bg-indigo-400/30" />
        </div>
      )}

      {/* 标题栏与图标 */}
      <div className="flex items-center justify-between mb-1 relative z-10">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground/70" />}
      </div>

      {/* 数量数值与两端一致图标微徽章（去除文本占位，鼠标悬停展示 Tooltip） */}
      <div className="flex items-end justify-between relative z-10 mt-1">
        <div className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          {loading ? (
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          ) : (
            <span>{count}</span>
          )}
        </div>

        {isSynced && !loading && (
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 shadow-sm"
            title={syncedTooltip}
          >
            <CheckCheck className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  )
}
