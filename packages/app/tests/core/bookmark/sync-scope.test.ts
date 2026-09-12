/**
 * sync-scope.ts 测试
 * 同步范围过滤：默认仅书签栏；范围外系统文件夹整体移除；
 * 未知顶层文件夹不受治理
 */
import {
  DEFAULT_SYNC_SCOPE,
  filterTreeByScope,
  hasAnyScopeEnabled,
  normalizeSyncScope,
} from "@src/core/bookmark/sync-scope";
import type { BookmarkNode } from "@src/types";
import { describe, expect, it } from "vitest";

const bm = (title: string, url: string): BookmarkNode => ({ title, url });
const sysFolder = (
  folderType: string,
  children: BookmarkNode[],
): BookmarkNode => ({ id: "x", title: folderType, folderType, children });

describe("filterTreeByScope", () => {
  it("默认范围（仅书签栏）：其他书签/移动设备书签被整体移除", () => {
    const tree = [
      sysFolder("bookmarks-bar", [bm("A", "https://a.com")]),
      sysFolder("other", [bm("B", "https://b.com")]),
      sysFolder("mobile", [bm("C", "https://c.com")]),
    ];
    const result = filterTreeByScope(tree, DEFAULT_SYNC_SCOPE);
    expect(result).toHaveLength(1);
    expect(result[0].folderType).toBe("bookmarks-bar");
    expect(result[0].children).toHaveLength(1);
  });

  it("范围内文件夹连同子树完整保留", () => {
    const tree = [
      sysFolder("bookmarks-bar", [
        bm("A", "https://a.com"),
        { title: "子", children: [bm("B", "https://b.com")] },
      ]),
    ];
    const result = filterTreeByScope(tree, { "bookmarks-bar": true, other: false, mobile: false });
    expect(result[0].children).toHaveLength(2);
  });

  it("范围外与范围内内容互不影响（全部开启 = 原树）", () => {
    const tree = [
      sysFolder("bookmarks-bar", [bm("A", "https://a.com")]),
      sysFolder("other", [bm("B", "https://b.com")]),
      sysFolder("mobile", [bm("C", "https://c.com")]),
    ];
    const all = { "bookmarks-bar": true, other: true, mobile: true };
    expect(filterTreeByScope(tree, all)).toEqual(tree);
  });

  it("未知顶层文件夹不受范围治理，原样保留；范围内关闭的照常移除", () => {
    const tree = [
      { title: "menu", children: [bm("M", "https://m.com")] },
      sysFolder("other", [bm("B", "https://b.com")]),
    ];
    const result = filterTreeByScope(tree, { "bookmarks-bar": true, other: false, mobile: false });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("menu");
  });

  it("顶层裸书签不受治理", () => {
    const tree = [bm("A", "https://a.com")];
    expect(filterTreeByScope(tree, DEFAULT_SYNC_SCOPE)).toEqual(tree);
  });
});

describe("范围工具", () => {
  it("normalizeSyncScope 合并默认值（缺字段回退默认）", () => {
    expect(normalizeSyncScope(undefined)).toEqual(DEFAULT_SYNC_SCOPE);
    expect(normalizeSyncScope({ other: true })).toEqual({
      "bookmarks-bar": true,
      other: true,
      mobile: false,
    });
  });

  it("hasAnyScopeEnabled：全关时返回 false", () => {
    expect(hasAnyScopeEnabled({ "bookmarks-bar": false, other: false, mobile: false })).toBe(false);
    expect(hasAnyScopeEnabled(DEFAULT_SYNC_SCOPE)).toBe(true);
  });
});
