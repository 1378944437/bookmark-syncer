import { snapshotManager } from '../backup';
import { bookmarkRepository, countBookmarks } from '../bookmark';
import { validateRestoreTree } from '../bookmark/validation';
import { acquireSyncLock, releaseSyncLock } from './lock-manager';
import { beginRecovery, finishRecovery, getRecoveryRecord } from './recovery';
import { holdRestoringUntil, setIsRestoring } from './sync-settings';
import type { SyncResult } from './types';
import browser from 'webextension-polyfill';

/** 本地快照为完整树，恢复不受云端同步范围限制。失败时保留最早的恢复依据。 */
export async function restoreLocalSnapshot(id: number): Promise<SyncResult> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('无效快照 ID');
  const holder = 'local-restore';
  if (!await acquireSyncLock(holder)) throw new Error('同步正在进行中');
  try {
    const snapshot = await snapshotManager.getSnapshotById(id);
    if (!snapshot) throw new Error('快照不存在');
    validateRestoreTree(snapshot.tree);
    await setIsRestoring(true);
    if (!await getRecoveryRecord()) {
      const tree = await bookmarkRepository.getTree();
      const before = await snapshotManager.createSnapshot(tree, countBookmarks(tree), '本地恢复前');
      await beginRecovery(before, 'local-restore');
    }
    await bookmarkRepository.restoreFromBackup(snapshot.tree, { includeLocalOnlyRoots: true });
    await browser.storage.local.remove('syncState');
    await finishRecovery();
    return { success: true, action: 'downloaded', message: '快照恢复成功' };
  } finally {
    await holdRestoringUntil();
    await releaseSyncLock(holder);
  }
}
