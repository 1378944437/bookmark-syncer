/**
 * 云端备份列表与恢复流程（自 SyncView 抽出的状态与处理器）
 * 处理器逻辑与原实现逐字一致，仅将确认抽屉开合与计数刷新改为 ctx 回调
 */
import { useState } from 'react'
import { toast } from 'sonner'
import type { WebDAVConfig } from '../core/storage/types'
import { getCloudBackupList, getDeviceIdentity, type CloudBackupFile } from '../core/sync'
import { restoreCloudBackupInBackground } from '../application/background-ops'
import { translateSyncMessage } from '../i18n/sync-messages'
import type { Locale } from '../i18n'
import type { SyncViewContext } from './useSnapshots'

export interface CloudBackupsContext extends SyncViewContext {
  isConfigured: boolean
  getConfig: () => WebDAVConfig | null
  locale: Locale
  /** 恢复成功后刷新快照列表（可选） */
  loadSnapshots?: () => void | Promise<void>
}

export function useCloudBackups(ctx: CloudBackupsContext) {
  const { t, isConfigured, getConfig, locale, setSyncStatus, setMsg, setDrawerOpen, openConfirm, closeConfirm, loadCounts, loadSnapshots } = ctx
  const [cloudBackups, setCloudBackups] = useState<CloudBackupFile[]>([])
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false)
  const [pendingRestoreCloudBackup, setPendingRestoreCloudBackup] = useState<CloudBackupFile | null>(null)

  /** 加载云端备份列表 */
  const loadCloudBackups = async () => {
    if (!isConfigured) return

    setLoadingCloudBackups(true)
    try {
      // 使用缓存，避免频繁 PROPFIND
      const list = await getCloudBackupList(getConfig() as WebDAVConfig, false)

      // 尝试匹配本机或已知设备名称，提升云端列表可读性
      try {
        const identity = await getDeviceIdentity()
        const myTag = identity.deviceId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()
        const enriched = list.map((item) => {
          if (item.deviceName) return item
          if (item.deviceTag && item.deviceTag === myTag) {
            return {
              ...item,
              deviceName: identity.deviceName ? `${identity.deviceName} (本机)` : '本机',
            }
          }
          return item
        })
        setCloudBackups(enriched)
      } catch {
        setCloudBackups(list)
      }
    } catch (error) {
      console.error('Failed to load cloud backups:', error)
      toast.error(t('sync.toast.loadCloudListFailed'))
    } finally {
      setLoadingCloudBackups(false)
    }
  }

  /** 请求从云端备份恢复 */
  const requestRestoreCloudBackup = (backup: CloudBackupFile) => {
    setPendingRestoreCloudBackup(backup)
    openConfirm()
  }

  /** 确认从云端备份恢复 */
  const confirmRestoreCloudBackup = async () => {
    if (!pendingRestoreCloudBackup) return

    setSyncStatus('syncing')
    setMsg(t('sync.status.restoreFromCloud'))
    closeConfirm()
    setDrawerOpen(false)

    // 提示用户操作在后台执行（运行于 Service Worker，关闭面板不会中断）
    const loadingToast = toast.loading(t('sync.status.restoreFromCloud'), {
      description: t('sync.toast.backgroundHint'),
    })

    try {
      const result = await restoreCloudBackupInBackground(getConfig() as WebDAVConfig, pendingRestoreCloudBackup.path)

      toast.dismiss(loadingToast)

      if (result.success) {
        setSyncStatus('success')
        setMsg(translateSyncMessage(locale, result.message))
        loadCounts()
        loadSnapshots?.() // 刷新快照列表（若提供）
        toast.success(t('sync.toast.restoreSuccess'), { description: t('sync.toast.restoredFromCloud') })
      } else {
        setSyncStatus('error')
        setMsg(translateSyncMessage(locale, result.message))
        toast.error(t('sync.toast.restoreFailed'), { description: translateSyncMessage(locale, result.message) })
      }
    } catch (e) {
      toast.dismiss(loadingToast)
      setSyncStatus('error')
      setMsg(t('sync.toast.restoreFailed'))
      toast.error(t('sync.toast.restoreFailed'), { description: (e as Error).message })
    } finally {
      setPendingRestoreCloudBackup(null)
    }
  }

  /** 清除待恢复云端备份（取消恢复） */
  const clearPendingRestoreCloudBackup = () => setPendingRestoreCloudBackup(null)

  return {
    cloudBackups,
    loadingCloudBackups,
    pendingRestoreCloudBackup,
    loadCloudBackups,
    requestRestoreCloudBackup,
    confirmRestoreCloudBackup,
    clearPendingRestoreCloudBackup,
  }
}
