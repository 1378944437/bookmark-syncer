/**
 * 处理单个云端文件夹节点：复用同名/同路径文件夹 → 改名与移动；未匹配则创建，
 * 并递归同步其子节点（递归入口由引擎注入，避免模块循环依赖）。
 */
import { BrowserBookmarksAPI } from "../../infrastructure/browser/api";
import type { BookmarkNode } from "../../types";
import { getFolderIdentityKey } from "./indexer";
import type { SharedSyncState, SyncItemContext, SyncRecurse } from "./sync-item-types";

/** 处理云端文件夹节点（递归同步其子节点） */
export async function syncCloudFolder(
  ctx: SyncItemContext,
  cloudNode: BookmarkNode,
  i: number,
  recurse: SyncRecurse,
  sharedState?: SharedSyncState,
): Promise<void> {
  const {
    localParentId,
    localParentPath,
    localIndex,
    localChildren,
    processedLocalIds,
    folderTargets,
    stats,
  } = ctx;

  const children = cloudNode.children;
  if (!children) return;

  // === 处理文件夹 ===
  const cloudFolderPath = localParentPath
    ? `${localParentPath}/${cloudNode.title}`
    : cloudNode.title;
  const folderIdentityKey = getFolderIdentityKey(cloudNode);
  const existingTarget = folderTargets.get(folderIdentityKey);

  if (existingTarget?.id) {
    await recurse(
      existingTarget.id,
      children,
      localIndex,
      cloudFolderPath,
      sharedState,
    );
    return;
  }

  let matchedFolder: BookmarkNode | undefined;

  // 1. 先在当前文件夹找同名文件夹（简单匹配）
  matchedFolder = localChildren.find(
    (local) =>
      local.id &&
      !local.url &&
      (local.title?.trim() || "") === (cloudNode.title?.trim() || "") &&
      !processedLocalIds.has(local.id),
  );

  // 2. 如果没找到，从全局索引按路径找
  if (!matchedFolder) {
    const globalFolder = localIndex.pathToFolder.get(cloudFolderPath);
    if (globalFolder && globalFolder.id && !processedLocalIds.has(globalFolder.id)) {
      matchedFolder = {
        id: globalFolder.id,
        title: globalFolder.title,
        parentId: globalFolder.parentId,
        index: globalFolder.index,
        children: [],
      };
    }
  }

  if (matchedFolder && matchedFolder.id) {
    processedLocalIds.add(matchedFolder.id);
    folderTargets.set(folderIdentityKey, matchedFolder);

    // 更新标题（如果改名了）
    if ((matchedFolder.title?.trim() || "") !== (cloudNode.title?.trim() || "")) {
      try {
        await BrowserBookmarksAPI.update(matchedFolder.id, { title: cloudNode.title });
        stats.bookmarksUpdated++; // 复用统计字段
      } catch (error) {
        console.warn(
          `[Merger] Failed to update folder title ${matchedFolder.id}:`,
          error,
        );
      }
    }

    // 调整位置（如果移动了）
    if (
      matchedFolder.parentId !== localParentId ||
      matchedFolder.index !== i
    ) {
      try {
        await BrowserBookmarksAPI.move(matchedFolder.id, {
          parentId: localParentId,
          index: i,
        });
        stats.foldersMoved++;
      } catch (error) {
        const errorMsg = (error as Error).message || '';
        // 文件夹ID不存在是正常情况（可能被其他文件夹处理过）
        if (errorMsg.includes("Can't find bookmark")) {
          console.log(
            `[Merger] Folder ${matchedFolder.id} already processed, skipping move`,
          );
        } else {
          // 其他错误才需要警告
          console.warn(
            `[Merger] Failed to move folder ${matchedFolder.id}:`,
            error,
          );
        }
      }
    }

    // 递归同步子节点
    await recurse(
      matchedFolder.id,
      children,
      localIndex,
      cloudFolderPath,
      sharedState,
    );
  } else {
    // 创建新文件夹
    try {
      const created = await BrowserBookmarksAPI.create({
        parentId: localParentId,
        title: cloudNode.title,
        index: i,
      });
      if (created.id) {
        processedLocalIds.add(created.id); // 记录新创建的 ID，防止 Phase 3 误删
        const createdFolder = { ...(created as BookmarkNode), children: [] };
        localChildren.push(createdFolder);
        folderTargets.set(folderIdentityKey, createdFolder);
        stats.foldersCreated++;

        // 继续走 smartSync，让新建文件夹的子节点也受同轮去重保护
        await recurse(
          created.id,
          children,
          localIndex,
          cloudFolderPath,
          sharedState,
        );
      }
    } catch (error) {
      console.warn(
        `[Merger] Failed to create folder "${cloudNode.title}":`,
        error,
      );
    }
  }
}
