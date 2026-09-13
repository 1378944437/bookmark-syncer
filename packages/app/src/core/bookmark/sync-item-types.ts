/**
 * 同步节点处理的共享类型（引擎 / 书签节点 / 文件夹节点 / 删除阶段共用）
 */
import type { BookmarkNode } from "../../types";
import type { GlobalIndex } from "./types";

export interface SharedSyncState {
  /** 已处理过的本地节点 ID（含新建） */
  processedLocalIds: Set<string>;
  /** 参与同步的本地文件夹 ID（删除阶段对这些文件夹执行） */
  visitedFolderIds: Set<string>;
  /** 按本地文件夹 ID 作用域的书签身份去重集
   *
   * 关键防重复机制：同一本地文件夹可能被多次 smartSync 处理——
   * 典型场景是云端存在同名兄弟文件夹（如两个 "Work"），folderTargets 会
   * 把它们合并到同一个本地目标文件夹并各自递归一次。若去重集是每次
   * 调用独立的，第二次递归会把已同步过的书签再创建一份，产生同文件夹
   * 内的同名同址重复书签。
   *
   * 按文件夹 ID 作用域（而非全局共享）是为了保留合法的跨文件夹副本：
   * Work/X 与 Reading/X 是用户有意保存的两份，不应被去重。
   */
  folderBookmarkKeys: Map<string, Set<string>>;
  /** 按本地文件夹 ID 作用域的已使用 URL（全局索引兑底匹配的守卫） */
  folderUsedUrls: Map<string, Set<string>>;
}

/** 单次 smartSync 调用的可变上下文 */
export interface SyncItemContext {
  localParentId: string;
  localParentPath: string;
  localIndex: GlobalIndex;
  /** 当前本地文件夹的子节点（就地追加新建节点） */
  localChildren: BookmarkNode[];
  processedLocalIds: Set<string>;
  processedBookmarkKeys: Set<string>;
  usedUrls: Set<string>;
  /** 同一文件夹内已确定目标的文件夹（允许同名文件夹复用同一目标） */
  folderTargets: Map<string, BookmarkNode>;
  stats: SyncStats;
}

export interface SyncStats {
  bookmarksCreated: number;
  bookmarksMoved: number;
  bookmarksUpdated: number;
  foldersCreated: number;
  foldersMoved: number;
  itemsDeleted: number;
}

/** 递归入口（由引擎注入 smartSync，避免模块循环依赖） */
export type SyncRecurse = (
  localParentId: string,
  cloudNodes: BookmarkNode[],
  localIndex: GlobalIndex,
  localParentPath: string,
  sharedState?: SharedSyncState,
) => Promise<void>;
