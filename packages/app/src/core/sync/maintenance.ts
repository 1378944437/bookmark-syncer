import { clearCloudBackups, clearLocalBookmarks, resetFactorySettings } from './danger-operations';
import { assertNoRecovery } from './recovery';
import { acquireSyncLock, releaseSyncLock } from './lock-manager';
import { holdRestoringUntil, setIsRestoring } from './sync-settings';
import type { StorageConfig } from '../storage/types';

export async function runMaintenance(kind: 'local' | 'cloud' | 'factory', config?: StorageConfig) {
  if (!['local', 'cloud', 'factory'].includes(kind)) throw new Error('无效的维护操作');
  if (!await acquireSyncLock('maintenance')) throw new Error('同步正在进行中');
  try {
    await assertNoRecovery();
    await setIsRestoring(true);
    if (kind === 'local') return await clearLocalBookmarks();
    if (kind === 'cloud') {
      if (!config) throw new Error('尚未配置云端存储');
      return await clearCloudBackups(config);
    }
    await resetFactorySettings();
    return {};
  } finally {
    await holdRestoringUntil();
    await releaseSyncLock('maintenance');
  }
}
