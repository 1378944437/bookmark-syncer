/**
 * 现代高质感近期同步活动热力图组件 (ActivityHeatmap.tsx)
 * 采用 GitHub / Linear 风格设计，支持响应式 14 天网格、动态光效、交互式明细透视与统计指示器
 */
import { useI18n } from '../../i18n'
import { useState } from 'react'
import { Flame, Sparkles, TrendingUp } from 'lucide-react'
import type { DailyActivity } from '../../core/analytics/sync-analytics'
import { cn } from '../../infrastructure/utils/format'

export interface ActivityHeatmapProps {
  activities: DailyActivity[]
}

export function ActivityHeatmap({ activities }: ActivityHeatmapProps) {
  const { t, locale } = useI18n()
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const totalSyncs = activities.reduce((sum, item) => sum + item.count, 0)
  const totalAdded = activities.reduce((sum, item) => sum + item.added, 0)
  const totalUpdated = activities.reduce((sum, item) => sum + item.updated, 0)
  const totalDeleted = activities.reduce((sum, item) => sum + item.deleted, 0)
  const activeDays = activities.filter((item) => item.count > 0).length

  // 获取热力等级对应样式（祖母绿/翠绿层级与立体微光）
  const getLevelStyle = (count: number) => {
    if (count === 0) {
      return 'bg-muted/40 dark:bg-zinc-800/40 border-border/40 text-muted-foreground/30 hover:border-primary/40'
    }
    if (count <= 2) {
      return 'bg-emerald-500/20 dark:bg-emerald-500/25 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-medium'
    }
    if (count <= 5) {
      return 'bg-emerald-500/50 dark:bg-emerald-500/60 border-emerald-400 text-white font-bold shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
    }
    return 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-300 text-white font-black shadow-[0_2px_12px_rgba(16,185,129,0.45)]'
  }

  // 星期简称
  const getWeekday = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00`)
      return d.toLocaleDateString(locale, { weekday: 'short' })
    } catch {
      return ''
    }
  }

  const activeItem = hoveredDate ? activities.find((a) => a.date === hoveredDate) : null

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-4 sm:p-5 shadow-sm space-y-4 select-none">
      {/* 顶部标题与数据概览 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
              <span>{t('repair.activityTitle')}</span>
              {totalSyncs > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  {t('repair.activeDays', { count: activeDays })}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t('repair.activityHint')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground self-end sm:self-auto">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 border border-border/60">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>{t('repair.syncCount', { count: totalSyncs })}</span>
          </span>
        </div>
      </div>

      {/* 14 天热力方格栅格：桌面端单行 14 列自适应铺开，手机端两行 7 列整齐排布 */}
      <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 sm:gap-2 pt-1">
        {activities.map((act) => {
          const dayLabel = act.date.slice(5) // "MM-DD"
          const weekday = getWeekday(act.date)
          const isHovered = hoveredDate === act.date

          return (
            <button
              type="button"
              key={act.date}
              onFocus={() => setHoveredDate(act.date)}
              onMouseEnter={() => setHoveredDate(act.date)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => setHoveredDate(hoveredDate === act.date ? null : act.date)}
              className={cn(
                'flex flex-col items-center gap-1 p-1 rounded-xl transition-all duration-200 group text-left cursor-pointer',
                isHovered ? 'bg-primary/10 scale-105 shadow-sm' : 'hover:bg-muted/40'
              )}
            >
              <span className="text-[9px] text-muted-foreground/80 font-mono scale-90 origin-center group-hover:text-foreground">
                {weekday}
              </span>

              <div
                className={cn(
                  'w-full aspect-square max-w-[42px] rounded-lg border flex items-center justify-center text-[10px] font-mono transition-transform duration-200',
                  getLevelStyle(act.count),
                  isHovered && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background'
                )}
              >
                {act.count > 0 ? act.count : ''}
              </div>

              <span className="text-[9px] text-muted-foreground font-mono group-hover:text-foreground whitespace-nowrap">
                {dayLabel}
              </span>
            </button>
          )
        })}
      </div>

      {/* 交互透视与变动聚合微标 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-border/50 text-xs">
        {activeItem ? (
          <div className="flex items-center gap-2 text-[11px] font-mono animate-in fade-in duration-200">
            <span className="font-semibold text-foreground">{activeItem.date} ({getWeekday(activeItem.date)})：</span>
            <span className="text-primary font-bold">{t('repair.syncCount', { count: activeItem.count })}</span>
            <span className="text-muted-foreground/60">|</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{activeItem.added}</span>
            <span className="text-sky-600 dark:text-sky-400 font-semibold">~{activeItem.updated}</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">-{activeItem.deleted}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span>{t('repair.changes')}</span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{totalAdded}</span>
            <span className="text-sky-600 dark:text-sky-400 font-bold">~{totalUpdated}</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">-{totalDeleted}</span>
          </div>
        )}

        {/* GitHub 风格图例 */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground self-end sm:self-auto font-mono">
          <span>{t('repair.less')}</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-muted/40 border border-border/40" />
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/25 border border-emerald-500/40" />
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60 border border-emerald-400" />
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600 border border-emerald-300" />
          <span>{t('repair.more')}</span>
        </div>
      </div>
    </div>
  )
}
