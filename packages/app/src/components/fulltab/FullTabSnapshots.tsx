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
import { holdRestoringUntil, setIsRestoring } from '../../core/sync/sync-settings'
import { parseSnapshotReason } from '../../infrastructure/utils/snapshot-parser'
import { cn } from '../../infrastructure/utils/format'
import { Button } from '../Button'
import { Input } from '../Input'

export function FullTabSnapshots() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null)

  const loadSnapshots = async () => {
    try {
      const list = await snapshotManager.getAllSnapshots()
      setSnapshots(list.sort((a: Snapshot, b: Snapshot) => b.timestamp - a.timestamp))
    } catch (e) {
      console.error('[FullTabSnapshots] Failed to load snapshots:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSnapshots()
  }, [])

  // 手动创建新快照
  const handleCreate = async () => {
    try {
      const tree = await bookmarkRepository.getTree()
      const count = countBookmarks(tree)
      await snapshotManager.createSnapshot(tree, count, '手动创建 (手动 备份)')
      await loadSnapshots()
      toast.success('本地快照创建成功')
    } catch (e) {
      toast.error('创建快照失败', { description: (e as Error).message })
    }
  }

  // 删除单份快照
  const handleDelete = async (id: number) => {
    try {
      await snapshotManager.deleteSnapshot(id)
      setConfirmDeleteId(null)
      await loadSnapshots()
      toast.success('快照已删除')
    } catch (e) {
      toast.error('删除快照失败', { description: (e as Error).message })
    }
  }

  // 一键回滚到指定快照
  const handleRestore = async (snapshot: Snapshot) => {
    try {
      await setIsRestoring(true)

      // 恢复前自动对当前书签建立安全防灾快照
      const currentTree = await bookmarkRepository.getTree()
      const currentCount = countBookmarks(currentTree)
      await snapshotManager.createSnapshot(currentTree, currentCount, '快照恢复前自动备份 (自动 恢复)')

      await bookmarkRepository.restoreFromBackup(snapshot.tree)
      setConfirmRestoreId(null)
      await loadSnapshots()
      toast.success(`已恢复到 ${new Date(snapshot.timestamp).toLocaleString()} 的版本`)
    } catch (e) {
      toast.error('快照恢复失败', { description: (e as Error).message })
    } finally {
      await holdRestoringUntil()
    }
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
      {/* 顶部工具栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索快照标签、时机或日期..."
            className="pl-9 h-10 bg-background/80"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            共 <strong className="text-foreground">{snapshots.length}</strong> 份历史快照
          </span>
          <Button onClick={handleCreate} size="sm" className="gap-1.5 h-10">
            <Plus className="w-4 h-4" />
            <span>新建快照</span>
          </Button>
        </div>
      </div>

      {/* 快照卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSnapshots.map((s) => {
          const parsed = parseSnapshotReason(s.reason, '自动备份')
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
                    {s.count} 书签
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
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs flex-1"
                      onClick={() => handleRestore(s)}
                    >
                      确认覆盖恢复
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setConfirmRestoreId(null)}
                    >
                      取消
                    </Button>
                  </div>
                ) : isDeleting ? (
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs flex-1"
                      onClick={() => handleDelete(s.id)}
                    >
                      确认删除
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 hover:border-primary/50"
                      onClick={() => setConfirmRestoreId(s.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-primary" />
                      <span>恢复此版本</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(s.id)}
                      title="删除快照"
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

      {!loading && filteredSnapshots.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm">未找到符合条件的本地快照</p>
        </div>
      )}
    </div>
  )
}
