/**
 * sync-analytics.ts 单元测试
 * 测试日志存储上限轮转、清空以及按日热力图聚合统计
 */
import { __resetMockStore } from "@src/__mocks__/webextension-polyfill";
import {
  addSyncLog,
  clearSyncLogs,
  formatDateKey,
  getDailyActivities,
  getSyncLogs,
  MAX_SYNC_LOGS,
} from "@src/core/analytics/sync-analytics";
import { beforeEach, describe, expect, it } from "vitest";

describe("SyncAnalytics - 同步日志与活动统计", () => {
  beforeEach(() => {
    __resetMockStore();
  });

  describe("addSyncLog 与 getSyncLogs", () => {
    it("初始状态下返回空日志列表", async () => {
      expect(await getSyncLogs()).toEqual([]);
    });

    it("正确追加日志并生成唯一 ID", async () => {
      const log = await addSyncLog({
        timestamp: Date.now(),
        trigger: "manual",
        action: "uploaded",
        message: "上传成功",
        diff: { added: 3, updated: 1, deleted: 0 },
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe("uploaded");

      const list = await getSyncLogs();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(log.id);
      expect(list[0].diff?.added).toBe(3);
    });

    it("严格遵循 FIFO 轮转淘汰最多 100 条", async () => {
      const baseTime = Date.now();
      for (let i = 0; i < 110; i++) {
        await addSyncLog({
          timestamp: baseTime + i * 1000,
          trigger: "auto",
          action: "uploaded",
          message: `msg-${i}`,
        });
      }

      const list = await getSyncLogs();
      expect(list.length).toBe(MAX_SYNC_LOGS);
      // 最新一条是 msg-109
      expect(list[0].message).toBe("msg-109");
    });
  });

  describe("clearSyncLogs", () => {
    it("清空所有已有日志", async () => {
      await addSyncLog({
        timestamp: Date.now(),
        trigger: "manual",
        action: "downloaded",
        message: "下载成功",
      });
      expect((await getSyncLogs()).length).toBe(1);

      await clearSyncLogs();
      expect((await getSyncLogs()).length).toBe(0);
    });
  });

  describe("getDailyActivities", () => {
    it("生成连续日期数组并准确聚合当天同步次数与差分变动", async () => {
      const now = new Date();
      const todayKey = formatDateKey(now);

      // 记录两条今天的日志
      await addSyncLog({
        timestamp: now.getTime(),
        trigger: "auto",
        action: "uploaded",
        message: "upload 1",
        diff: { added: 5, updated: 2, deleted: 1 },
      });
      await addSyncLog({
        timestamp: now.getTime(),
        trigger: "manual",
        action: "uploaded",
        message: "upload 2",
        diff: { added: 3, updated: 0, deleted: 2 },
      });

      const activities = await getDailyActivities(7);
      expect(activities.length).toBe(7);

      const todayActivity = activities.find((a) => a.date === todayKey);
      expect(todayActivity).toBeDefined();
      expect(todayActivity?.count).toBe(2);
      expect(todayActivity?.added).toBe(8);
      expect(todayActivity?.updated).toBe(2);
      expect(todayActivity?.deleted).toBe(3);

      // 其余无操作的天数应为 0
      const otherDays = activities.filter((a) => a.date !== todayKey);
      for (const day of otherDays) {
        expect(day.count).toBe(0);
        expect(day.added).toBe(0);
      }
    });
  });
});
