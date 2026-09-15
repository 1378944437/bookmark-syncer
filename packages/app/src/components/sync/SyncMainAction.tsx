/**
 * 居中主同步动作大圆按钮
 * 解除原右下角小按钮的物理重叠，恢复大圆点击区域的纯粹性
 */
import { Cloud, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '../../infrastructure/utils/format'
import type { SyncStatus } from '../../hooks/useSyncActions'

export interface SyncMainActionProps {
  isOnline: boolean
  isConfigured: boolean
  syncStatus: SyncStatus
  isSyncBusy: boolean
  onSync: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SyncMainAction({
  isOnline,
  isConfigured,
  syncStatus,
  isSyncBusy,
  onSync,
  t,
}: SyncMainActionProps) {
  const isActionDisabled =
    !isConfigured || !isOnline || (syncStatus !== 'idle' && syncStatus !== 'success' && syncStatus !== 'error')

  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={onSync}
        disabled={isActionDisabled}
        className={cn(
          "group relative w-40 h-40 rounded-full glass-panel flex flex-col items-center justify-center transition-all shadow-xl select-none",
          isOnline
            ? "hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
            : "opacity-50 grayscale cursor-not-allowed"
        )}
      >
        {/* 背景微光呼吸动效 */}
        {isOnline && (
          <div className="absolute inset-0 rounded-full bg-indigo-600/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        )}

        {/* 状态图标 */}
        {!isOnline ? (
          <WifiOff className="w-12 h-12 text-muted-foreground" />
        ) : isSyncBusy ? (
          <RefreshCw className="w-12 h-12 text-primary animate-spin" />
        ) : (
          <Cloud className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
        )}

        {/* 按钮状态文案 */}
        <span className="mt-3 text-sm font-medium text-secondary-foreground tracking-wide">
          {!isOnline
            ? t('sync.syncButton.offline')
            : syncStatus === 'checking'
            ? t('sync.syncButton.analyzing')
            : syncStatus === 'syncing'
            ? t('sync.syncButton.syncing')
            : syncStatus === 'success'
            ? t('sync.syncButton.done')
            : t('sync.syncButton.syncNow')}
        </span>
      </button>
    </div>
  )
}
