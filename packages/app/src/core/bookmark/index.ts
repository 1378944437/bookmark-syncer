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

// 三方对比检测（三方合并第 1 步）
export type { ConflictSample, ThreeWayReport } from "./three-way";
export { detectThreeWayConflicts } from "./three-way";

// 三树合并（三方合并第 2 步）
export type { ThreeWayMergeOptions, ThreeWayMergeReport, ThreeWayMergeSample } from "./three-way-merger";
export { mergeThreeWay } from "./three-way-merger";

// 同步范围
export type { SyncScope, SyncScopeKey } from "./sync-scope";
export { DEFAULT_SYNC_SCOPE, filterTreeByScope, hasAnyScopeEnabled, normalizeSyncScope, SYNC_SCOPE_KEYS } from "./sync-scope";

// 树合并与同步
export {
    buildGlobalIndex, createChildren, mergeNodes
} from "./merger";

// 仓储层（推荐使用）
export { BookmarkRepository, bookmarkRepository } from "./repository";
