/**
 * 书签差分计算器
 * 对比新旧书签树或书签列表，精确统计新增、更新与删除数量
 */
import type { BookmarkNode } from "../../types";

/**
 * 差分统计结果
 */
export interface BookmarkDiffStats {
  /** 新增书签数 */
  added: number;
  /** 更新书签数（同 URL 但标题变动） */
  updated: number;
  /** 删除书签数 */
  deleted: number;
}

/**
 * 扁平化书签项（用于差分比对）
 */
export interface FlatBookmarkItem {
  url: string;
  title: string;
}

/**
 * 递归展平书签树，仅提取具体书签（过滤纯目录节点）
 *
 * @param nodes 书签节点树
 * @returns 扁平化书签列表
 */
export function flattenBookmarks(nodes: BookmarkNode[]): FlatBookmarkItem[] {
  const result: FlatBookmarkItem[] = [];

  function traverse(list: BookmarkNode[]) {
    if (!Array.isArray(list)) return;
    for (const node of list) {
      if (!node) continue;
      if (typeof node.url === "string" && node.url.trim().length > 0) {
        result.push({
          url: node.url.trim(),
          title: (node.title ?? "").trim(),
        });
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

/**
 * 计算两组书签之间的差分统计
 *
 * 算法逻辑：
 * 1. 按 URL 将书签归组，同时记录标题列表以支持重复书签
 * 2. 针对每个 URL：
 *    - 仅在旧集合：全量计入 deleted
 *    - 仅在新集合：全量计入 added
 *    - 两集合均存在：先精确匹配相同标题，剩余部分折算为 updated，超出数量分别计入 added/deleted
 *
 * @param oldSource 旧书签树或扁平书签列表
 * @param newSource 新书签树或扁平书签列表
 * @returns 差分统计对象 { added, updated, deleted }
 */
export function calculateBookmarkDiff(
  oldSource: BookmarkNode[] | FlatBookmarkItem[],
  newSource: BookmarkNode[] | FlatBookmarkItem[]
): BookmarkDiffStats {
  // 防御性校验与边界值判定
  const oldItems: FlatBookmarkItem[] =
    oldSource.length > 0 && "url" in oldSource[0] && !("children" in oldSource[0])
      ? (oldSource as FlatBookmarkItem[])
      : flattenBookmarks(oldSource as BookmarkNode[]);

  const newItems: FlatBookmarkItem[] =
    newSource.length > 0 && "url" in newSource[0] && !("children" in newSource[0])
      ? (newSource as FlatBookmarkItem[])
      : flattenBookmarks(newSource as BookmarkNode[]);

  const oldMap = new Map<string, string[]>();
  for (const item of oldItems) {
    const list = oldMap.get(item.url) ?? [];
    list.push(item.title);
    oldMap.set(item.url, list);
  }

  const newMap = new Map<string, string[]>();
  for (const item of newItems) {
    const list = newMap.get(item.url) ?? [];
    list.push(item.title);
    newMap.set(item.url, list);
  }

  let added = 0;
  let updated = 0;
  let deleted = 0;

  // 收集所有去重 URL 键
  const allUrls = new Set<string>([...oldMap.keys(), ...newMap.keys()]);

  for (const url of allUrls) {
    const oldTitles = oldMap.get(url);
    const newTitles = newMap.get(url);

    if (!oldTitles || oldTitles.length === 0) {
      // 仅新集合存在
      added += newTitles?.length ?? 0;
      continue;
    }

    if (!newTitles || newTitles.length === 0) {
      // 仅旧集合存在
      deleted += oldTitles.length;
      continue;
    }

    // 两侧均存在该 URL：先配对标题完全一致的项
    const remainingOld: string[] = [];
    const remainingNew = [...newTitles];

    for (const ot of oldTitles) {
      const matchIdx = remainingNew.indexOf(ot);
      if (matchIdx !== -1) {
        // 标题完全一致，消耗配对
        remainingNew.splice(matchIdx, 1);
      } else {
        remainingOld.push(ot);
      }
    }

    // 无法完全匹配标题的部分：两者的交集视为更新，差集分别视为新增/删除
    const matchedUpdates = Math.min(remainingOld.length, remainingNew.length);
    updated += matchedUpdates;
    deleted += remainingOld.length - matchedUpdates;
    added += remainingNew.length - matchedUpdates;
  }

  return { added, updated, deleted };
}
