/**
 * 本地/云端计数与云端信息刷新（自 SyncView 抽出的状态与加载逻辑）
 * 加载逻辑与原实现逐字一致；isConfigured 与配置构造由视图注入
 */
import { useState } from 'react'
import { toast } from 'sonner'
import type { WebDAVConfig } from '../core/storage/types'
import { bookmarkRepository } from '../core/bookmark'
import { getCloudInfo } from '../core/sync'

export interface BookmarkCountsContext {
  t: (key: string, vars?: Record<string, string | number>) => string
  isConfigured: boolean
  getConfig: () => WebDAVConfig
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
  const [loading, setLoading] = useState(true)

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
          const cloudInfo = await getCloudInfo(getConfig(), true)
          if (signal?.aborted) return

          if (cloudInfo.exists && cloudInfo.totalCount !== undefined) {
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
          if (signal?.aborted) return
          console.error('[SyncView] Failed to load cloud info:', e)
          toast.error(t('sync.toast.loadCloudInfoFailed'), {
            description: (e as Error).message || t('sync.toast.checkNetworkAndConfig'),
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

  return { localCount, cloudCount, cloudMeta, loading, loadCounts, setCloudMeta }
}
