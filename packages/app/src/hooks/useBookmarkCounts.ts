/**
 * 本地/云端计数与云端信息刷新（自 SyncView 抽出的状态与加载逻辑）
 * 加载逻辑与原实现逐字一致；isConfigured 与配置构造由视图注入
 */
import { useState, useEffect, useRef } from 'react'
import browser from 'webextension-polyfill'
import { toast } from 'sonner'
import type { StorageConfig } from '../core/storage/types'
import { bookmarkRepository, countBookmarks, computeTreeHash, filterTreeByScope } from '../core/bookmark'
import { getSyncScope } from '../core/sync/sync-settings'
import { getSyncState } from '../core/sync/state-manager'
import { getStorageIdentifier } from '../core/storage/types'
import { getCloudInfo } from '../core/sync'

export interface BookmarkCountsContext {
  t: (key: string, vars?: Record<string, string | number>) => string
  isConfigured: boolean
  getConfig: () => StorageConfig
}

export function useBookmarkCounts(ctx: BookmarkCountsContext) {
  const { t, isConfigured, getConfig } = ctx
  const [localCount, setLocalCount] = useState(0)
  const [cloudCount, setCloudCount] = useState(0)
  const [cloudMeta, setCloudMeta] = useState<{
    time: number
    device: string
    count: number
    browser?: string
  } | null>(null)
  const generation = useRef(0)
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const invalidate = () => setVerified(false)
    const events = [browser.bookmarks.onCreated, browser.bookmarks.onRemoved, browser.bookmarks.onChanged, browser.bookmarks.onMoved]
    events.forEach(event => event.addListener(invalidate))
    return () => events.forEach(event => event.removeListener(invalidate))
  }, [])

  const loadCounts = async (signal?: { aborted: boolean }) => {
    const request = ++generation.current
    const config = getConfig()
    const stale = () => signal?.aborted || request !== generation.current
    try {
      setVerified(false); setError('')
      const tree = filterTreeByScope(await bookmarkRepository.getTree(), await getSyncScope())
      const count = countBookmarks(tree)
      if (stale()) return
      setLocalCount(count)

      if (isConfigured) {
        setLoading(true)
        try {
          // 使用 getCloudInfo 获取最新备份信息
          // 注意：由于可能有多设备同步，这里需要实时获取最新数据
          const cloudInfo = await getCloudInfo(config, true)
          if (stale()) return

          if (cloudInfo.exists && cloudInfo.totalCount !== undefined) {
            const state = await getSyncState(getStorageIdentifier(config))
            const localHash = await computeTreeHash(tree)
            if (stale()) return
            setVerified(!!state?.localHash && state.localHash === localHash && state.basis?.filePath === cloudInfo.filePath)
            setCloudCount(cloudInfo.totalCount)
            setCloudMeta({
              time: cloudInfo.timestamp || 0,
              device: cloudInfo.browser || '',
              count: cloudInfo.totalCount,
              browser: cloudInfo.browser,
            })
          } else {
            setCloudCount(0)
            setCloudMeta(null)
          }
        } catch (e) {
          if (stale()) return
          console.error('[SyncView] Failed to load cloud info:', e)
          setError((e as Error).message)
          toast.error(t('sync.toast.loadCloudInfoFailed'), {
            description: (e as Error).message || t('sync.toast.checkNetworkAndConfig'),
          })
          setCloudCount(0)
          setCloudMeta(null)
        } finally {
          if (!stale()) setLoading(false)
        }
      } else {
        setLoading(false)
      }
    } catch (e) {
      if (stale()) return
      console.error('Failed to load counts:', e)
      setLoading(false)
    }
  }

  return { localCount, cloudCount, cloudMeta, loading, loadCounts, setCloudMeta, verified, error }
}
