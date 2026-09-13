/**
 * 删除阶段：清理本地未被云端覆盖的节点
 * 1) deleteUnprocessedNodes —— 共享模式（restoreFromBackup）统一延后执行
 * 2) deleteUnprocessedChildren —— 独立调用时按文件夹立即执行
 */
import { BrowserBookmarksAPI } from "../../infrastructure/browser/api";
import type { BookmarkNode } from "../../types";
import type { SharedSyncState } from "./sync-item-types";

/**
 * 删除阶段：清理所有参与同步文件夹中未被云端覆盖的本地节点
 * 必须在所有 smartSync 处理完后统一调用（见 SharedSyncState 注释）
 */
export async function deleteUnprocessedNodes(
  shared: SharedSyncState,
): Promise<number> {
  let deleted = 0;
  for (const folderId of shared.visitedFolderIds) {
    try {
      const children = (await BrowserBookmarksAPI.getChildren(folderId)) as BookmarkNode[];
      for (const child of children) {
        if (!child.id || shared.processedLocalIds.has(child.id)) continue;

        try {
          const removeMethod = child.url
            ? BrowserBookmarksAPI.remove(child.id)
            : BrowserBookmarksAPI.removeTree(child.id);

          await removeMethod;
          deleted++;
        } catch (error) {
          const errorMsg = (error as Error).message || '';
          const nodeType = child.url ? "bookmark" : "folder";
          // 节点已被删除是正常情况（可能被其他操作处理过）
          if (errorMsg.includes("Can't find bookmark")) {
            console.log(
              `[Merger] ${nodeType} ${child.id} already deleted, skipping`,
            );
          } else {
            console.warn(
              `[Merger] Failed to delete ${nodeType} ${child.id}:`,
              error,
            );
          }
        }
      }
    } catch (error) {
      console.warn(`[Merger] Failed to get children of folder ${folderId}:`, error);
    }
  }

  console.log(`[Merger] Delete phase completed: ${deleted} nodes removed`);
  return deleted;
}

/**
 * 独立调用（无 sharedState）时的立即删除：清理指定文件夹中未被处理的子节点
 * @returns 实际删除的节点数
 */
export async function deleteUnprocessedChildren(
  localParentId: string,
  processedLocalIds: Set<string>,
): Promise<number> {
  let deleted = 0;
  const finalLocalChildren = (await BrowserBookmarksAPI.getChildren(
    localParentId,
  )) as BookmarkNode[];

  for (const localNode of finalLocalChildren) {
    if (!localNode.id || processedLocalIds.has(localNode.id)) continue;

    // 这个节点在云端不存在，删除它
    try {
      const removeMethod = localNode.url
        ? BrowserBookmarksAPI.remove(localNode.id)
        : BrowserBookmarksAPI.removeTree(localNode.id);

      await removeMethod;
      deleted++;
    } catch (error) {
      const errorMsg = (error as Error).message || '';
      const nodeType = localNode.url ? "bookmark" : "folder";

      // 节点已被删除是正常情况（可能被其他操作处理过）
      if (errorMsg.includes("Can't find bookmark")) {
        console.log(
          `[Merger] ${nodeType} ${localNode.id} already deleted, skipping`,
        );
      } else {
        // 其他错误才需要警告
        console.warn(
          `[Merger] Failed to delete ${nodeType} ${localNode.id}:`,
          error,
        );
      }
    }
  }
  return deleted;
}
