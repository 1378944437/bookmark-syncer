/**
 * 同步范围
 * 每台设备可独立选择参与同步的系统文件夹；范围外的文件夹完全不参与
 * 同步（不上传、不下载、不删除、不被覆盖），内容安静地保留在本地。
 *
 * 默认只同步「书签栏」——与上游/旧版本的行为区分，也符合「手机与电脑
 * 层级不一致」的现实：范围是用户圈定的，算法不再猜
 */
import type { BookmarkNode } from "../../types";

export const SYNC_SCOPE_KEYS = ["bookmarks-bar", "other", "mobile"] as const;

export type SyncScopeKey = (typeof SYNC_SCOPE_KEYS)[number];

export type SyncScope = Record<SyncScopeKey, boolean>;

/** 默认范围：仅书签栏 */
export const DEFAULT_SYNC_SCOPE: SyncScope = {
  "bookmarks-bar": true,
  other: false,
  mobile: false,
};

function isScopeKey(segment: string | undefined): segment is SyncScopeKey {
  return (SYNC_SCOPE_KEYS as readonly string[]).includes(segment ?? "");
}

/**
 * 按范围过滤树：只治理顶层系统文件夹（书签栏/其他书签/移动设备书签），
 * 未知顶层文件夹（如 Firefox 的 menu________ 或异常数据）不受治理、原样保留。
 * 返回新数组；范围内的文件夹连同子树原样保留（不拷贝、不改内容）
 */
export function filterTreeByScope(tree: BookmarkNode[], scope: SyncScope): BookmarkNode[] {
  return tree.filter((node) => {
    if (node.url) return true; // 顶层裸书签（理论不出现）不受治理
    if (isScopeKey(node.folderType)) return scope[node.folderType];
    return true; // 未知顶层文件夹保留
  });
}

/** 规范化存储中的范围对象（合并默认值，防缺字段） */
export function normalizeSyncScope(stored: Partial<SyncScope> | undefined): SyncScope {
  return { ...DEFAULT_SYNC_SCOPE, ...(stored ?? {}) };
}

/** 是否至少保留了一个范围（设置页防全关） */
export function hasAnyScopeEnabled(scope: SyncScope): boolean {
  return SYNC_SCOPE_KEYS.some((key) => scope[key]);
}
