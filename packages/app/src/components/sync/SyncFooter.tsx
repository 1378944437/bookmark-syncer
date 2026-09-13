/**
 * 同步主界面底栏
 * 展示真实快照数量徽标与展开指示箭头，消除硬编码占位符
 */
import { ChevronRight, History } from 'lucide-react'

export interface SyncFooterProps {
  t: (key: string, vars?: Record<string, string | number>) => string
  snapshotCount: number
  onOpenHistory: () => void
}

export function SyncFooter({ t, snapshotCount, onOpenHistory }: SyncFooterProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenHistory}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenHistory()
        }
      }}
      className="group mt-auto glass-panel border-x-0 border-b-0 rounded-b-none -mx-4 px-6 py-3 flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors select-none"
    >
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          {t('sync.viewSnapshots')}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {snapshotCount > 0 ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-500/20">
            {t('sync.footer.snapshotCount', { count: snapshotCount })}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/70">
            {t('sync.footer.noSnapshots')}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  )
}
