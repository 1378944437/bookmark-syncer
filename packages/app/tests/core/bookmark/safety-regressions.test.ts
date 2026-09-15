import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import browser, { __resetMockStore } from '../../../src/__mocks__/webextension-polyfill';
import { DEFAULT_SYNC_SCOPE, filterTreeByScope } from '../../../src/core/bookmark/sync-scope';
import { bookmarkRepository } from '../../../src/core/bookmark/repository';
import { annotateSystemFolders } from '../../../src/core/bookmark/normalizer';
const leaf = { id: '10', title: 'Example', url: 'https://example.com', parentId: '2', index: 0 };
const tree = () => [{ id: '0', title: '', children: [
  { id: '1', title: 'Bar', folderType: 'bookmarks-bar', parentId: '0', children: [] as typeof leaf[] },
  { id: '2', title: 'Other', folderType: 'other', parentId: '0', children: [{ ...leaf }] },
]}];
beforeEach(() => { __resetMockStore(); vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());
it('does not reinterpret an unidentified root folder as the bookmarks bar', () => {
  const folders = annotateSystemFolders([{ title: '', children: [{ title: 'Unknown', children: [] }] }]);
  expect(folders[0].children?.[0].folderType).toBeUndefined();
});
it('filters actual browser root children without mutating the input', () => {
  const original = tree();
  expect(filterTreeByScope(original, DEFAULT_SYNC_SCOPE)[0].children?.map(n => n.folderType)).toEqual(['bookmarks-bar']);
  expect(original[0].children).toHaveLength(2);
});
it('never moves an excluded bookmark into the restored scope', async () => {
  vi.mocked(browser.bookmarks.getTree).mockResolvedValue(tree());
  vi.mocked(browser.bookmarks.getChildren).mockImplementation(async id => id === '2' ? [{ ...leaf }] : []);
  vi.mocked(browser.bookmarks.create).mockResolvedValue({ ...leaf, id: '11', parentId: '1' });
  await bookmarkRepository.restoreFromBackup([{ id: '0', title: '', children: [{ id: '1', title: 'Bar', folderType: 'bookmarks-bar', children: [{ title: 'Example', url: leaf.url }] }] }]);
  expect(browser.bookmarks.move).not.toHaveBeenCalled();
  expect(browser.bookmarks.create).toHaveBeenCalledWith(expect.objectContaining({ parentId: '1', url: leaf.url }));
});
it('restores Firefox-only menu bookmarks from a full local snapshot', async () => {
  const local = [{ id: 'root________', title: '', children: [{ id: 'menu________', title: 'Bookmarks Menu', children: [] }] }];
  vi.mocked(browser.bookmarks.getTree).mockResolvedValue(local);
  vi.mocked(browser.bookmarks.getChildren).mockResolvedValue([]);
  vi.mocked(browser.bookmarks.create).mockResolvedValue({ ...leaf, parentId: 'menu________' });
  const snapshot = [{ ...local[0], children: [{ ...local[0].children[0], children: [{ title: 'Example', url: leaf.url }] }] }];
  await bookmarkRepository.restoreFromBackup(snapshot, { includeLocalOnlyRoots: true });
  expect(browser.bookmarks.create).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'menu________' }));
});
it('stops before deletion if replacement creation fails', async () => {
  const local = tree(); local[0].children[0].children = [{ ...leaf, parentId: '1' }];
  vi.mocked(browser.bookmarks.getTree).mockResolvedValue(local);
  vi.mocked(browser.bookmarks.getChildren).mockImplementation(async id => id === '1' ? [{ ...leaf, parentId: '1' }] : []);
  vi.mocked(browser.bookmarks.create).mockRejectedValueOnce(new Error('write failed'));
  await expect(bookmarkRepository.restoreFromBackup([{ id: '0', title: '', children: [{ id: '1', title: 'Bar', children: [{ title: 'New', url: 'https://new.example.com' }] }] }])).rejects.toThrow('write failed');
  expect(browser.bookmarks.remove).not.toHaveBeenCalled();
  expect(browser.bookmarks.removeTree).not.toHaveBeenCalled();
});
it.each(['update', 'move'] as const)('stops before deletion if %s fails', async operation => {
  const local = tree(); local[0].children[0].children = [{ ...leaf, parentId: '1', index: 2 }];
  vi.mocked(browser.bookmarks.getTree).mockResolvedValue(local);
  vi.mocked(browser.bookmarks.getChildren).mockResolvedValue(local[0].children[0].children);
  vi.mocked(browser.bookmarks[operation]).mockRejectedValueOnce(new Error('API failure'));
  await expect(bookmarkRepository.restoreFromBackup([{ id: '0', title: '', children: [{ id: '1', title: 'Bar', children: [{ title: 'Renamed', url: leaf.url }] }] }])).rejects.toThrow('API failure');
  expect(browser.bookmarks.remove).not.toHaveBeenCalled();
  expect(browser.bookmarks.removeTree).not.toHaveBeenCalled();
});
it('reports a deletion failure instead of claiming successful restore', async () => {
  const local = tree(); local[0].children[0].children = [{ ...leaf, parentId: '1' }];
  vi.mocked(browser.bookmarks.getTree).mockResolvedValue(local);
  vi.mocked(browser.bookmarks.getChildren).mockResolvedValue(local[0].children[0].children);
  vi.mocked(browser.bookmarks.remove).mockRejectedValueOnce(new Error('delete failed'));
  await expect(bookmarkRepository.restoreFromBackup([{ id: '0', title: '', children: [{ id: '1', title: 'Bar', children: [] }] }])).rejects.toThrow('delete failed');
});
