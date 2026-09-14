/**
 * 书签差分计算器单元测试
 */
import { describe, expect, it } from "vitest";
import {
  calculateBookmarkDiff,
  flattenBookmarks,
} from "@src/core/bookmark/diff-calculator";
import type { BookmarkNode } from "@src/types";

describe("flattenBookmarks", () => {
  it("空列表或空子树安全返回空数组", () => {
    expect(flattenBookmarks([])).toEqual([]);
    expect(flattenBookmarks([{ title: "Empty Folder", children: [] }])).toEqual([]);
  });

  it("能递归展开多层嵌套树中的有效书签并过滤文件夹", () => {
    const tree: BookmarkNode[] = [
      {
        title: "书签栏",
        children: [
          { title: "GitHub", url: "https://github.com" },
          {
            title: "工作",
            children: [
              { title: "Jira", url: "https://jira.corp.com " },
              { title: "空目录", children: [] },
            ],
          },
        ],
      },
    ];

    const result = flattenBookmarks(tree);
    expect(result).toEqual([
      { url: "https://github.com", title: "GitHub" },
      { url: "https://jira.corp.com", title: "Jira" },
    ]);
  });
});

describe("calculateBookmarkDiff", () => {
  it("两端内容完全一致时，差分均为 0", () => {
    const tree: BookmarkNode[] = [
      { title: "Google", url: "https://google.com" },
      { title: "GitHub", url: "https://github.com" },
    ];

    const diff = calculateBookmarkDiff(tree, tree);
    expect(diff).toEqual({ added: 0, updated: 0, deleted: 0 });
  });

  it("纯新增书签场景检测", () => {
    const oldTree: BookmarkNode[] = [
      { title: "Google", url: "https://google.com" },
    ];
    const newTree: BookmarkNode[] = [
      { title: "Google", url: "https://google.com" },
      { title: "GitHub", url: "https://github.com" },
      { title: "V2EX", url: "https://v2ex.com" },
    ];

    const diff = calculateBookmarkDiff(oldTree, newTree);
    expect(diff).toEqual({ added: 2, updated: 0, deleted: 0 });
  });

  it("纯删除书签场景检测", () => {
    const oldTree: BookmarkNode[] = [
      { title: "Google", url: "https://google.com" },
      { title: "GitHub", url: "https://github.com" },
      { title: "V2EX", url: "https://v2ex.com" },
    ];
    const newTree: BookmarkNode[] = [
      { title: "Google", url: "https://google.com" },
    ];

    const diff = calculateBookmarkDiff(oldTree, newTree);
    expect(diff).toEqual({ added: 0, updated: 0, deleted: 2 });
  });

  it("书签标题变更检测为 updated", () => {
    const oldTree: BookmarkNode[] = [
      { title: "Google 搜索", url: "https://google.com" },
    ];
    const newTree: BookmarkNode[] = [
      { title: "Google Search", url: "https://google.com" },
    ];

    const diff = calculateBookmarkDiff(oldTree, newTree);
    expect(diff).toEqual({ added: 0, updated: 1, deleted: 0 });
  });

  it("混合场景：同时存在新增、更新与删除", () => {
    const oldTree: BookmarkNode[] = [
      { title: "A", url: "https://a.com" },
      { title: "B 旧", url: "https://b.com" },
      { title: "C", url: "https://c.com" },
    ];
    const newTree: BookmarkNode[] = [
      { title: "A", url: "https://a.com" },
      { title: "B 新", url: "https://b.com" },
      { title: "D", url: "https://d.com" },
    ];

    const diff = calculateBookmarkDiff(oldTree, newTree);
    expect(diff).toEqual({ added: 1, updated: 1, deleted: 1 });
  });

  it("支持包含重复 URL 的复杂书签集比对", () => {
    const oldTree: BookmarkNode[] = [
      { title: "A 副本1", url: "https://a.com" },
      { title: "A 副本2", url: "https://a.com" },
    ];
    const newTree: BookmarkNode[] = [
      { title: "A 副本1", url: "https://a.com" },
    ];

    const diff = calculateBookmarkDiff(oldTree, newTree);
    expect(diff).toEqual({ added: 0, updated: 0, deleted: 1 });
  });

  it("旧集合为空与新集合为空边界判定", () => {
    const items: BookmarkNode[] = [
      { title: "A", url: "https://a.com" },
      { title: "B", url: "https://b.com" },
    ];

    expect(calculateBookmarkDiff([], items)).toEqual({
      added: 2,
      updated: 0,
      deleted: 0,
    });
    expect(calculateBookmarkDiff(items, [])).toEqual({
      added: 0,
      updated: 0,
      deleted: 2,
    });
    expect(calculateBookmarkDiff([], [])).toEqual({
      added: 0,
      updated: 0,
      deleted: 0,
    });
  });
});
