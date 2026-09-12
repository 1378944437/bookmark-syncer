/**
 * sync-basis.ts 测试
 * 同步方向判断的统一时间基准：只信服务器 mtime，不信设备本地时钟
 */
import { describe, expect, it } from "vitest";
import { isCloudNewerThanBasis } from "@src/core/sync/utils/sync-basis";
import type { SyncState } from "@src/core/sync/types";

const url = "https://dav.example.com";
const latest = { path: "BookmarkSyncer/a.json.gz", lastModified: 2000 };

describe("isCloudNewerThanBasis", () => {
  it("云端无文件时不算更新", () => {
    expect(isCloudNewerThanBasis(null, null, url)).toBe(false);
  });

  it("从未同步过（无状态）时云端数据视为更新", () => {
    expect(isCloudNewerThanBasis(latest, null, url)).toBe(true);
  });

  it("URL 不匹配（换了 WebDAV 配置）时视为更新", () => {
    const state = { url: "https://other.example.com", time: 9999 } as SyncState;
    expect(isCloudNewerThanBasis(latest, state, url)).toBe(true);
  });

  it("旧版状态（无 basis）退化为服务器时间 vs 本地记录时间", () => {
    const state = { url, time: 1500 } as SyncState;
    expect(isCloudNewerThanBasis(latest, state, url)).toBe(true);

    const syncedState = { url, time: 3000 } as SyncState;
    expect(isCloudNewerThanBasis(latest, syncedState, url)).toBe(false);
  });

  it("有基线时只比较服务器时间，与本地 time 字段无关", () => {
    const state = {
      url,
      time: 0,
      basis: { mtime: 2000, filePath: latest.path },
    } as SyncState;
    expect(isCloudNewerThanBasis(latest, state, url)).toBe(false);

    const newerFile = { path: "BookmarkSyncer/b.json.gz", lastModified: 3000 };
    expect(isCloudNewerThanBasis(newerFile, state, url)).toBe(true);
  });

  it("同一秒内文件被替换（mtime 相同、路径不同）视为更新", () => {
    const state = {
      url,
      time: 0,
      basis: { mtime: 2000, filePath: "BookmarkSyncer/old.json.gz" },
    } as SyncState;

    expect(isCloudNewerThanBasis(latest, state, url)).toBe(true);

    const sameFile = { path: "BookmarkSyncer/old.json.gz", lastModified: 2000 };
    expect(isCloudNewerThanBasis(sameFile, state, url)).toBe(false);
  });
});
