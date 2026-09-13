/**
 * 更多同步选项操作抽屉面板
 * 包含进入云端备份与强制覆盖云端入口
 */
import { AlertTriangle, Download } from 'lucide-react'
import type { ClassValue } from 'clsx'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface ActionsPanelProps {
  t: Translate
  cn: (...inputs: ClassValue[]) => string
  isOnline: boolean
  isSyncBusy: boolean
  localCount: number
  openCloudBackups: () => void
  requestForcePush: () => void
}

export function ActionsPanel({
  t,
  cn,
  isOnline,
  isSyncBusy,
  localCount,
  openCloudBackups,
  requestForcePush,
}: ActionsPanelProps) {
  return (
    <div className="space-y-2 pt-2">
      <button
        type="button"
        onClick={openCloudBackups}
        disabled={!isOnline || isSyncBusy}
        className={cn(
          "w-full rounded-xl bg-muted/70 border border-border p-4 text-left transition-colors",
          !isOnline || isSyncBusy
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-primary/50 hover:bg-accent/70"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">
              {t('sync.actions.viewCloudBackups')}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t('sync.actions.viewCloudBackupsDesc')}
            </div>
          </div>
        </div>
      </button>

      <div className="h-px bg-border/70 my-3" />

      <button
        type="button"
        onClick={requestForcePush}
        disabled={!isOnline || localCount === 0 || isSyncBusy}
        className={cn(
          "w-full rounded-xl border p-4 text-left transition-colors",
          !isOnline || localCount === 0 || isSyncBusy
            ? "bg-muted/40 border-border opacity-50 cursor-not-allowed"
            : "bg-destructive/5 border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-destructive">
              {t('sync.actions.overwriteCloud')}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {localCount === 0
                ? t('sync.actions.overwriteCloudEmpty')
                : t('sync.actions.overwriteCloudDesc')}
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}
