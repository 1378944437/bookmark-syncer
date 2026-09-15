import { useEffect, useState } from 'react';
import { useStorage } from './useStorage';
import { LOCK_TIMEOUT_MS, type SyncResult } from '../core/sync/types';
import { getStorageIdentifier, type StorageConfig } from '../core/storage/types';

/** 页面重新打开后仍可看到后台锁及最近一次失败；失效锁不永久禁用操作。 */
export function useBackgroundSyncStatus(config: StorageConfig, configured: boolean) {
  const [lock] = useStorage<{ timestamp: number } | null>('sync_lock', null);
  const [result] = useStorage<{ target: string; result: SyncResult; time: number } | null>('last_background_result', null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!lock) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, lock.timestamp + LOCK_TIMEOUT_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [lock]);
  return { busy: !!lock && now < lock.timestamp + LOCK_TIMEOUT_MS,
    result: configured && result?.target === getStorageIdentifier(config) ? result : null };
}
