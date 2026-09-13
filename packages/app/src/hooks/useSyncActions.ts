/**
 * 同步动作与视图状态（自 SyncView 抽出的状态与处理器）
 * 拥有：同步状态/提示消息/抽屉开合/强制覆盖确认；处理器体与原实现逐字一致。
 * 跨 hook 的刷新回调（快照、云端备份列表）通过 refreshers ref 延迟取用，避免循环依赖
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { clearLastBackupFileInfo } from '../core/sync/sync-settings'
import { resetScheduledSync } from '../application'
import {
  smartPullInBackground,
  smartPushInBackground,
  smartSyncInBackground,
} from '../application/background-ops'
import { translateSyncMessage } from '../i18n/sync-messages'
import type { Locale } from '../i18n'
import type { WebDAVConfig } from '../core/storage/types'

export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'success' | 'error'
export type DrawerMode = 'conflict' | 'history' | 'cloudBackups' | 'actions'

export interface SyncRefreshers {
  loadSnapshots: () => void | Promise<void>
  loadCloudBackups: () => void | Promise<void>
}

export interface SyncActionsContext {
  t: (key: string, vars?: Record<string, string | number>) => string
  locale: Locale
  isConfigured: boolean
  isOnline: boolean
  /** 当前本地书签数（守卫用，渲染期取值） */
  localCount: number
  getConfig: () => WebDAVConfig
  loadCounts: () => void | Promise<void>
  setCloudMeta: (meta: { time: number; device: string; count: number; browser?: string } | null) => void
  /** 其余 hooks 的刷新函数（ref 延迟取用，避免 hook 间循环依赖） */
  refreshers: { current: SyncRefreshers }
}

