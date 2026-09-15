import { afterEach, expect, it, vi } from 'vitest';
import { checkCloudStateBeforeUpload } from '../../../src/core/sync/utils/upload-precheck';
import { fetchValidatedCloudBackup } from '../../../src/core/sync/utils/cloud-data-helper';
import { queueManager } from '../../../src/core/storage/queue-manager';
import { DEFAULT_SYNC_SCOPE } from '../../../src/core/bookmark/sync-scope';
import type { IStorageProvider } from '../../../src/core/storage/provider-interface';
import { computeTreeHash } from '@src/core/bookmark';
import { getSyncState } from '@src/core/sync/state-manager';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('rejects a failed listing instead of authorizing an upload', async () => {
  const client = { listFiles: vi.fn().mockRejectedValue(new Error('503 unavailable')) } as unknown as IStorageProvider;
  await expect(checkCloudStateBeforeUpload({ client, configUrl: 'test', lockHolder: 'manual', scopedLocalTree: [], syncScope: DEFAULT_SYNC_SCOPE, e2e: { enabled: false, passphrase: '' } })).rejects.toThrow('503');
});
it.each(['', '{', JSON.stringify({ data: [{ title: '', children: [{ title: 'broken' }] }] })])('rejects empty or malformed cloud content: %s', async content => {
  vi.spyOn(queueManager, 'getFileWithDedup').mockResolvedValue(content);
  await expect(fetchValidatedCloudBackup({} as IStorageProvider, 'backup.json.gz')).rejects.toThrow();
});
it('recomputes untrusted hashes and persists a complete identical-content baseline', async () => {
  vi.stubGlobal('navigator', { onLine: true, userAgent: 'Chrome/120' });
  const tree = [{ id: '0', title: '', children: [{ id: '1', title: 'Bar', folderType: 'bookmarks-bar', children: [{ title: 'Example', url: 'https://example.com', hash: 'forged' }] }] }];
  vi.spyOn(queueManager, 'getFileWithDedup').mockResolvedValue(JSON.stringify({ data: tree }));
  const client = { listFiles: vi.fn().mockResolvedValue([{ name: 'bookmarks_test.json.gz', path: 'MarkSync/bookmarks_test.json.gz', lastModified: 1 }]) } as unknown as IStorageProvider;
  const cloud = await fetchValidatedCloudBackup(client, 'MarkSync/bookmarks_test.json.gz');
  expect(cloud?.data[0].children?.[0].children?.[0].hash).not.toBe('forged');
  expect((await checkCloudStateBeforeUpload({ client, configUrl: 'test', lockHolder: 'manual', scopedLocalTree: tree, syncScope: DEFAULT_SYNC_SCOPE, e2e: { enabled: false, passphrase: '' } })).kind).toBe('skip');
  expect(await getSyncState('test')).toMatchObject({ type: 'skip_identical', localHash: await computeTreeHash(tree), scope: DEFAULT_SYNC_SCOPE });
});
