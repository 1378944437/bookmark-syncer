/**
 * 大屏控制台：同步仪表盘视图
 * 宽屏双栏现代布局：左侧核心同步状态与快捷操作，右侧 14 天热力图与完整同步明细
 */
import { useEffect, useRef } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Clock,
  Cloud,
  HardDrive,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { snapshotManager } from '../../core/backup'
import { bookmarkRepository, countBookmarks } from '../../core/bookmark'
import { useStorage } from '../../hooks/useStorage'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useBookmarkCounts } from '../../hooks/useBookmarkCounts'
import { useSyncActions } from '../../hooks/useSyncActions'
import { useI18n } from '../../i18n'
import { useActiveStorage } from '../../hooks/useActiveStorage'
import { cn } from '../../infrastructure/utils/format'
import { Button } from '../Button'
import { SafetyConfirmationCard } from '../sync/SafetyConfirmationCard'
import { SyncActivityPanel } from '../analytics/SyncActivityPanel'

export function FullTabDashboard() {
  const { t, locale } = useI18n()
  const { isConfigured, getConfig, hostLabel, accountLabel } = useActiveStorage()
  const [syncState] = useStorage<{ time: number; url: string; type: string } | null>('syncState', null)
  const [lastRemoteDevice] = useStorage<{ deviceId?: string; deviceName?: string; time: number } | null>(
    'last_remote_device',
    null
  )
  const isOnline = useOnlineStatus()

  const countsApi = useBookmarkCounts({ t, isConfigured, getConfig })
  const refreshersRef = useRef({ loadSnapshots: () => {}, loadCloudBackups: () => {} })

  const actionsApi = useSyncActions({
    t,
    locale,
    isConfigured,
    isOnline,
    localCount: countsApi.localCount,
    getConfig,
    loadCounts: countsApi.loadCounts,
    setCloudMeta: countsApi.setCloudMeta,
    refreshers: refreshersRef,
  })

  useEffect(() => {
    const signal = { aborted: false }
    countsApi.loadCounts(signal)
    return () => {
      signal.aborted = true
    }
  }, [isConfigured, syncState?.time])

  const isSynced =
    isConfigured &&
    !countsApi.loading &&
    countsApi.localCount > 0 &&
    countsApi.localCount === countsApi.cloudCount

  // 手动快速创建快照
  const handleCreateSnapshot = async () => {
    try {
      const tree = await bookmarkRepository.getTree()
      const count = countBookmarks(tree)
      await snapshotManager.createSnapshot(tree, count, '手动创建 (手动 备份)')
      toast.success('已成功生成本地快照')
    } catch (e) {
      toast.error('创建快照失败', { description: (e as Error).message })
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 w-full items-start">
      {/* 左栏：核心同步控制与状态卡片 */}
      <div className="lg:col-span-5 xl:col-span-4 space-y-5">
        {/* 安全熔断二次确认卡片（如触发防误删保护） */}
        <SafetyConfirmationCard
          t={t}
          getConfig={getConfig}
          onOpenHistory={() => {}}
          loadCounts={countsApi.loadCounts}
        />

        {/* 同步状态与操作主卡片 */}
        <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground">{hostLabel}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {accountLabel}
                </p>
              </div>
            </div>
            {isSynced ? (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> 两端已一致
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                <Clock className="w-3.5 h-3.5" /> 待同步
              </span>
            )}
          </div>

          {/* 本地与云端双计数栅格 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HardDrive className="w-4 h-4" />
                <span>本地书签</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-1 text-foreground tracking-tight">
                {countsApi.localCount}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cloud className="w-4 h-4" />
                <span>云端备份</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-1 text-foreground tracking-tight">
                {countsApi.cloudCount > 0 ? countsApi.cloudCount : '-'}
              </div>
            </div>
          </div>

          {/* 同步设备与时间元信息 */}
          <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/20 p-2.5 sm:p-3 rounded-xl border border-border/40 font-mono">
            {syncState?.time && (
              <p className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>最近同步：{new Date(syncState.time).toLocaleString()}</span>
              </p>
            )}
            {lastRemoteDevice?.deviceName && (
              <p className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>关联设备：{lastRemoteDevice.deviceName}</span>
              </p>
            )}
          </div>

          {/* 主动作大按钮 */}
          <div className="pt-1">
            <Button
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold shadow-md shadow-indigo-500/20 gap-2"
              disabled={!isOnline || !isConfigured || actionsApi.isSyncBusy}
              onClick={actionsApi.handleSmartSync}
            >
              <RefreshCw className={cn('w-4 h-4 sm:w-5 sm:h-5', actionsApi.isSyncBusy && 'animate-spin')} />
              <span>{actionsApi.isSyncBusy ? '正在同步中...' : '立即双向同步'}</span>
            </Button>
          </div>

          {/* 快捷二级操作栏 */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm gap-1.5 h-9 sm:h-10"
              disabled={!isOnline || !isConfigured || actionsApi.isSyncBusy}
              onClick={actionsApi.executePush}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> 覆盖推送到云端
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm gap-1.5 h-9 sm:h-10"
              disabled={!isOnline || !isConfigured || actionsApi.isSyncBusy}
              onClick={() => actionsApi.executePull('merge')}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-sky-500 shrink-0" /> 从云端拉取恢复
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm gap-1.5 h-9 sm:h-10"
              onClick={handleCreateSnapshot}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> 快速生成本地快照
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm gap-1.5 h-9 sm:h-10"
              onClick={actionsApi.forceNewBackup}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" /> 强制创建新文件
            </Button>
          </div>
        </div>
      </div>

      {/* 右栏：14 天活跃热力图与同步日志流水 */}
      <div className="lg:col-span-7 xl:col-span-8 rounded-2xl border border-border bg-card/70 backdrop-blur-xl p-4 sm:p-6 shadow-sm">
        <SyncActivityPanel maxHeightClass="max-h-[480px]" />
      </div>
    </div>
  )
}
