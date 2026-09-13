import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

import { motion } from 'framer-motion'
import { Cloud, History, MoreHorizontal, RefreshCw, WifiOff } from 'lucide-react'
import { clearLastBackupFileInfo, holdRestoringUntil, setIsRestoring } from '../core/sync/sync-settings'
import { resetScheduledSync } from '../application'
import {
  restoreCloudBackupInBackground,
  smartPullInBackground,
  smartPushInBackground,
  smartSyncInBackground,
} from '../application/background-ops'
import { snapshotManager, type Snapshot } from '../core/backup'
import { bookmarkRepository, countBookmarks } from '../core/bookmark'
import { getCloudBackupList, getCloudInfo, type CloudBackupFile } from '../core/sync'
import { useI18n } from '../i18n'
import { translateSyncMessage } from '../i18n/sync-messages'
import { useStorage } from '../hooks/useStorage'
import { cn } from '../infrastructure/utils/format'
import { Drawer } from './Drawer'
import { OverwriteConfirmDrawer, RestoreConfirmDrawer } from './sync/ConfirmDrawers'
import { ActionsPanel, CloudBackupsPanel, ConflictPanel, SnapshotHistoryPanel } from './sync/SyncDrawerPanels'
import { StatsCard } from './StatsCard'

import { toast } from 'sonner'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
}

