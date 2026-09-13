/**
 * sync-executor.ts 测试
 * 测试上传和拉取执行器
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIsRestoring: vi.fn(),
  setIsRestoring: vi.fn(),
  getWebDAVConfig: vi.fn(),
  getCloudBackupList: vi.fn(),
  getSyncState: vi.fn(),
  smartPush: vi.fn(),
  smartPull: vi.fn(),
  getTree: vi.fn(),
  computeTreeHash: vi.fn(),
}));

vi.mock("@src/application/state-manager", () => ({
  getIsRestoring: (...args: any[]) => mocks.getIsRestoring(...args),
  setIsRestoring: (...args: any[]) => mocks.setIsRestoring(...args),
  getWebDAVConfig: (...args: any[]) => mocks.getWebDAVConfig(...args),
}));

vi.mock("@src/core/sync", () => ({
  getCloudBackupList: (...args: any[]) => mocks.getCloudBackupList(...args),
  getSyncState: (...args: any[]) => mocks.getSyncState(...args),
  smartPush: (...args: any[]) => mocks.smartPush(...args),
  smartPull: (...args: any[]) => mocks.smartPull(...args),
}));

vi.mock("@src/core/sync/sync-settings", () => ({
  getIsRestoring: (...args: any[]) => mocks.getIsRestoring(...args),
}));

vi.mock("@src/core/bookmark", () => ({
  bookmarkRepository: {
    getTree: (...args: any[]) => mocks.getTree(...args),
  },
  computeTreeHash: (...args: any[]) => mocks.computeTreeHash(...args),
}));

import { executeAutoPull, executeUpload } from "@src/application/sync-executor";
import { POST_PULL_UPLOAD_SUPPRESSION_MS } from "@src/application/constants";
import browser from "webextension-polyfill";

const config = { url: "https://dav.example.com", username: "u", password: "p" };

describe("executeUpload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 默认状态：在线、未恢复、有配置、自动同步已启用
    mocks.getIsRestoring.mockResolvedValue(false);
    mocks.setIsRestoring.mockResolvedValue(undefined);
    mocks.getWebDAVConfig.mockResolvedValue({
      config,
      autoSyncEnabled: true,
    });
    mocks.getCloudBackupList.mockResolvedValue([]);
    mocks.getSyncState.mockResolvedValue(null);
    mocks.smartPush.mockResolvedValue({
      success: true,
      action: "uploaded",
      message: "ok",
    });
    mocks.smartPull.mockResolvedValue({
      success: true,
      action: "downloaded",
      message: "ok",
    });
    vi.mocked(browser.storage.local.get).mockResolvedValue({});
    vi.mocked(browser.alarms.create).mockResolvedValue(undefined as any);
  });

  it("正常上传", async () => {
    await executeUpload();
    expect(mocks.smartPush).toHaveBeenCalled();
  });

  it("恢复中跳过上传", async () => {
    mocks.getIsRestoring.mockResolvedValueOnce(true);
    await executeUpload();
    expect(mocks.smartPush).not.toHaveBeenCalled();
  });

  it("离线跳过上传", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    await executeUpload();
    expect(mocks.smartPush).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
  });

  it("无配置跳过上传", async () => {
    mocks.getWebDAVConfig.mockResolvedValueOnce({
      config: null,
      autoSyncEnabled: true,
    });
    await executeUpload();
    expect(mocks.smartPush).not.toHaveBeenCalled();
  });

  it("自动同步禁用时跳过上传", async () => {
    mocks.getWebDAVConfig.mockResolvedValueOnce({
      config,
      autoSyncEnabled: false,
    });
    await executeUpload();
    expect(mocks.smartPush).not.toHaveBeenCalled();
  });

  it("最近下载后跳过自动上传", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z").getTime();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      mocks.getSyncState.mockResolvedValueOnce({
        url: config.url,
        time: now - 30000,
        type: "download",
      });

      await executeUpload();

      expect(mocks.getCloudBackupList).not.toHaveBeenCalled();
      expect(mocks.smartPull).not.toHaveBeenCalled();
      expect(mocks.smartPush).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("最近恢复后跳过自动上传", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z").getTime();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      mocks.getSyncState.mockResolvedValueOnce({
        url: config.url,
        time: now - 30000,
        type: "restore",
      });

      await executeUpload();

      expect(mocks.getCloudBackupList).not.toHaveBeenCalled();
      expect(mocks.smartPull).not.toHaveBeenCalled();
      expect(mocks.smartPush).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("下载抑制窗口结束后继续自动上传", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z").getTime();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      mocks.getSyncState.mockResolvedValueOnce({
        url: config.url,
        time: now - POST_PULL_UPLOAD_SUPPRESSION_MS - 1,
        type: "download",
      });

      await executeUpload();

      expect(mocks.getCloudBackupList).toHaveBeenCalled();
      expect(mocks.smartPush).toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("云端有更新时先 pull 再 push", async () => {
    mocks.getSyncState.mockResolvedValueOnce({
      url: config.url,
      time: 1000,
    });
    mocks.getCloudBackupList.mockResolvedValueOnce([
      {
        name: "bookmarks_1_chrome_1_v1.json.gz",
        path: "BookmarkSyncer/bookmarks_1_chrome_1_v1.json.gz",
        timestamp: 2000, // 服务器时间比本地记录的新
        totalCount: 1,
        browser: "chrome",
      },
    ]);

    await executeUpload();
    expect(mocks.smartPull).toHaveBeenCalledBefore(mocks.smartPush);
  });

  it("pull 失败时不继续 push", async () => {
    mocks.getSyncState.mockResolvedValueOnce({
      url: config.url,
      time: 1000,
    });
    mocks.getCloudBackupList.mockResolvedValueOnce([
      {
        name: "bookmarks_1_chrome_1_v1.json.gz",
        path: "BookmarkSyncer/bookmarks_1_chrome_1_v1.json.gz",
        timestamp: 2000,
        totalCount: 1,
        browser: "chrome",
      },
    ]);
    mocks.smartPull.mockResolvedValueOnce({
      success: false,
      action: "error",
      message: "pull failed",
    });

    await executeUpload();
    expect(mocks.smartPush).not.toHaveBeenCalled();
  });
});

describe("executeAutoPull", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getIsRestoring.mockResolvedValue(false);
    mocks.setIsRestoring.mockResolvedValue(undefined);
    mocks.getWebDAVConfig.mockResolvedValue({ config });
    mocks.getCloudBackupList.mockResolvedValue([
      {
        name: "bookmarks_1_chrome_1_v1.json.gz",
        path: "BookmarkSyncer/bookmarks_1_chrome_1_v1.json.gz",
        timestamp: 5000,
        totalCount: 100,
        browser: "chrome",
      },
    ]);
    mocks.getSyncState.mockResolvedValue(null);
    mocks.getTree.mockResolvedValue([]);
    mocks.computeTreeHash.mockResolvedValue("hash-a");
    mocks.smartPush.mockResolvedValue({
      success: true,
      action: "uploaded",
      message: "ok",
    });
    mocks.smartPull.mockResolvedValue({
      success: true,
      action: "downloaded",
      message: "ok",
    });
    vi.mocked(browser.storage.local.get).mockResolvedValue({});
    vi.mocked(browser.alarms.create).mockResolvedValue(undefined as any);
  });

  it("本地干净时覆盖拉取（让其他设备的删除能传播）", async () => {
    mocks.getSyncState.mockResolvedValueOnce({
      url: config.url,
      time: 1,
      localHash: "hash-a",
    });
    await executeAutoPull();
    expect(mocks.smartPull).toHaveBeenCalledWith(config, "auto_sync", "overwrite");
    expect(mocks.smartPush).not.toHaveBeenCalled();
  });

  it("本地有未同步修改时改为合并拉取，并把合并结果推上云端", async () => {
    mocks.getSyncState.mockResolvedValueOnce({
      url: config.url,
      time: 1,
      localHash: "stale-hash",
    });
    mocks.computeTreeHash.mockResolvedValueOnce("hash-a");
    await executeAutoPull();
    expect(mocks.smartPull).toHaveBeenCalledWith(config, "auto_sync", "merge");
    expect(mocks.smartPush).toHaveBeenCalled();
  });

  it("无本地基线（旧版本状态）时按本地脏处理，走合并不覆盖", async () => {
    mocks.getSyncState.mockResolvedValueOnce({ url: config.url, time: 1 });
    await executeAutoPull();
    expect(mocks.smartPull).toHaveBeenCalledWith(config, "auto_sync", "merge");
    expect(mocks.smartPush).toHaveBeenCalled();
  });

  it("检测到云端更新时执行 pull", async () => {
    await executeAutoPull();
    expect(mocks.smartPull).toHaveBeenCalled();
  });

  it("恢复中跳过 pull", async () => {
    mocks.getIsRestoring.mockResolvedValueOnce(true);
    await executeAutoPull();
    expect(mocks.smartPull).not.toHaveBeenCalled();
  });

  it("离线跳过 pull", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    await executeAutoPull();
    expect(mocks.smartPull).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
  });

  it("无配置跳过 pull", async () => {
    mocks.getWebDAVConfig.mockResolvedValueOnce({ config: null });
    await executeAutoPull();
    expect(mocks.smartPull).not.toHaveBeenCalled();
  });

  it("无云端备份时不 pull", async () => {
    mocks.getCloudBackupList.mockResolvedValueOnce([]);
    await executeAutoPull();
    expect(mocks.smartPull).not.toHaveBeenCalled();
  });

  it("云端时间不新于本地时不 pull（旧版状态回退比较）", async () => {
    mocks.getSyncState.mockResolvedValueOnce({
      url: config.url,
      time: 5000,
    });
    mocks.getCloudBackupList.mockResolvedValueOnce([
      {
        name: "bookmarks_1_chrome_1_v1.json.gz",
        path: "BookmarkSyncer/bookmarks_1_chrome_1_v1.json.gz",
        timestamp: 5000, // 等于本地记录时间
        totalCount: 100,
        browser: "chrome",
      },
    ]);
    await executeAutoPull();
    expect(mocks.smartPull).not.toHaveBeenCalled();
  });

  it("pull 错误时不误清恢复状态（恢复状态只能由恢复操作自己管理）", async () => {
    mocks.smartPull.mockRejectedValueOnce(new Error("network error"));
    await executeAutoPull();
    // 错误被吞掉并记录，但不能清除并发的恢复操作设置的 isRestoring 标志
    expect(mocks.setIsRestoring).not.toHaveBeenCalled();
  });
});
