/**
 * 快照列表与恢复流程（自 SyncView 抽出的状态与处理器）
 * 视图侧通过 SyncViewContext 提供状态提示、确认抽屉与计数刷新回调，
 * 处理器逻辑与原实现逐字一致
 */
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { snapshotManager, type Snapshot } from '../core/backup'
import { bookmarkRepository, countBookmarks } from '../core/bookmark'
import { holdRestoringUntil, setIsRestoring } from '../core/sync/sync-settings'

export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'success' | 'error'

export interface SyncViewContext {
  t: (key: string, vars?: Record<string, string | number>) => string
  setSyncStatus: (status: SyncStatus) => void
  setMsg: (message: string) => void
  setDrawerOpen: (open: boolean) => void
  /** 打开/关闭恢复确认抽屉 */
  openConfirm: () => void
  closeConfirm: () => void
  /** 本地/云端计数刷新 */
  loadCounts: () => void
}

export function useSnapshots(ctx: SyncViewContext) {
  const { t, setSyncStatus, setMsg, setDrawerOpen, openConfirm, closeConfirm, loadCounts } = ctx
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] = useState<Snapshot | null>(null)

  /** 加载本地快照列表 */
  const loadSnapshots = useCallback(async () => {
    try {
      const list = await snapshotManager.getAllSnapshots()
      setSnapshots(list)
    } catch (error) {
      console.error('[SyncView] Failed to load snapshots:', error)
      // 快照加载失败不影响主要功能，仅记录日志
    }
  }, [])

  /** 请求恢复快照（打开确认 Drawer） */
  const requestRestoreSnapshot = (snapshot: Snapshot) => {
    setPendingRestoreSnapshot(snapshot)
    openConfirm()
  }

  /** 确认恢复快照 */
  const confirmRestoreSnapshot = async () => {
    if (!pendingRestoreSnapshot) return

    setSyncStatus('syncing')
    setMsg(t('sync.status.restoreSnapshot'))
    closeConfirm()
    setDrawerOpen(false)

    try {
      await setIsRestoring(true)

      // 先备份当前状态（本地快照恢复前）
      const currentTree = await bookmarkRepository.getTree()
      const currentCount = countBookmarks(currentTree)
      await snapshotManager.createSnapshot(currentTree, currentCount, t('sync.confirmRestore.snapshotBackupReason'))

      await bookmarkRepository.restoreFromBackup(pendingRestoreSnapshot.tree)

      setSyncStatus('success')
      setMsg(t('sync.toast.snapshotRestoreSuccess'))
      loadCounts()
      loadSnapshots()
      toast.success(t('sync.toast.snapshotRestoreSuccess'))
    } catch (e) {
      setSyncStatus('error')
      setMsg(t('sync.toast.restoreFailed'))
      toast.error(t('sync.toast.restoreFailed'), { description: (e as Error).message })
    } finally {
      await holdRestoringUntil()

      setPendingRestoreSnapshot(null)
    }
  }

  /** 清除待恢复快照（取消恢复） */
  const clearPendingRestoreSnapshot = () => setPendingRestoreSnapshot(null)

  return {
    snapshots,
    loadSnapshots,
    pendingRestoreSnapshot,
    requestRestoreSnapshot,
    confirmRestoreSnapshot,
    clearPendingRestoreSnapshot,
  }
}
