import { useEffect, useRef } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

import { motion } from 'framer-motion'
import { Cloud, History, MoreHorizontal, RefreshCw, WifiOff } from 'lucide-react'
import { snapshotManager } from '../core/backup'
import { useI18n } from '../i18n'
import { useStorage } from '../hooks/useStorage'
import { useSnapshots } from '../hooks/useSnapshots'
import { useCloudBackups } from '../hooks/useCloudBackups'
import { useBookmarkCounts } from '../hooks/useBookmarkCounts'
import { useSyncActions } from '../hooks/useSyncActions'
import { useSyncCompletionToast } from '../hooks/useSyncCompletionToast'
import { cn } from '../infrastructure/utils/format'
import { Drawer } from './Drawer'
import { OverwriteConfirmDrawer, RestoreConfirmDrawer } from './sync/ConfirmDrawers'
import { ActionsPanel, CloudBackupsPanel, ConflictPanel, SnapshotHistoryPanel } from './sync/SyncDrawerPanels'
import { StatsCard } from './StatsCard'

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
  const [syncState] = useStorage<{ time: number; url: string; type: string } | null>('syncState', null)
  const [lastRemoteDevice] = useStorage<{ deviceId?: string; deviceName?: string; time: number } | null>('last_remote_device', null)
  const isOnline = useOnlineStatus()
  


  useSyncCompletionToast(syncState, t('sync.toast.completed'))

  const isConfigured = !!webdavUrl

  // 注意：WebDAV 用户名/密码是异步从 storage 读取的。
  // 如果这里只依赖 webdavUrl，会出现「URL 先加载 → 立刻发请求但账号/密码还是空」的情况，导致首次 401。
  useEffect(() => {
    const signal = { aborted: false }
    countsApi.loadCounts(signal); snapshotsApi.loadSnapshots()
    return () => { signal.aborted = true }
  }, [webdavUrl, username, password, syncState?.time])

  // 取消恢复
  const cancelRestore = () => {
    snapshotsApi.clearPendingRestoreSnapshot()
    cloudBackupsApi.clearPendingRestoreCloudBackup()
    actionsApi.closeConfirm()
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
  

  // 计数加载 hook（本地书签数 / 云端备份信息）
  const countsApi = useBookmarkCounts({ t, isConfigured, getConfig: getSyncConfig })

  // 跨 hook 刷新回调（ref 延迟取用，避免初始化顺序造成的循环依赖）
  const refreshersRef = useRef({ loadSnapshots: () => {}, loadCloudBackups: () => {} })

  // 同步动作与视图状态 hook
  const actionsApi = useSyncActions({
    t,
    locale,
    isConfigured,
    isOnline,
    localCount: countsApi.localCount,
    getConfig: getSyncConfig,
    loadCounts: countsApi.loadCounts,
    setCloudMeta: countsApi.setCloudMeta,
    refreshers: refreshersRef,
  })

  // 视图上下文：向其余 hooks 提供状态提示与确认抽屉回调
  const viewCtx = {
    t,
    setSyncStatus: actionsApi.setSyncStatus,
    setMsg: actionsApi.setMsg,
    setDrawerOpen: actionsApi.setDrawerOpen,
    openConfirm: actionsApi.openConfirm,
    closeConfirm: actionsApi.closeConfirm,
    loadCounts: countsApi.loadCounts,
  }
  const snapshotsApi = useSnapshots(viewCtx)
  const cloudBackupsApi = useCloudBackups({
    ...viewCtx,
    isConfigured,
    getConfig: getSyncConfig,
    locale,
    loadSnapshots: snapshotsApi.loadSnapshots,
  })

  refreshersRef.current = {
    loadSnapshots: snapshotsApi.loadSnapshots,
    loadCloudBackups: cloudBackupsApi.loadCloudBackups,
  }

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
        <StatsCard label={t('sync.stats.local')} count={countsApi.localCount} loading={false} color="zinc" />
        <StatsCard label={t('sync.stats.cloud')} count={countsApi.cloudCount} loading={countsApi.loading} color="indigo" />
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
                      onClick={actionsApi.handleSmartSync}
                      disabled={!isOnline || (actionsApi.syncStatus !== 'idle' && actionsApi.syncStatus !== 'success' && actionsApi.syncStatus !== 'error')}
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
                      ) : (actionsApi.syncStatus === 'syncing' || actionsApi.syncStatus === 'checking') ? (
                          <RefreshCw className="w-12 h-12 text-primary animate-spin" />
                      ) : (
                          <Cloud className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                      
                      <span className="mt-3 text-sm font-medium text-secondary-foreground">
                          {!isOnline ? t('sync.syncButton.offline') :
                           actionsApi.syncStatus === 'checking' ? t('sync.syncButton.analyzing') : 
                           actionsApi.syncStatus === 'syncing' ? t('sync.syncButton.syncing') : 
                           actionsApi.syncStatus === 'success' ? t('sync.syncButton.done') : t('sync.syncButton.syncNow')}
                      </span>
                  </button>

                  {/* 小的圆形更多操作按钮 */}
                  <button
                      onClick={actionsApi.openMoreActions}
                      disabled={!isOnline || actionsApi.isSyncBusy}
                      className={cn(
                          "absolute bottom-0 right-0 w-12 h-12 rounded-full glass-panel flex items-center justify-center transition-all shadow-lg",
                          isOnline && !actionsApi.isSyncBusy
                              ? "hover:scale-110 active:scale-95" 
                              : "opacity-50 cursor-not-allowed"
                      )}
                      title={t('sync.syncButton.moreOptions')}
                  >
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  </button>
                </div>

                <div className="h-6 text-center">
                    {actionsApi.msg && (
                        <motion.span 
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            className={cn("text-xs font-medium", actionsApi.syncStatus === 'error' ? "text-destructive" : "text-muted-foreground")}
                        >
                            {actionsApi.msg}
                        </motion.span>
                    )}
                    {countsApi.cloudMeta && !actionsApi.msg && (
                        <span className="text-[10px] text-muted-foreground">
                             {t('sync.cloudUpdatedAt', { time: new Date(countsApi.cloudMeta.time).toLocaleString() })}
                             {countsApi.cloudMeta.device ? ` (${countsApi.cloudMeta.device})` : ''}
                             {lastRemoteDevice?.deviceName ? ` · ${lastRemoteDevice.deviceName}` : ''}
                        </span>
                    )}
                </div>
             </>
         )}
      </motion.div>

      {/* Footer History Trigger */}
      <motion.div variants={item} className="mt-auto glass-panel border-x-0 border-b-0 rounded-b-none -mx-4 px-6 py-3 flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors" onClick={actionsApi.openHistory}>
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
        isOpen={actionsApi.drawerOpen}
        onClose={actionsApi.closeDrawer}
        title={actionsApi.drawerMode === 'history' ? t('sync.drawer.title.history') : actionsApi.drawerMode === 'cloudBackups' ? t('sync.drawer.title.cloudBackups') : actionsApi.drawerMode === 'actions' ? t('sync.drawer.title.actions') : t('sync.drawer.title.conflict')}
    >
        {actionsApi.drawerMode === 'actions' ? (
            <ActionsPanel
                t={t}
                cn={cn}
                isOnline={isOnline}
                isSyncBusy={actionsApi.isSyncBusy}
                localCount={countsApi.localCount}
                openCloudBackups={actionsApi.openCloudBackups}
                requestForcePush={actionsApi.requestForcePush}
            />
        ) : actionsApi.drawerMode === 'cloudBackups' ? (
            <CloudBackupsPanel
                t={t}
                cloudBackups={cloudBackupsApi.cloudBackups}
                loadingCloudBackups={cloudBackupsApi.loadingCloudBackups}
                requestRestoreCloudBackup={cloudBackupsApi.requestRestoreCloudBackup}
            />
        ) : actionsApi.drawerMode === 'history' ? (
            <SnapshotHistoryPanel
                t={t}
                snapshots={snapshotsApi.snapshots}
                loadSnapshots={snapshotsApi.loadSnapshots}
                requestRestoreSnapshot={snapshotsApi.requestRestoreSnapshot}
                snapshotManager={snapshotManager}
            />
        ) : actionsApi.drawerMode === 'conflict' ? (
            <ConflictPanel
                t={t}
                cn={cn}
                isOnline={isOnline}
                isSyncBusy={actionsApi.isSyncBusy}
                localCount={countsApi.localCount}
                cloudCount={countsApi.cloudCount}
                cloudMeta={countsApi.cloudMeta}
                executePull={actionsApi.executePull}
                forceNewBackup={actionsApi.forceNewBackup}
                requestForcePush={actionsApi.requestForcePush}
            />
        ) : null}
    </Drawer>

    <OverwriteConfirmDrawer
      isOpen={actionsApi.confirmPushOpen}
      onClose={actionsApi.closeConfirmPush}
      onConfirm={actionsApi.confirmForcePush}
      busy={actionsApi.isSyncBusy}
      online={isOnline}
      localCount={countsApi.localCount}
      t={t}
    />

    <RestoreConfirmDrawer
      isOpen={actionsApi.confirmDrawerOpen}
      onClose={cancelRestore}
      snapshot={snapshotsApi.pendingRestoreSnapshot}
      cloudBackup={cloudBackupsApi.pendingRestoreCloudBackup}
      onConfirmSnapshot={snapshotsApi.confirmRestoreSnapshot}
      onConfirmCloudBackup={cloudBackupsApi.confirmRestoreCloudBackup}
      t={t}
    />
    </>
  )
}
