import { beforeEach, expect, it, vi } from 'vitest';
import browser, { __resetMockStore } from '../../../src/__mocks__/webextension-polyfill';
const mocks = vi.hoisted(() => ({ createSnapshot: vi.fn(), getSnapshotById: vi.fn(), getTree: vi.fn(), restore: vi.fn() }));
vi.mock('@src/core/backup', () => ({ snapshotManager: { createSnapshot: mocks.createSnapshot, getSnapshotById: mocks.getSnapshotById } }));
vi.mock('@src/core/bookmark', () => ({ bookmarkRepository: { getTree: mocks.getTree, restoreFromBackup: mocks.restore }, countBookmarks: () => 1 }));
import { restoreLocalSnapshot } from '../../../src/core/sync/local-restore';
import { getRecoveryRecord, assertNoRecovery } from '../../../src/core/sync/recovery';
import { getIsRestoring } from '../../../src/core/sync/sync-settings';
const tree = [{ id: '0', title: '', children: [{ id: '1', title: 'Bar', children: [] }] }];
beforeEach(() => {
  __resetMockStore(); vi.resetAllMocks();
  mocks.createSnapshot.mockResolvedValue(2);
  mocks.getSnapshotById.mockResolvedValue({ id: 1, tree });
  mocks.getTree.mockResolvedValue(tree);
  mocks.restore.mockResolvedValue(undefined);
});
it('snapshot failure prevents any bookmark write', async () => {
  mocks.createSnapshot.mockRejectedValueOnce(new Error('disk full'));
  await expect(restoreLocalSnapshot(1)).rejects.toThrow('disk full');
  expect(mocks.restore).not.toHaveBeenCalled();
  expect(await getRecoveryRecord()).toBeNull();
});
it('keeps recovery evidence after partial failure and permits explicit rollback', async () => {
  mocks.restore.mockRejectedValueOnce(new Error('move failed'));
  await expect(restoreLocalSnapshot(1)).rejects.toThrow('move failed');
  expect((await getRecoveryRecord())?.snapshotId).toBe(2);
  await expect(assertNoRecovery()).rejects.toThrow('未完成');
  expect(await getIsRestoring()).toBe(true);
  await browser.storage.local.set({ syncState: { time: 1 } });
  expect((await restoreLocalSnapshot(2)).success).toBe(true);
  expect(await getRecoveryRecord()).toBeNull();
  expect((await browser.storage.local.get('syncState')).syncState).toBeUndefined();
  expect(mocks.createSnapshot).toHaveBeenCalledTimes(1);
});
