/**
 * state-manager.ts (core/sync) 测试
 * 测试同步状态管理器
 */
import { SyncStateManager } from "@src/core/sync/state-manager";
import browser from "webextension-polyfill";
import { __resetMockStore } from "@src/__mocks__/webextension-polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SYNC_SCOPE } from '@src/core/bookmark/sync-scope';

describe("SyncStateManager", () => {
  let manager: SyncStateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetMockStore();
    manager = new SyncStateManager();
  });

  describe("getState", () => {
    it("无状态时返回 null", async () => {
      const result = await manager.getState("https://webdav.example.com");
      expect(result).toBeNull();
    });

    it("URL 匹配时返回状态", async () => {
      const state = {
        scope: DEFAULT_SYNC_SCOPE,
        time: Date.now(),
        url: "https://webdav.example.com",
        type: "upload" as const,
      };
      await browser.storage.local.set({ syncState: state });

      const result = await manager.getState("https://webdav.example.com");
      expect(result).toEqual(state);
    });

    it("URL 不匹配时返回 null", async () => {
      const state = {
        time: Date.now(),
        url: "https://other.example.com",
        type: "upload" as const,
      };
      await browser.storage.local.set({ syncState: state });

      const result = await manager.getState("https://webdav.example.com");
      expect(result).toBeNull();
    });
  });

  describe("setState", () => {
    it("正确存储状态", async () => {
      const state = {
        time: 1234567890,
        url: "https://webdav.example.com",
        type: "download" as const,
      };
      await manager.setState(state);

      const stored = await browser.storage.local.get("syncState");
      expect(stored.syncState).toMatchObject(state);
    });
  });

  describe("getLastSyncTime", () => {
    it("无状态时返回 0", async () => {
      const time = await manager.getLastSyncTime("https://webdav.example.com");
      expect(time).toBe(0);
    });

    it("有匹配状态时返回时间戳", async () => {
      const state = {
        scope: DEFAULT_SYNC_SCOPE,
        time: 1234567890,
        url: "https://webdav.example.com",
        type: "upload" as const,
      };
      await browser.storage.local.set({ syncState: state });

      const time = await manager.getLastSyncTime("https://webdav.example.com");
      expect(time).toBe(1234567890);
    });

    it("URL 不匹配时返回 0", async () => {
      const state = {
        time: 1234567890,
        url: "https://other.example.com",
        type: "upload" as const,
      };
      await browser.storage.local.set({ syncState: state });

      const time = await manager.getLastSyncTime("https://webdav.example.com");
      expect(time).toBe(0);
    });
  });

  it('does not trust a legacy baseline without scope', async () => {
    await browser.storage.local.set({ syncState: { url: 'target', time: 1, localHash: 'old' } });
    expect(await manager.getState('target')).toBeNull();
  });
  it('compares scope values even when browser storage reorders object keys', async () => {
    const state = { url: 'target', time: 1, localHash: 'baseline', type: 'upload',
      scope: { 'bookmarks-bar': true, mobile: false, other: false } };
    await browser.storage.local.set({ syncState: state });
    expect(await manager.getState('target')).toEqual(state);
  });
});
