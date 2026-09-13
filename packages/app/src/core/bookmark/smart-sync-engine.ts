/**
 * 三阶段同步引擎
 * 1) 处理云端节点（创建/移动/更新） 2) 处理云端文件夹（递归）
 * 3) 删除本地多余节点（共享模式延后统一执行，防止“先删后配”丢数据）
 * 书签节点见 sync-bookmark-item.ts，文件夹节点见 sync-folder-item.ts，
 * 删除阶段见 sync-deletion.ts，索引与身份匹配见 indexer.ts
 */
import { BrowserBookmarksAPI } from "../../infrastructure/browser/api";
import type { BookmarkNode } from "../../types";
import type { GlobalIndex } from "./types";
import { syncCloudBookmark } from "./sync-bookmark-item";
import { syncCloudFolder } from "./sync-folder-item";
import { deleteUnprocessedChildren, deleteUnprocessedNodes } from "./sync-deletion";
import type { SharedSyncState, SyncItemContext } from "./sync-item-types";

export type { SharedSyncState } from "./sync-item-types";
export { deleteUnprocessedNodes };

export async function smartSync(
  localParentId: string,
  cloudNodes: BookmarkNode[],
  localIndex: GlobalIndex,
  localParentPath: string,
  sharedState?: SharedSyncState,
): Promise<void> {
  console.log(
    `[Merger] Syncing folder "${localParentPath}" (${cloudNodes.length} cloud nodes)`,
  );

  // 获取当前本地文件夹的子节点
  const localChildren = [...((await BrowserBookmarksAPI.getChildren(
    localParentId,
  )) as BookmarkNode[])];

  console.log(`[Merger] Local folder has ${localChildren.length} children`);

  // 已处理的本地 ID（防止重复处理）
  // 若上层传入共享状态（restoreFromBackup 级），则跨顶层文件夹共享，
  // 否则退化为单次调用独立（兼容旧用法，删除阶段在本调用内执行）
  const shared = sharedState ?? {
    processedLocalIds: new Set<string>(),
    visitedFolderIds: new Set<string>(),
    folderBookmarkKeys: new Map<string, Set<string>>(),
    folderUsedUrls: new Map<string, Set<string>>(),
  };
  const processedLocalIds = shared.processedLocalIds;
  const standalone = !sharedState;

  // 记录参与同步的文件夹（供删除阶段使用）
  shared.visitedFolderIds.add(localParentId);

  // 同一本地文件夹内已处理的云端书签身份（防止不可区分的重复项继续创建）
  // 按文件夹 ID 共享：同名兄弟文件夹合并到同一目标时，后续递归不会重复创建
  const processedBookmarkKeys =
    shared.folderBookmarkKeys.get(localParentId) ?? new Set<string>();
  shared.folderBookmarkKeys.set(localParentId, processedBookmarkKeys);

  // 已使用的 URL（用于检测重复）——同样按文件夹 ID 共享
  const usedUrls = shared.folderUsedUrls.get(localParentId) ?? new Set<string>();
  shared.folderUsedUrls.set(localParentId, usedUrls);

  const stats = {
    bookmarksCreated: 0,
    bookmarksMoved: 0,
    bookmarksUpdated: 0,
    foldersCreated: 0,
    foldersMoved: 0,
    itemsDeleted: 0,
  };

  const ctx: SyncItemContext = {
    localParentId,
    localParentPath,
    localIndex,
    localChildren,
    processedLocalIds,
    processedBookmarkKeys,
    usedUrls,
    // 同一文件夹内已确定目标的文件夹（允许后续同名文件夹复用同一目标）
    folderTargets: new Map<string, BookmarkNode>(),
    stats,
  };

  // Phase 1 & 2: 处理云端节点（创建/移动/更新）
  for (let i = 0; i < cloudNodes.length; i++) {
    const cloudNode = cloudNodes[i];

    if (cloudNode.url) {
      await syncCloudBookmark(ctx, cloudNode, i);
    } else if (cloudNode.children) {
      await syncCloudFolder(ctx, cloudNode, i, smartSync, sharedState);
    }
  }

  // Phase 3: 删除本地多余的节点
  // 共享模式下删除阶段由上层（restoreFromBackup）统一延后执行，
  // 避免云端跨文件夹移动时“先删后配”丢数据；
  // 仅独立调用（无 sharedState）时在本调用内立即删除以保持旧行为
  if (standalone) {
    stats.itemsDeleted += await deleteUnprocessedChildren(
      localParentId,
      processedLocalIds,
    );
  }

  // 输出统计信息
  if (
    stats.bookmarksCreated +
      stats.bookmarksMoved +
      stats.bookmarksUpdated +
      stats.foldersCreated +
      stats.foldersMoved +
      stats.itemsDeleted >
    0
  ) {
    console.log(
      `[Merger] Sync stats for "${localParentPath}":`,
      `Created: ${stats.bookmarksCreated} bookmarks, ${stats.foldersCreated} folders`,
      `| Moved: ${stats.bookmarksMoved} bookmarks, ${stats.foldersMoved} folders`,
      `| Updated: ${stats.bookmarksUpdated} bookmarks`,
      `| Deleted: ${stats.itemsDeleted} items`,
    );
  }
}
