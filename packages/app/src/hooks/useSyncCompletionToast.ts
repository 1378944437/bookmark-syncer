import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

/**
 * 面板打开期间检测到「新的同步完成」时弹出轻提示。
 * 首次加载已有状态不提示；跳过型同步（内容一致）不提示。
 */
export function useSyncCompletionToast(
  syncState: { time: number; type: string } | null | undefined,
  message: string,
) {
  const lastSeenSyncTimeRef = useRef<number | null>(null)
  useEffect(() => {
    const time = syncState?.time
    if (!time) return
    const previous = lastSeenSyncTimeRef.current
    lastSeenSyncTimeRef.current = time
    if (previous !== null && time !== previous && syncState?.type !== 'skip_identical') {
      toast.success(message, { duration: 2000 })
    }
  }, [syncState?.time, syncState?.type, message])
}
