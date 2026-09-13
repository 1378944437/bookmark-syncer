/**
 * Bookmark 领域统一导出
 */

// 类型定义
export type {
    BookmarkCreateOptions, BookmarkLocation,
    FolderLocation,
    GlobalIndex, NodeLocation
} from "./types";

export {
    FIREFOX_ID_TO_FOLDER_TYPE,
    FIREFOX_SYSTEM_IDS, FOLDER_TYPE_TO_FIREFOX_ID
} from "./types";

// 标准化工具
export {
    findMatchingSystemFolder, isSystemRootFolder, normalizeUrl
} from "./normalizer";

// 哈希计算
export { assignHashToNode, assignHashes } from "./hash-calculator";

// 树比对
export {
    compareWithCloud,
    computeTreeHash,
    countBookmarks,
    extractSignaturesWithHash
} from "./comparator";

// 同步范围
export type { SyncScope, SyncScopeKey } from "./sync-scope";
export { DEFAULT_SYNC_SCOPE, filterTreeByScope, hasAnyScopeEnabled, normalizeSyncScope, SYNC_SCOPE_KEYS } from "./sync-scope";

// 索引与身份匹配
export { buildGlobalIndex, findNodeByHash, getBookmarkIdentityKeys } from "./indexer";

// 三阶段同步引擎
export { deleteUnprocessedNodes, smartSync, type SharedSyncState } from "./smart-sync-engine";

// 基础合并
export { createChildren, mergeNodes } from "./merger-basic";

// 仓储层（推荐使用）
export { BookmarkRepository, bookmarkRepository } from "./repository";
