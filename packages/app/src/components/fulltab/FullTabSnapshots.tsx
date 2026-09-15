import { useI18n } from '../../i18n';
import { RecoveryNotice } from '../sync/RecoveryNotice';
/**
 * 大屏控制台：快照时光机全景视图
 * 支持多网格卡片式呈现、差分变动微标、全文搜索过滤、手动创建与一键回滚
 */
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Bookmark,
  Clock,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { snapshotManager, type Snapshot } from '../../core/backup'
import { bookmarkRepository, countBookmarks } from '../../core/bookmark'
import { restoreLocalSnapshotInBackground } from '../../application/background-ops'
import { parseSnapshotReason } from '../../infrastructure/utils/snapshot-parser'
import { cn } from '../../infrastructure/utils/format'
import { Button } from '../Button'
import { Input } from '../Input'

export function FullTabSnapshots() {
  const { t, locale } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null)

  const loadSnapshots = async () => {
    setLoading(true); setError('')
    try {
      const list = await snapshotManager.getAllSnapshots()
      setSnapshots(list.sort((a: Snapshot, b: Snapshot) => b.timestamp - a.timestamp))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSnapshots()
  }, [])

  // 手动创建新快照
  const handleCreate = async () => {
    if (busy) return
    setBusy(true)
    try {
      const tree = await bookmarkRepository.getTree()
      const count = countBookmarks(tree)
      await snapshotManager.createSnapshot(tree, count, 'manual')
      await loadSnapshots()
      toast.success(t('repair.snapCreated'))
    } catch (e) {
      toast.error(t('repair.snapFailed'), { description: (e as Error).message })
    } finally { setBusy(false) }
  }

  // 删除单份快照
  const handleDelete = async (id: number) => {
    if (busy) return
    setBusy(true)
    try {
      await snapshotManager.deleteSnapshot(id)
      setConfirmDeleteId(null)
      await loadSnapshots()
      toast.success(t('repair.snapDeleted'))
    } catch (e) {
      toast.error(t('repair.snapFailed'), { description: (e as Error).message })
    } finally { setBusy(false) }
  }

  // 一键回滚到指定快照
  const handleRestore = async (snapshot: Snapshot) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await restoreLocalSnapshotInBackground(snapshot.id!)
      if (!result.success) throw new Error(result.message)
      setConfirmRestoreId(null)
      await loadSnapshots()
      toast.success(t('repair.snapRestored'))
    } catch (e) {
      toast.error(t('repair.snapFailed'), { description: (e as Error).message })
    } finally { setBusy(false) }
  }

  // 根据搜索关键字过滤
  const filteredSnapshots = snapshots.filter((s) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const reasonMatch = s.reason?.toLowerCase().includes(query)
    const dateMatch = new Date(s.timestamp).toLocaleString().toLowerCase().includes(query)
    return reasonMatch || dateMatch
  })

  return (
    <div className="w-full space-y-6">
      <RecoveryNotice />
      {loading && <p role="status">{t('common.loading')}</p>}
      {error && <p role="alert" className="text-destructive">{error} <Button disabled={busy} onClick={() => void loadSnapshots()}>{t('repair.retry')}</Button></p>}
      {/* 顶部工具栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('repair.snapSearch')} placeholder={t('repair.snapSearch')}
            className="pl-9 h-10 bg-background/80"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t('repair.snapTotal', { count: snapshots.length })}
          </span>
          <Button disabled={busy} onClick={handleCreate} size="sm" className="gap-1.5 h-10">
            <Plus className="w-4 h-4" />
            <span>{t('repair.snapCreate')}</span>
          </Button>
        </div>
      </div>

      {/* 快照卡片网格：电脑宽屏 3~4 列饱满呈现，移动端单列整齐排列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
        {filteredSnapshots.map((s) => {
          const parsed = parseSnapshotReason(s.reason)
          if (locale === 'en') {
            const labels: Record<string, string> = { '自动备份': 'Automatic backup', '手动备份': 'Manual backup', '手动创建': 'Manual snapshot', '上传前': 'Before upload', '上传前备份': 'Before upload', '下载前': 'Before download', '恢复前': 'Before restore', '云端恢复前': 'Before cloud restore', '自动': 'Automatic', '手动': 'Manual', '备份': 'Backup', '合并': 'Merge', '覆盖': 'Replace', '恢复': 'Restore' }
            parsed.title = labels[parsed.title] || parsed.title
            if (parsed.triggerLabel) parsed.triggerLabel = labels[parsed.triggerLabel] || parsed.triggerLabel
            if (parsed.actionLabel) parsed.actionLabel = labels[parsed.actionLabel] || parsed.actionLabel
          }
          const isDeleting = confirmDeleteId === s.id
          const isRestoring = confirmRestoreId === s.id

          return (
            <div
              key={s.id}
              className="rounded-2xl border border-border/80 bg-card/70 hover:bg-card/90 transition-all p-4 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                {/* 标题行与时机徽章 */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground truncate" title={parsed.title}>
                    {parsed.title}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {parsed.triggerLabel && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium border',
                          parsed.triggerLabel === '手动'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        )}
                      >
                        {parsed.triggerLabel}
                      </span>
                    )}
                    {parsed.actionLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border bg-muted/80 text-muted-foreground border-border/60">
                        {parsed.actionLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* 时间与统计 */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(s.timestamp).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Bookmark className="w-3 h-3 text-primary" />
                    {t('repair.snapBookmarks', { count: s.count })}
                  </span>
                </div>

                {/* 变动差分统计徽章 */}
                {s.diff && (s.diff.added > 0 || s.diff.updated > 0 || s.diff.deleted > 0) && (
                  <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-mono font-medium">
                    {s.diff.added > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        +{s.diff.added}
                      </span>
                    )}
                    {s.diff.updated > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        ~{s.diff.updated}
                      </span>
                    )}
                    {s.diff.deleted > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        -{s.diff.deleted}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 底部操作行 */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                {isRestoring ? (
                  <div className="flex items-center gap-2 w-full">
                    <Button disabled={busy}
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs flex-1"
                      onClick={() => handleRestore(s)}
                    >
                      {t('repair.snapConfirm')}
                    </Button>
                    <Button disabled={busy}
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setConfirmRestoreId(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : isDeleting ? (
                  <div className="flex items-center gap-2 w-full">
                    <Button disabled={busy}
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs flex-1"
                      onClick={() => handleDelete(s.id)}
                    >
                      {t('common.delete')}
                    </Button>
                    <Button disabled={busy}
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button disabled={busy}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 hover:border-primary/50"
                      onClick={() => setConfirmRestoreId(s.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-primary" />
                      <span>{t('common.restore')}</span>
                    </Button>

                    <Button disabled={busy}
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(s.id)}
                      aria-label={t('common.delete')} title={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!loading && !error && filteredSnapshots.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm">{t('repair.snapEmpty')}</p>
        </div>
      )}
    </div>
  )
}
