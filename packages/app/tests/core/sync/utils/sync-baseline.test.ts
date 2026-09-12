/**
 * sync-baseline.ts 测试
 * 同步基线的压缩存储与读取
 */
import { __resetMockStore } from "@src/__mocks__/webextension-polyfill";
import { loadSyncBaseline, saveSyncBaseline } from "@src/core/sync/utils/sync-baseline";
import type { BookmarkNode } from "@src/types";
import { beforeEach, describe, expect, it } from "vitest";

const tree: BookmarkNode[] = [
  { title: "A", url: "https://a.com" },
  { title: "Folder", children: [{ title: "B", url: "https://b.com" }] },
];
const url = "https://dav.example.com";

beforeEach(() => {
  __resetMockStore();
});

describe("sync-baseline", () => {
  it("保存后可完整读回", async () => {
    await saveSyncBaseline(url, tree);
    const loaded = await loadSyncBaseline(url);
    expect(loaded).not.toBeNull();
    expect(loaded!.data).toEqual(tree);
    expect(loaded!.time).toBeGreaterThan(0);
  });

  it("URL 不匹配（换了 WebDAV 配置）时返回 null", async () => {
    await saveSyncBaseline(url, tree);
    expect(await loadSyncBaseline("https://other.example.com")).toBeNull();
  });

  it("没有基线时返回 null", async () => {
    expect(await loadSyncBaseline(url)).toBeNull();
  });

  it("基线数据损坏时返回 null，不抛出", async () => {
    await saveSyncBaseline(url, tree);
    const browser = (await import("webextension-polyfill")).default;
    const stored = (await browser.storage.local.get("sync_base_backup"))["sync_base_backup"];
    stored.compressed = "!!!corrupted!!!";
    await browser.storage.local.set({ sync_base_backup: stored });
    expect(await loadSyncBaseline(url)).toBeNull();
  });
});