export function useSyncActions(ctx: SyncActionsContext) {
  const { t, locale, isConfigured, isOnline, localCount, getConfig, loadCounts, setCloudMeta, refreshers } = ctx

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [msg, setMsg] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('conflict')
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false)
  const [confirmPushOpen, setConfirmPushOpen] = useState(false)
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 安全设置消息清除定时器
  const scheduleMsgClear = useCallback((delayMs = 3000) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    msgTimerRef.current = setTimeout(() => { setMsg(''); msgTimerRef.current = null }, delayMs)
  }, [])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current) }
  }, [])

  const isSyncBusy = syncStatus === 'checking' || syncStatus === 'syncing'

  const showGenericFailure = (message: string) => {
    setSyncStatus('error')
    setMsg(message)
  }

  const handleSmartSync = async () => {
    if (!isConfigured) return

    setSyncStatus('checking')
    setMsg(t('sync.status.analyzing'))

    try {
      // 在后台 Service Worker 中执行，关闭面板不会中断
      const result = await smartSyncInBackground(getConfig())

      // 更新云端信息显示
      if (result.cloudInfo?.exists) {
        setCloudMeta({
          time: result.cloudInfo.timestamp || 0,
          device: result.cloudInfo.browser || '',
          count: result.cloudInfo.totalCount || 0,
          browser: result.cloudInfo.browser,
        })
      }

      // 处理结果
      if (result.needsConflictResolution) {
        // 需要用户选择同步方向
        setMsg(translateSyncMessage(locale, result.message))
        setDrawerMode('conflict')
        setDrawerOpen(true)
        setSyncStatus('idle')
        return
      }

      if (result.success) {
        setSyncStatus('success')
        setMsg(translateSyncMessage(locale, result.message))
        loadCounts()

        // 重置定时同步计时器，避免手动同步后立即触发定时同步
        await resetScheduledSync()

        scheduleMsgClear()
      } else {
        if (result.message === '同步正在进行中') {
          toast.info(t('sync.toast.syncInProgress'))
          setSyncStatus('idle')
        } else {
          showGenericFailure(translateSyncMessage(locale, result.message))
        }
      }
    } catch (e) {
      showGenericFailure(t('sync.connectionFailed'))
    }
  }

  const executePush = async () => {
    setSyncStatus('syncing')
    setMsg(t('sync.status.uploading'))
    try {
      // 在后台 Service Worker 中执行，关闭面板不会中断
      const result = await smartPushInBackground(getConfig())

      if (result.success) {
        setSyncStatus('success')
        setMsg(translateSyncMessage(locale, result.message))
        setDrawerOpen(false)
        loadCounts()
        refreshers.current.loadSnapshots() // 刷新快照列表

        // 重置定时同步计时器
        await resetScheduledSync()
        scheduleMsgClear()
      } else {
        if (result.message === '同步正在进行中') {
          toast.info(t('sync.toast.syncInProgress'))
          setSyncStatus('idle')
        } else {
          showGenericFailure(translateSyncMessage(locale, result.message))
        }
      }
    } catch (e) {
      showGenericFailure(t('sync.uploadFailed'))
    }
  }

  // 强制创建新备份（忽略时间窗口）
  const forceNewBackup = async () => {
    try {
      await clearLastBackupFileInfo()
      toast.success(t('sync.toast.forceNewBackupTitle'), {
        description: t('sync.toast.forceNewBackupDesc'),
      })
    } catch (e) {
      toast.error(t('sync.toast.opFailed'), {
        description: (e as Error).message || t('common.unknownError'),
      })
    }
  }

  const executePull = async (mode: 'overwrite' | 'merge') => {
    setSyncStatus('syncing')
    setMsg(mode === 'overwrite' ? t('sync.status.restoring') : t('sync.status.merging'))

    // 提示用户操作在后台执行（运行于 Service Worker，关闭面板不会中断）
    const loadingToast = toast.loading(
      mode === 'overwrite' ? t('sync.status.restoring') : t('sync.status.merging'),
      { description: t('sync.toast.backgroundHint') },
    )

    try {
      const result = await smartPullInBackground(getConfig(), mode)

      toast.dismiss(loadingToast)

      if (result.success) {
        setSyncStatus('success')
        setMsg(translateSyncMessage(locale, result.message))
        setDrawerOpen(false)
        loadCounts()
        refreshers.current.loadSnapshots() // 刷新快照列表

        // 重置定时同步计时器
        await resetScheduledSync()

        scheduleMsgClear()
        toast.success(t('sync.toast.restoreSuccess'), {
          description: mode === 'merge' ? t('sync.toast.restoredMergedBookmarks') : t('sync.toast.restoredBookmarks'),
        })
      } else {
        if (result.message === '同步正在进行中') {
          toast.info(t('sync.toast.syncInProgress'))
          setSyncStatus('idle')
        } else {
          showGenericFailure(translateSyncMessage(locale, result.message))
          toast.error(t('sync.toast.restoreFailed'), { description: translateSyncMessage(locale, result.message) })
        }
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      setSyncStatus('error')
      setMsg(t('sync.toast.restoreFailed'))
      toast.error(t('sync.toast.restoreFailed'), { description: (e as Error).message })
    }
  }

  const requestForcePush = () => {
    if (!isOnline || localCount === 0 || isSyncBusy) return
    setDrawerOpen(false)
    setConfirmPushOpen(true)
  }

  const confirmForcePush = async () => {
    if (!isOnline || localCount === 0 || isSyncBusy) return
    setConfirmPushOpen(false)
    await executePush()
  }

  const openMoreActions = () => {
    setDrawerMode('actions')
    setDrawerOpen(true)
  }

  // 打开云端备份列表
  const openCloudBackups = () => {
    setDrawerMode('cloudBackups')
    setDrawerOpen(true)
    refreshers.current.loadCloudBackups()
  }

  return {
    // 状态
    syncStatus,
    msg,
    drawerOpen,
    drawerMode,
    confirmDrawerOpen,
    confirmPushOpen,
    isSyncBusy,
    // 状态操作（供其他 hooks 的 ctx 使用）
    setSyncStatus,
    setMsg,
    setDrawerOpen,
    closeDrawer: () => setDrawerOpen(false),
    openHistory: () => { setDrawerMode('history'); setDrawerOpen(true) },
    closeConfirmPush: () => setConfirmPushOpen(false),
    openConfirm: () => setConfirmDrawerOpen(true),
    closeConfirm: () => setConfirmDrawerOpen(false),
    // 动作
    handleSmartSync,
    executePush,
    executePull,
    forceNewBackup,
    requestForcePush,
    confirmForcePush,
    openMoreActions,
    openCloudBackups,
  }
}