export function SyncView() {
  const { t, locale } = useI18n()
  const [webdavUrl] = useStorage('webdav_url', '')
  const [username] = useStorage('webdav_username', '')
  const [password] = useStorage('webdav_password', '')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [syncState] = useStorage<{ time: number; url: string; type: string } | null>('syncState', null)
  const [lastRemoteDevice] = useStorage<{ deviceId?: string; deviceName?: string; time: number } | null>('last_remote_device', null)
  const isOnline = useOnlineStatus()
  
  const [localCount, setLocalCount] = useState(0)
  const [cloudCount, setCloudCount] = useState(0)
  const [cloudMeta, setCloudMeta] = useState<{ time: number, device: string, count: number, browser?: string } | null>(null)

  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'checking' | 'syncing' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'conflict' | 'history' | 'cloudBackups' | 'actions'>('conflict')
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false)
  const [confirmPushOpen, setConfirmPushOpen] = useState(false)
  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] = useState<Snapshot | null>(null)
  const [cloudBackups, setCloudBackups] = useState<CloudBackupFile[]>([])
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false)
  const [pendingRestoreCloudBackup, setPendingRestoreCloudBackup] = useState<CloudBackupFile | null>(null)
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

  // 后台同步完成时弹出轻提示（面板打开期间可见；自动消失，不打断操作）
  const lastSeenSyncTimeRef = useRef<number | null>(null)
  useEffect(() => {
    const time = syncState?.time
    if (!time) return
    const previous = lastSeenSyncTimeRef.current
    lastSeenSyncTimeRef.current = time
    // 首次加载已有状态不提示，只对“面板打开期间新完成”的同步提示
    if (previous !== null && time !== previous && syncState?.type !== 'skip_identical') {
      toast.success(t('sync.toast.completed'), { duration: 2000 })
    }
  }, [syncState?.time, syncState?.type, t])

  const isConfigured = !!webdavUrl

  const loadCounts = async (signal?: { aborted: boolean }) => {
    try {
      const count = await bookmarkRepository.getLocalCount()
      if (signal?.aborted) return
      setLocalCount(count)
      
      if (isConfigured) {
        setLoading(true) 
        try {
            // 使用 getCloudInfo 获取最新备份信息
            // 注意：由于可能有多设备同步，这里需要实时获取最新数据
            const cloudInfo = await getCloudInfo(getSyncConfig(), true)
            if (signal?.aborted) return
            
            if (cloudInfo.exists && cloudInfo.totalCount !== undefined) {
                setCloudCount(cloudInfo.totalCount)
                setCloudMeta({ 
                  time: cloudInfo.timestamp || 0, 
                  device: cloudInfo.browser || '', 
                  count: cloudInfo.totalCount,
                  browser: cloudInfo.browser 
                })
            } else {
                setCloudCount(0)
                setCloudMeta(null)
            }
        } catch (e) {
            if (signal?.aborted) return
            console.error('[SyncView] Failed to load cloud info:', e)
            toast.error(t('sync.toast.loadCloudInfoFailed'), {
              description: (e as Error).message || t('sync.toast.checkNetworkAndConfig')
            })
            setCloudCount(0)
            setCloudMeta(null)
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
      } else {
        setLoading(false)
      }
    } catch (e) { 
      if (signal?.aborted) return
      console.error('Failed to load counts:', e)
      setLoading(false) 
    }
  }

  // 注意：WebDAV 用户名/密码是异步从 storage 读取的。
  // 如果这里只依赖 webdavUrl，会出现「URL 先加载 → 立刻发请求但账号/密码还是空」的情况，导致首次 401。
  useEffect(() => {
    const signal = { aborted: false }
    loadCounts(signal); loadSnapshots()
    return () => { signal.aborted = true }
  }, [webdavUrl, username, password, syncState?.time])

  // 加载本地快照列表
  const loadSnapshots = async () => {
    try {
      const list = await snapshotManager.getAllSnapshots()
      setSnapshots(list)
    } catch (error) {
      console.error('[SyncView] Failed to load snapshots:', error)
      // 快照加载失败不影响主要功能，仅记录日志
    }
  }

  // 加载云端备份列表
  const loadCloudBackups = async () => {
    if (!isConfigured) return
    
    setLoadingCloudBackups(true)
    try {
      // 使用缓存，避免频繁 PROPFIND
      const list = await getCloudBackupList(getSyncConfig(), false)
      setCloudBackups(list)
    } catch (error) {
      console.error('Failed to load cloud backups:', error)
      toast.error(t('sync.toast.loadCloudListFailed'))
    } finally {
      setLoadingCloudBackups(false)
    }
  }

  // 请求从云端备份恢复
  const requestRestoreCloudBackup = (backup: CloudBackupFile) => {
    setPendingRestoreCloudBackup(backup)
    setConfirmDrawerOpen(true)
  }

  // 确认从云端备份恢复
  const confirmRestoreCloudBackup = async () => {
    if (!pendingRestoreCloudBackup) return
    
    setSyncStatus('syncing')
    setMsg(t('sync.status.restoreFromCloud'))
    setConfirmDrawerOpen(false)
    setDrawerOpen(false)
    
    // 提示用户操作在后台执行（运行于 Service Worker，关闭面板不会中断）
    const loadingToast = toast.loading(t('sync.status.restoreFromCloud'), { 
      description: t('sync.toast.backgroundHint') 
    })
    
    try {
      const result = await restoreCloudBackupInBackground(getSyncConfig(), pendingRestoreCloudBackup.path)
      
      toast.dismiss(loadingToast)
      
      if (result.success) {
        setSyncStatus('success')
        setMsg(translateSyncMessage(locale, result.message))
        loadCounts()
        loadSnapshots() // 刷新快照列表
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

  // 请求恢复快照（打开确认 Drawer）
  const requestRestoreSnapshot = (snapshot: Snapshot) => {
    setPendingRestoreSnapshot(snapshot)
    setConfirmDrawerOpen(true)
  }

  // 确认恢复快照
  const confirmRestoreSnapshot = async () => {
    if (!pendingRestoreSnapshot) return
    
    setSyncStatus('syncing')
    setMsg(t('sync.status.restoreSnapshot'))
    setConfirmDrawerOpen(false)
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

  // 取消恢复
  const cancelRestore = () => {
    setPendingRestoreSnapshot(null)
    setPendingRestoreCloudBackup(null)
    setConfirmDrawerOpen(false)
  }

  const openMoreActions = () => {
    setDrawerMode('actions')
    setDrawerOpen(true)
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

  // 打开云端备份列表
  const openCloudBackups = () => {
    setDrawerMode('cloudBackups')
    setDrawerOpen(true)
    loadCloudBackups()
  }

  // --- 智能无感同步逻辑 ---
  
  // 获取 syncService 需要的配置（URL/用户名去首尾空格；密码保留原样，避免破坏含首尾空格的真实密码）
  const getSyncConfig = () => {
    const config = { 
      url: webdavUrl.trim(), 
      username: username.trim(), 
      password: password
    };
    console.log('[SyncView] Getting sync config:', { url: config.url, hasPassword: !!config.password });
    return config;
  }
  
  const handleSmartSync = async () => {
      if (!isConfigured) return
      
      setSyncStatus('checking')
      setMsg(t('sync.status.analyzing'))
      
      try {
          // 在后台 Service Worker 中执行，关闭面板不会中断
          const result = await smartSyncInBackground(getSyncConfig())
          
          // 更新云端信息显示
          if (result.cloudInfo?.exists) {
              setCloudMeta({
                  time: result.cloudInfo.timestamp || 0,
                  device: result.cloudInfo.browser || '',
                  count: result.cloudInfo.totalCount || 0,
                  browser: result.cloudInfo.browser
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
                  setSyncStatus('error')
                  setMsg(translateSyncMessage(locale, result.message))
              }
          }
      } catch (e) {
          setSyncStatus('error')
          setMsg(t('sync.connectionFailed'))
      }
  }

  const executePush = async () => {
      setSyncStatus('syncing')
      setMsg(t('sync.status.uploading'))
      try {
          // 在后台 Service Worker 中执行，关闭面板不会中断
          const result = await smartPushInBackground(getSyncConfig())
          
          if (result.success) {
              setSyncStatus('success')
              setMsg(translateSyncMessage(locale, result.message))
              setDrawerOpen(false)
              loadCounts()
              loadSnapshots() // 刷新快照列表
              
              // 重置定时同步计时器
              await resetScheduledSync()
              scheduleMsgClear()
          } else {
              if (result.message === '同步正在进行中') {
                  toast.info(t('sync.toast.syncInProgress'))
                  setSyncStatus('idle')
              } else {
                  setSyncStatus('error')
                  setMsg(translateSyncMessage(locale, result.message))
              }
          }
      } catch (e) {
          setSyncStatus('error')
          setMsg(t('sync.uploadFailed'))
      }
  }

  // 强制创建新备份（忽略时间窗口）
  const forceNewBackup = async () => {
      try {
          await clearLastBackupFileInfo()
          toast.success(t('sync.toast.forceNewBackupTitle'), { 
              description: t('sync.toast.forceNewBackupDesc') 
          })
      } catch (e) {
          toast.error(t('sync.toast.opFailed'), {
              description: (e as Error).message || t('common.unknownError')
          })
      }
  }

  const executePull = async (mode: 'overwrite' | 'merge') => {
      setSyncStatus('syncing') 
      setMsg(mode === 'overwrite' ? t('sync.status.restoring') : t('sync.status.merging'))
      
      // 提示用户操作在后台执行（运行于 Service Worker，关闭面板不会中断）
      const loadingToast = toast.loading(
        mode === 'overwrite' ? t('sync.status.restoring') : t('sync.status.merging'), 
        { description: t('sync.toast.backgroundHint') }
      )
      
      try {
          const result = await smartPullInBackground(getSyncConfig(), mode)
          
          toast.dismiss(loadingToast)
          
          if (result.success) {
              setSyncStatus('success')
              setMsg(translateSyncMessage(locale, result.message))
              setDrawerOpen(false)
              loadCounts()
              loadSnapshots() // 刷新快照列表
              
              // 重置定时同步计时器
              await resetScheduledSync()
              
              scheduleMsgClear()
              toast.success(t('sync.toast.restoreSuccess'), { 
                description: mode === 'merge' ? t('sync.toast.restoredMergedBookmarks') : t('sync.toast.restoredBookmarks') 
              })
          } else {
              if (result.message === '同步正在进行中') {
                  toast.info(t('sync.toast.syncInProgress'))
                  setSyncStatus('idle')
              } else {
                  setSyncStatus('error')
                  setMsg(translateSyncMessage(locale, result.message))
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

  const isSyncBusy = syncStatus === 'checking' || syncStatus === 'syncing'

  return (
    <>
    <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 pt-4 h-full flex flex-col relative"
    >
      {/* Offline Alert */}
      {!isOnline && (
         <motion.div variants={item} className="px-4 py-2 mx-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>{t('sync.offlineBanner')}</span>
         </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 px-1">
        <StatsCard label={t('sync.stats.local')} count={localCount} loading={false} color="zinc" />
        <StatsCard label={t('sync.stats.cloud')} count={cloudCount} loading={loading} color="indigo" />
      </motion.div>
      
      {/* 提示信息：未配置 */}
      {!isConfigured && (
         <motion.div variants={item} className="px-4 py-2 mx-4 rounded-lg bg-primary/10 border border-primary/20 text-muted-foreground text-sm text-center">
            {t('sync.stats.notConfigured')}
         </motion.div>
      )}

      {/* Main Action - One Click Sync */}
      <motion.div variants={item} className="flex-1 flex flex-col justify-center items-center space-y-4 px-4">
         {!isConfigured ? (
             <div className="text-center text-muted-foreground py-8">{t('sync.needConfigFirst')}</div>
         ) : (
             <>
                <div className="relative">
                  <button
                      onClick={handleSmartSync}
                      disabled={!isOnline || (syncStatus !== 'idle' && syncStatus !== 'success' && syncStatus !== 'error')}
                      className={cn(
                          "group relative w-40 h-40 rounded-full glass-panel flex flex-col items-center justify-center transition-all shadow-xl",
                          isOnline 
                              ? "hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100" 
                              : "opacity-50 grayscale cursor-not-allowed"
                      )}
                  >
                      {isOnline && <div className="absolute inset-0 rounded-full bg-indigo-600/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />}
                      
                      {!isOnline ? (
                          <WifiOff className="w-12 h-12 text-muted-foreground" />
                      ) : (syncStatus === 'syncing' || syncStatus === 'checking') ? (
                          <RefreshCw className="w-12 h-12 text-primary animate-spin" />
                      ) : (
                          <Cloud className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                      
                      <span className="mt-3 text-sm font-medium text-secondary-foreground">
                          {!isOnline ? t('sync.syncButton.offline') :
                           syncStatus === 'checking' ? t('sync.syncButton.analyzing') : 
                           syncStatus === 'syncing' ? t('sync.syncButton.syncing') : 
                           syncStatus === 'success' ? t('sync.syncButton.done') : t('sync.syncButton.syncNow')}
                      </span>
                  </button>

                  {/* 小的圆形更多操作按钮 */}
                  <button
                      onClick={openMoreActions}
                      disabled={!isOnline || isSyncBusy}
                      className={cn(
                          "absolute bottom-0 right-0 w-12 h-12 rounded-full glass-panel flex items-center justify-center transition-all shadow-lg",
                          isOnline && !isSyncBusy
                              ? "hover:scale-110 active:scale-95" 
                              : "opacity-50 cursor-not-allowed"
                      )}
                      title={t('sync.syncButton.moreOptions')}
                  >
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  </button>
                </div>

                <div className="h-6 text-center">
                    {msg && (
                        <motion.span 
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            className={cn("text-xs font-medium", syncStatus === 'error' ? "text-destructive" : "text-muted-foreground")}
                        >
                            {msg}
                        </motion.span>
                    )}
                    {cloudMeta && !msg && (
                        <span className="text-[10px] text-muted-foreground">
                             {t('sync.cloudUpdatedAt', { time: new Date(cloudMeta.time).toLocaleString() })}
                             {cloudMeta.device ? ` (${cloudMeta.device})` : ''}
                             {lastRemoteDevice?.deviceName ? ` · ${lastRemoteDevice.deviceName}` : ''}
                        </span>
                    )}
                </div>
             </>
         )}
      </motion.div>

      {/* Footer History Trigger */}
      <motion.div variants={item} className="mt-auto glass-panel border-x-0 border-b-0 rounded-b-none -mx-4 px-6 py-3 flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setDrawerMode('history'); setDrawerOpen(true); }}>
        <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t('sync.viewSnapshots')}</span>
        </div>
        <div className="flex -space-x-2">
            {/* Avatars or logic dots */}
             <div className="w-2 h-2 rounded-full bg-indigo-500" />
             <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
      </motion.div>
    </motion.div>

    {/* Drawer for Conflict / History / Cloud Backups */}
    <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerMode === 'history' ? t('sync.drawer.title.history') : drawerMode === 'cloudBackups' ? t('sync.drawer.title.cloudBackups') : drawerMode === 'actions' ? t('sync.drawer.title.actions') : t('sync.drawer.title.conflict')}
    >
        {drawerMode === 'actions' ? (
            <ActionsPanel
                t={t}
                cn={cn}
                isOnline={isOnline}
                isSyncBusy={isSyncBusy}
                localCount={localCount}
                openCloudBackups={openCloudBackups}
                requestForcePush={requestForcePush}
            />
        ) : drawerMode === 'cloudBackups' ? (
            <CloudBackupsPanel
                t={t}
                cloudBackups={cloudBackups}
                loadingCloudBackups={loadingCloudBackups}
                requestRestoreCloudBackup={requestRestoreCloudBackup}
            />
        ) : drawerMode === 'history' ? (
            <SnapshotHistoryPanel
                t={t}
                snapshots={snapshots}
                loadSnapshots={loadSnapshots}
                requestRestoreSnapshot={requestRestoreSnapshot}
                snapshotManager={snapshotManager}
            />
        ) : drawerMode === 'conflict' ? (
            <ConflictPanel
                t={t}
                cn={cn}
                isOnline={isOnline}
                isSyncBusy={isSyncBusy}
                localCount={localCount}
                cloudCount={cloudCount}
                cloudMeta={cloudMeta}
                executePull={executePull}
                forceNewBackup={forceNewBackup}
                requestForcePush={requestForcePush}
            />
        ) : null}
    </Drawer>

    <OverwriteConfirmDrawer
      isOpen={confirmPushOpen}
      onClose={() => setConfirmPushOpen(false)}
      onConfirm={confirmForcePush}
      busy={isSyncBusy}
      online={isOnline}
      localCount={localCount}
      t={t}
    />

    <RestoreConfirmDrawer
      isOpen={confirmDrawerOpen}
      onClose={cancelRestore}
      snapshot={pendingRestoreSnapshot}
      cloudBackup={pendingRestoreCloudBackup}
      onConfirmSnapshot={confirmRestoreSnapshot}
      onConfirmCloudBackup={confirmRestoreCloudBackup}
      t={t}
    />
    </>
  )
}
