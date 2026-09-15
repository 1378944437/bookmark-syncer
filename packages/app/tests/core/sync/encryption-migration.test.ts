import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import browser, { __resetMockStore } from '../../../src/__mocks__/webextension-polyfill';
import { migrateEncryption } from '../../../src/core/sync/encryption-migration';
import { getE2ESettings } from '../../../src/core/sync/sync-settings';
import { decryptText, encryptText } from '../../../src/infrastructure/utils/crypto';
import { compressText, decompressText } from '../../../src/infrastructure/utils/compression';
const mocks = vi.hoisted(() => ({ client: { type: 'webdav', getFile: vi.fn(), putFile: vi.fn(), listFiles: vi.fn(), exists: vi.fn(), deleteFile: vi.fn() }, snapshot: vi.fn() }));
vi.mock('@src/infrastructure/storage/provider-factory', () => ({ createStorageProvider: () => mocks.client }));
vi.mock('@src/core/backup', () => ({ snapshotManager: { createSnapshot: mocks.snapshot } }));
const config = { url: 'https://dav.example.com', username: 'test', password: 'test' };
const tree = [{ id: '0', title: '', children: [{ id: '1', title: 'Bar', folderType: 'bookmarks-bar', children: [{ title: 'Example', url: 'https://example.com' }] }] }];
let files: Map<string, string>;
beforeEach(() => {
  __resetMockStore(); vi.clearAllMocks(); files = new Map();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, userAgent: 'Chrome/120' } });
  vi.mocked(browser.bookmarks.getTree).mockResolvedValue(tree);
  mocks.snapshot.mockResolvedValue(1);
  mocks.client.exists.mockImplementation(async path => path === 'MarkSync' || files.has(path));
  mocks.client.getFile.mockImplementation(async path => { if (!files.has(path)) throw new Error('not found'); return files.get(path); });
  mocks.client.putFile.mockImplementation(async (path, content) => { files.set(path, content); });
  mocks.client.listFiles.mockImplementation(async () => [...files.keys()].map((path, i) => ({ path, name: path.split('/').pop(), lastModified: i + 1 })));
});
afterEach(() => vi.restoreAllMocks());
it('resumes an atomic settings/baseline commit after local storage fails, without republishing', async () => {
  const originalSet = vi.mocked(browser.storage.local.set).getMockImplementation()!;
  let fail = true;
  vi.mocked(browser.storage.local.set).mockImplementation(async data => {
    if ('syncState' in data && 'e2e_enabled' in data && fail) { fail = false; throw new Error('local quota'); }
    return originalSet(data);
  });
  await expect(migrateEncryption(config, { enabled: true, passphrase: 'new-password' })).rejects.toThrow('local quota');
  expect((await getE2ESettings()).enabled).toBe(false);
  expect((await browser.storage.local.get('syncState')).syncState).toBeUndefined();
  expect((await migrateEncryption(config, { enabled: true, passphrase: 'new-password' })).success).toBe(true);
  expect(mocks.client.putFile).toHaveBeenCalledTimes(1);
  const saved = await browser.storage.local.get(['syncState', 'e2e_enabled']);
  expect(saved.e2e_enabled).toBe(true);
  expect(saved.syncState).toMatchObject({ basis: { filePath: [...files.keys()][0] } });
});
it.each([true, false])('migrates encrypted history using the old password and writes enabled=%s', async enabled => {
  const oldPath = 'MarkSync/bookmarks_old.json.gz.enc';
  files.set(oldPath, await encryptText(await compressText(JSON.stringify({ data: tree })), 'old-password'));
  await browser.storage.local.set({ e2e_enabled: true, e2e_passphrase: 'old-password' });
  const next = { enabled, passphrase: enabled ? 'new-password' : '' };
  expect((await migrateEncryption(config, next)).success).toBe(true);
  expect(await getE2ESettings()).toEqual(next);
  expect(files.has(oldPath)).toBe(true);
  expect(mocks.client.deleteFile).not.toHaveBeenCalled();
  const [path, data] = mocks.client.putFile.mock.calls[0];
  expect(path.endsWith('.enc')).toBe(enabled);
  const plain = enabled ? await decryptText(data, next.passphrase) : data;
  expect(JSON.parse(await decompressText(plain)).data[0].children[0].children[0].url).toBe('https://example.com');
  expect(browser.bookmarks.getTree).toHaveBeenCalledTimes(1);
});
it('retains old settings on unknown write result, then resumes by reading the same candidate', async () => {
  mocks.client.putFile.mockImplementationOnce(async (path, content) => { files.set(path, content); throw new Error('connection lost after write'); });
  await expect(migrateEncryption(config, { enabled: true, passphrase: 'new-password' })).rejects.toThrow('connection lost');
  expect((await getE2ESettings()).enabled).toBe(false);
  expect((await browser.storage.local.get('encryption_migration')).encryption_migration).toBeDefined();
  expect((await migrateEncryption(config, { enabled: false, passphrase: '' })).success).toBe(true);
  expect(mocks.client.putFile).toHaveBeenCalledTimes(1);
  expect(await getE2ESettings()).toEqual({ enabled: true, passphrase: 'new-password' });
});
it('does not publish when the safety snapshot cannot be saved', async () => {
  mocks.snapshot.mockRejectedValueOnce(new Error('quota exceeded'));
  await expect(migrateEncryption(config, { enabled: true, passphrase: 'new-password' })).rejects.toThrow('quota exceeded');
  expect(mocks.client.putFile).not.toHaveBeenCalled();
  expect((await getE2ESettings()).enabled).toBe(false);
});
