/**
 * SyncView 抽屉面板（操作 / 云端备份 / 快照历史 / 冲突）
 * 自 SyncView 拆出的展示型组件：状态与业务逻辑仍由 SyncView 持有，通过 props 传入
 */
import { AlertTriangle, Cloud, Download, FilePlus, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import type { ClassValue } from 'clsx'
import { toast } from 'sonner'
import type { Snapshot } from '../../core/backup'
import type { CloudBackupFile } from '../../core/sync'
import { Button } from '../Button'

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

export function ActionsPanel({ t, cn, isOnline, isSyncBusy, localCount, openCloudBackups, requestForcePush }: ActionsPanelProps) {
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
                             <div className="text-sm font-medium text-foreground">{t('sync.actions.viewCloudBackups')}</div>
                             <div className="text-xs text-muted-foreground mt-0.5">{t('sync.actions.viewCloudBackupsDesc')}</div>
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
                             <div className="text-sm font-medium text-destructive">{t('sync.actions.overwriteCloud')}</div>
                             <div className="text-xs text-muted-foreground mt-0.5">
                                 {localCount === 0 ? t('sync.actions.overwriteCloudEmpty') : t('sync.actions.overwriteCloudDesc')}
                             </div>
                         </div>
                     </div>
                 </button>
             </div>
  )
}

export interface CloudBackupsPanelProps {
  t: Translate
  cloudBackups: CloudBackupFile[]
  loadingCloudBackups: boolean
  requestRestoreCloudBackup: (backup: CloudBackupFile) => void
}

export function CloudBackupsPanel({ t, cloudBackups, loadingCloudBackups, requestRestoreCloudBackup }: CloudBackupsPanelProps) {
  return (
             <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground mb-2">{t('sync.cloudBackups.pick')}</p>
                {loadingCloudBackups ? (
                    <div className="text-center py-8">
                        <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
                        <span className="text-xs text-muted-foreground">{t('common.loading')}</span>
                    </div>
                ) : cloudBackups.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">{t('sync.cloudBackups.empty')}</p>
                ) : (
                    cloudBackups.map((backup) => (
                        <div key={backup.path} className="bg-muted border border-border rounded-lg p-3 flex items-center justify-between group transition-colors hover:border-primary/50">
                             <div className="flex flex-col min-w-0">
                                <span className="text-xs font-medium text-foreground">
                                    {new Date(backup.timestamp).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {backup.browser ? (
                                        backup.totalCount
                                            ? t('sync.cloudBackups.browserWithCount', { browser: backup.browser, count: backup.totalCount })
                                            : backup.browser
                                    ) : (
                                        backup.name
                                    )}
                                </span>
                             </div>
                             <div className="flex items-center gap-3">
                                 <span className="text-xs text-muted-foreground font-mono">
                                     {backup.totalCount !== undefined ? t('sync.cloudBackups.bookmarks', { count: backup.totalCount }) : ''}
                                 </span>
                                 <Button 
                                     size="sm" 
                                     variant="ghost"
                                     className="opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7 px-2"
                                     onClick={() => requestRestoreCloudBackup(backup)}
                                 >
                                     <Download className="w-3 h-3 mr-1" />
                                     恢复
                                 </Button>
                             </div>
                        </div>
                    ))
                )}
             </div>
  )
}

export interface SnapshotHistoryPanelProps {
  t: Translate
  snapshots: Snapshot[]
  loadSnapshots: () => void
  requestRestoreSnapshot: (snapshot: Snapshot) => void
  snapshotManager: { deleteSnapshot: (id: number) => Promise<void> }
}

