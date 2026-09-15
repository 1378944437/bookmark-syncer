import { beforeEach, expect, it, vi } from 'vitest';
import { __resetMockStore } from '@src/__mocks__/webextension-polyfill';
import { QueueManager } from '@src/core/storage/queue-manager';
import { CacheManager } from '@src/core/storage/cache-manager';
import { getStorageIdentifier } from '@src/core/storage/types';
import { compressText, decompressText } from '@src/infrastructure/utils/compression';
import { encryptText } from '@src/infrastructure/utils/crypto';
import type { IStorageProvider } from '@src/core/storage/provider-interface';
beforeEach(() => __resetMockStore());
it('isolates account/endpoint identifiers and refuses a cache from another target', async () => {
  const a = getStorageIdentifier({ url: 'https://dav.example.com', username: 'a', password: 'secret' });
  const b = getStorageIdentifier({ url: 'https://dav.example.com/', username: 'b', password: 'secret' });
  expect(a).not.toBe(b); expect(a).not.toContain('secret');
  expect(getStorageIdentifier({ gistId: 'same', token: 't', endpoint: 'https://api.example.com' }))
    .not.toBe(getStorageIdentifier({ gistId: 'same', token: 't' }));
  const cache = new CacheManager();
  await cache.cacheBackupList({ target: a, cachedAt: Date.now(), backups: [] });
  expect(await cache.getCachedBackupList(b)).toBeNull();
  expect(await cache.getCachedBackupList(a)).not.toBeNull();
});
it('does not share a same-path download between clients', async () => {
  const queue = new QueueManager();
  const a = { getFile: vi.fn().mockResolvedValue(await compressText('a')) } as unknown as IStorageProvider;
  const b = { getFile: vi.fn().mockResolvedValue(await compressText('b')) } as unknown as IStorageProvider;
  expect(await Promise.all([queue.getFileWithDedup(a, 'same.gz'), queue.getFileWithDedup(b, 'same.gz')])).toEqual(['a', 'b']);
});
it('deduplicates raw bytes without letting a wrong password reuse decrypted plaintext', async () => {
  const queue = new QueueManager();
  const client = { getFile: vi.fn().mockResolvedValue(await encryptText(await compressText('private'), 'right-password')) } as unknown as IStorageProvider;
  const results = await Promise.allSettled([
    queue.getFileWithDedup(client, 'same.gz.enc', { passphrase: 'right-password' }),
    queue.getFileWithDedup(client, 'same.gz.enc', { passphrase: 'wrong-password' }),
  ]);
  expect(results[0]).toEqual({ status: 'fulfilled', value: 'private' });
  expect(results[1].status).toBe('rejected');
  expect(client.getFile).toHaveBeenCalledTimes(1);
});
it('stops decompression once the allowed expanded size is exceeded', async () => {
  const data = await compressText('x'.repeat(4096));
  await expect(decompressText(data, 1024)).rejects.toThrow();
  expect((await decompressText(data, 4096)).length).toBe(4096);
});
