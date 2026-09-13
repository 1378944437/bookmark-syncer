/**
 * sync-settings.ts 单元测试
 * 测试本地快照与云端备份自定义配额读取、保底 5 份防呆逻辑与非法值过滤
 */
import { __resetMockStore } from "@src/__mocks__/webextension-polyfill";
import {
  DEFAULT_MAX_CLOUD_BACKUPS,
  DEFAULT_MAX_LOCAL_SNAPSHOTS,
  getMaxCloudBackups,
  getMaxLocalSnapshots,
} from "@src/core/sync/sync-settings";
import { beforeEach, describe, expect, it } from "vitest";
import browser from "webextension-polyfill";

describe("Sync Settings - Quota Management", () => {
  beforeEach(() => {
    __resetMockStore();
  });

  describe("getMaxLocalSnapshots", () => {
    it("未设置时返回默认值 15", async () => {
      const quota = await getMaxLocalSnapshots();
      expect(quota).toBe(DEFAULT_MAX_LOCAL_SNAPSHOTS);
      expect(quota).toBe(15);
    });

    it("正确读取用户自定义有效配额", async () => {
      await browser.storage.local.set({ max_local_snapshots: 25 });
      const quota = await getMaxLocalSnapshots();
      expect(quota).toBe(25);
    });

    it("低于保底值 5 时退回默认值 15", async () => {
      await browser.storage.local.set({ max_local_snapshots: 4 });
      const quota = await getMaxLocalSnapshots();
      expect(quota).toBe(DEFAULT_MAX_LOCAL_SNAPSHOTS);
    });

    it("设置为 0 或负数时退回默认值 15", async () => {
      await browser.storage.local.set({ max_local_snapshots: 0 });
      expect(await getMaxLocalSnapshots()).toBe(DEFAULT_MAX_LOCAL_SNAPSHOTS);

      await browser.storage.local.set({ max_local_snapshots: -10 });
      expect(await getMaxLocalSnapshots()).toBe(DEFAULT_MAX_LOCAL_SNAPSHOTS);
    });

    it("设置非法非数字字符串时退回默认值 15", async () => {
      await browser.storage.local.set({ max_local_snapshots: "invalid" });
      expect(await getMaxLocalSnapshots()).toBe(DEFAULT_MAX_LOCAL_SNAPSHOTS);
    });

    it("浮点数输入自动向下取整并保底", async () => {
      await browser.storage.local.set({ max_local_snapshots: 8.9 });
      expect(await getMaxLocalSnapshots()).toBe(8);
    });
  });

  describe("getMaxCloudBackups", () => {
    it("未设置时返回默认值 15", async () => {
      const quota = await getMaxCloudBackups();
      expect(quota).toBe(DEFAULT_MAX_CLOUD_BACKUPS);
      expect(quota).toBe(15);
    });

    it("正确读取用户自定义有效配额", async () => {
      await browser.storage.local.set({ max_cloud_backups: 30 });
      const quota = await getMaxCloudBackups();
      expect(quota).toBe(30);
    });

    it("低于保底值 5 时退回默认值 15", async () => {
      await browser.storage.local.set({ max_cloud_backups: 2 });
      const quota = await getMaxCloudBackups();
      expect(quota).toBe(DEFAULT_MAX_CLOUD_BACKUPS);
    });

    it("设置为 0 或负数时退回默认值 15", async () => {
      await browser.storage.local.set({ max_cloud_backups: 0 });
      expect(await getMaxCloudBackups()).toBe(DEFAULT_MAX_CLOUD_BACKUPS);

      await browser.storage.local.set({ max_cloud_backups: -5 });
      expect(await getMaxCloudBackups()).toBe(DEFAULT_MAX_CLOUD_BACKUPS);
    });

    it("设置非法非数字字符串时退回默认值 15", async () => {
      await browser.storage.local.set({ max_cloud_backups: "not-a-number" });
      expect(await getMaxCloudBackups()).toBe(DEFAULT_MAX_CLOUD_BACKUPS);
    });

    it("浮点数输入自动向下取整并保底", async () => {
      await browser.storage.local.set({ max_cloud_backups: 12.7 });
      expect(await getMaxCloudBackups()).toBe(12);
    });
  });
});