export function SnapshotHistoryPanel({ t, snapshots, loadSnapshots, requestRestoreSnapshot, snapshotManager }: SnapshotHistoryPanelProps) {
  return (
             <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground mb-2">{t('sync.history.pick')}</p>
                {snapshots.map((s) => (
                    <div key={s.id} className="bg-muted border border-border rounded-lg p-3 flex items-center justify-between group transition-colors hover:border-primary/50">
                         <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-foreground">
                                {s.reason || t('sync.history.autoBackup')}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{new Date(s.timestamp).toLocaleString()}</span>
                         </div>
                         <div className="flex items-center gap-3">
                             <span className="text-xs text-muted-foreground font-mono">
                                 {t('sync.history.bookmarks', { count: s.count })}
                             </span>
                             <Button 
                                 size="sm" 
                                 variant="ghost"
                                 className="opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7 px-2"
                                 onClick={() => requestRestoreSnapshot(s)}
                             >
                                 <RotateCcw className="w-3 h-3 mr-1" />
                                 {t('common.restore')}
                             </Button>
                             <Button 
                                 size="sm" 
                                 variant="ghost"
                                 className="opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                 onClick={async (e) => {
                                     e.stopPropagation()
                                    await snapshotManager.deleteSnapshot(s.id)
                                    loadSnapshots()
                                    toast.success(t('sync.toast.snapshotDeleted'))
                                 }}
                             >
                                 <Trash2 className="w-3 h-3" />
                             </Button>
                         </div>
                    </div>
                ))}
                {snapshots.length === 0 && <p className="text-center text-muted-foreground py-4">{t('sync.history.empty')}</p>}
             </div>
  )
}

export interface ConflictPanelProps {
  t: Translate
  cn: (...inputs: ClassValue[]) => string
  isOnline: boolean
  isSyncBusy: boolean
  localCount: number
  cloudCount: number
  cloudMeta: { time: number; device: string; count: number; browser?: string } | null
  executePull: (mode: 'overwrite' | 'merge') => void
  forceNewBackup: () => void
  requestForcePush: () => void
}

export function ConflictPanel({ t, cn, isOnline, isSyncBusy, localCount, cloudCount, cloudMeta, executePull, forceNewBackup, requestForcePush }: ConflictPanelProps) {
  return (
            <div className="space-y-4 pt-2">
                {/* 跨浏览器警告 */}

                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-400 dark:border-amber-500/20 p-4 rounded-xl flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-foreground mb-1">{t('sync.conflict.title')}</h4>
                        <p className="text-xs text-foreground/70 leading-relaxed">
                            {t('sync.conflict.cloudHas', { count: cloudCount })}
                            {cloudMeta?.browser && <span className="text-muted-foreground"> ({cloudMeta.browser})</span>}
                            {t('sync.conflict.updatedAt', { time: cloudMeta ? new Date(cloudMeta.time).toLocaleTimeString() : t('sync.conflict.unknownTime') })}
                            <br/>{t('sync.conflict.localHas', { count: localCount })}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button 
                        variant="outline" 
                        className={cn("h-20 flex flex-col gap-1 hover:bg-accent hover:text-accent-foreground", (!isOnline || isSyncBusy) && "opacity-50")}
                        onClick={() => executePull('overwrite')}
                        disabled={!isOnline || isSyncBusy}
                    >
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-foreground text-sm">{t('sync.conflict.restoreLocal')}</span>
                        <span className="text-[10px] text-muted-foreground">{t('sync.conflict.restoreLocalDesc')}</span>
                    </Button>
                    <Button 
                        className={cn("h-20 flex flex-col gap-1", (localCount === 0 || !isOnline || isSyncBusy) && "opacity-50")}
                        onClick={requestForcePush}
                        disabled={localCount === 0 || !isOnline || isSyncBusy}
                    >
                        {localCount === 0 ? (
                            <>
                                <Cloud className="w-5 h-5 text-muted-foreground" />
                                <span className="text-sm text-foreground/50">{t('sync.conflict.uploadForbidden')}</span>
                                <span className="text-[10px] text-foreground/30">{t('sync.conflict.uploadForbiddenDesc')}</span>
                            </>
                        ) : (
                            <>
                                <Cloud className="w-5 h-5" />
                                <span className="text-sm">{t('sync.conflict.uploadCloud')}</span>
                                <span className="text-[10px] text-primary-foreground/70">{t('sync.conflict.uploadCloudDesc')}</span>
                            </>
                        )}
                    </Button>
                </div>
                
                {/* 强制新备份按钮 */}
                <div className="flex justify-end mt-2">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={forceNewBackup}
                    >
                        <FilePlus className="w-3 h-3" />
                        {t('sync.conflict.forceNewBackup')}
                    </Button>
                </div>
            </div>
  )
}

