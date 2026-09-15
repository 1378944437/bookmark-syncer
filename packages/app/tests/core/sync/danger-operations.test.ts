/**
 * danger-operations.ts 单元测试
 * 测试清空本地书签（自动备份）、清空云端备份与恢复出厂设置
 */
import { __resetMockStore } from "@src/__mocks__/webextension-polyfill";
import {
  clearCloudBackups,
  clearLocalBookmarks,
  resetFactorySettings,
} from "@src/core/sync/danger-operations";
import { beforeEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";

// Mock snapshotManager
const mockCreateSnapshot = vi.fn(async () => 42);
const mockDeleteAllSnapshots = vi.fn(async () => {});

vi.mock("@src/core/backup", () => ({
  snapshotManager: {
    createSnapshot: (...args: any[]) => mockCreateSnapshot(...args),
    deleteAllSnapshots: (...args: any[]) => mockDeleteAllSnapshots(...args),
  },
}));

// Mock WebDAV client
const mockDeleteFile = vi.fn(async () => {});
const mockExists = vi.fn(async () => true);
const mockListFiles = vi.fn(async () => [
  { name: "bookmarks_1.json.gz", path: "/BookmarkSyncer/bookmarks_1.json.gz" },
  { name: "bookmarks_2.json.gz.enc", path: "/BookmarkSyncer/bookmarks_2.json.gz.enc" },
  { name: "other.txt", path: "/BookmarkSyncer/other.txt" },
]);

vi.mock("@src/infrastructure/http/webdav-client", () => ({
  getWebDAVClient: vi.fn(() => ({
    exists: mockExists,
    listFiles: mockListFiles,
    deleteFile: mockDeleteFile,
  })),
}));

describe("DangerOperations - 危险操作领域服务", () => {
  beforeEach(() => {
    __resetMockStore();
    vi.clearAllMocks();
  });

  describe("clearLocalBookmarks", () => {
    it("清空本地书签前强制创建安全快照并递归删除书签项", async () => {
      // 模拟本地有一棵书签树：1 个系统文件夹，内含 1 个书签与 1 个子文件夹
      const fakeTree = [
        {
          id: "0",
          title: "root",
          children: [
            {
              id: "1",
              title: "书签栏",
              children: [
                { id: "b1", title: "Site A", url: "https://a.com" },
                { id: "f1", title: "Sub Folder", children: [] },
              ],
            },
          ],
        },
      ];

      vi.spyOn(browser.bookmarks, "getTree").mockResolvedValueOnce(fakeTree as any);

      const result = await clearLocalBookmarks();

      // 验证自动触发安全快照备份
      expect(mockCreateSnapshot).toHaveBeenCalledWith(
        fakeTree,
        1,
        "清空本地书签前自动备份"
      );
      expect(result.snapshotId).toBe(42);

      // 验证分别调用 remove 与 removeTree
      expect(browser.bookmarks.remove).toHaveBeenCalledWith("b1");
      expect(browser.bookmarks.removeTree).toHaveBeenCalledWith("f1");
      expect(result.deletedCount).toBe(2);
    });
  });

  describe("clearCloudBackups", () => {
    it("仅清理书签备份文件，不删除其他 JSON 文件", async () => {
      const config = {
        url: "https://dav.example.com",
        username: "user",
        password: "pwd",
      };

      const result = await clearCloudBackups(config);
      expect(result.deletedCount).toBe(2); // 只删 bookmarks_1.json.gz 与 bookmarks_2.json.gz.enc，忽略 other.txt
      expect(mockDeleteFile).toHaveBeenCalledWith("/BookmarkSyncer/bookmarks_1.json.gz");
      expect(mockDeleteFile).toHaveBeenCalledWith("/BookmarkSyncer/bookmarks_2.json.gz.enc");
    });
  });

  describe("resetFactorySettings", () => {
    it("清除所有本地快照、清空 storage.local 与 session 缓存", async () => {
      await browser.storage.local.set({ webdav_url: "https://dav.example.com" });
      expect((await browser.storage.local.get("webdav_url")).webdav_url).toBe("https://dav.example.com");

      await resetFactorySettings();

      expect(mockDeleteAllSnapshots).toHaveBeenCalled();
      expect((await browser.storage.local.get("webdav_url")).webdav_url).toBeUndefined();
    });
  });
});
