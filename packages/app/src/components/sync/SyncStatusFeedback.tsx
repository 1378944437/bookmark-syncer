/**
 * 同步状态反馈与二级操作区
 * 提供细粒度步骤推进感知、可一键复制的结构化错误气泡及解耦的“更多同步选项”入口
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Check, Copy, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../../infrastructure/utils/format'
import type { SyncStatus } from '../../hooks/useSyncActions'

export interface SyncStatusFeedbackProps {
  t: (key: string, vars?: Record<string, string | number>) => string
  isOnline: boolean
  isSyncBusy: boolean
  syncStatus: SyncStatus
  msg: string
  cloudMeta: { time: number; device: string; count: number; browser?: string } | null
  lastRemoteDevice: { deviceId?: string; deviceName?: string; time: number } | null
  onOpenMoreActions: () => void
}

export function SyncStatusFeedback({
  t,
  isOnline,
  isSyncBusy,
  syncStatus,
  msg,
  cloudMeta,
  lastRemoteDevice,
  onOpenMoreActions,
}: SyncStatusFeedbackProps) {
  const [copied, setCopied] = useState(false)
  const [stepText, setStepText] = useState<string>('')

  // 在同步长耗时场景下，根据耗时动态切换微步骤文案，提升可预期性
  useEffect(() => {
    if (!isSyncBusy) {
      setStepText('')
      return
    }
    setStepText(t('sync.status.connecting'))
    const timer1 = setTimeout(() => {
      setStepText(t('sync.status.analyzing'))
    }, 800)
    const timer2 = setTimeout(() => {
      setStepText(t('sync.status.syncing'))
    }, 2200)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isSyncBusy, t])

  // 复制异常报错信息
  const handleCopyError = async () => {
    if (!msg) return
    try {
      await navigator.clipboard.writeText(msg)
      setCopied(true)
      toast.success(t('common.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 剪贴板权限异常时降级处理
      toast.error(t('common.unknownError'))
    }
  }

  return (
    <div className="flex flex-col items-center space-y-3 w-full px-2">
      {/* 状态与元信息展示区 */}
      <div className="min-h-[28px] w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          {syncStatus === 'error' && msg ? (
            /* 结构化错误气泡：带警示图标与一键复制 */
            <motion.div
              key="error-box"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 max-w-[92%] px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs shadow-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[200px]" title={msg}>
                {msg}
              </span>
              <button
                type="button"
                onClick={handleCopyError}
                className="p-1 rounded hover:bg-destructive/15 transition-colors shrink-0"
                title={t('common.copy')}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </motion.div>
          ) : isSyncBusy ? (
            /* 细粒度同步阶段感知提示 */
            <motion.div
              key="busy-step"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 text-xs font-medium text-primary"
            >
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>{stepText || msg || t('sync.status.analyzing')}</span>
            </motion.div>
          ) : msg ? (
            /* 普通提示（成功或普通状态） */
            <motion.span
              key="msg"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                "text-xs font-medium",
                syncStatus === 'success' ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              )}
            >
              {msg}
            </motion.span>
          ) : cloudMeta ? (
            /* 云端最后更新时间与设备说明 */
            <motion.span
              key="meta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] text-muted-foreground text-center"
            >
              {t('sync.cloudUpdatedAt', { time: new Date(cloudMeta.time).toLocaleString() })}
              {cloudMeta.device ? ` (${cloudMeta.device})` : ''}
              {lastRemoteDevice?.deviceName ? ` · ${lastRemoteDevice.deviceName}` : ''}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {/* 独立的二级操作入口（彻底消除与大圆主按钮的物理重叠） */}
      <button
        type="button"
        onClick={onOpenMoreActions}
        disabled={!isOnline || isSyncBusy}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shadow-sm",
          isOnline && !isSyncBusy
            ? "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70 hover:border-primary/50 cursor-pointer active:scale-95"
            : "opacity-40 cursor-not-allowed bg-muted/30 border-transparent text-muted-foreground"
        )}
        title={t('sync.syncButton.moreOptions')}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
        <span>{t('sync.syncButton.moreOptions')}</span>
      </button>
    </div>
  )
}
