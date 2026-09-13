/**
 * 三阶段同步引擎
 * 1) 处理云端节点（创建/移动/更新） 2) 处理云端文件夹（递归）
 * 3) 删除本地多余节点（共享模式延后统一执行，防止“先删后配”丢数据）
 * 自 merger.ts 拆出；索引与身份匹配见 indexer.ts
 */
import { BrowserBookmarksAPI } from "../../infrastructure/browser/api";
import type { BookmarkNode } from "../../types";
import { normalizeUrl } from "./normalizer";
import type { GlobalIndex } from "./types";
import { findNodeByHash, getBookmarkIdentityKeys, getFolderIdentityKey } from "./indexer";

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

  // 同一文件夹内已确定目标的文件夹（允许后续同名文件夹复用同一目标）
  const folderTargets = new Map<string, BookmarkNode>();

  // 已使用的 URL（用于检测重复）——同样按文件夹 ID 共享
  const usedUrls = shared.folderUsedUrls.get(localParentId) ?? new Set<string>();
  shared.folderUsedUrls.set(localParentId, usedUrls);

  // 统计信息
  let stats = {
    bookmarksCreated: 0,
    bookmarksMoved: 0,
    bookmarksUpdated: 0,
    foldersCreated: 0,
    foldersMoved: 0,
    itemsDeleted: 0,
  };

  // Phase 1 & 2: 处理云端节点（创建/移动/更新）
  for (let i = 0; i < cloudNodes.length; i++) {
    const cloudNode = cloudNodes[i];

    if (cloudNode.url) {
      // === 处理书签 ===
      const normalizedUrl = normalizeUrl(cloudNode.url);
      const bookmarkIdentityKeys = getBookmarkIdentityKeys(cloudNode, normalizedUrl);

      if (bookmarkIdentityKeys.some((key) => processedBookmarkKeys.has(key))) {
        console.log(
          `[Merger] Skipping duplicate cloud bookmark "${cloudNode.title}" in "${localParentPath}"`,
        );
        continue;
      }

      let matchedLocal: BookmarkNode | undefined;

      // 1. 优先通过 Hash 匹配（最可靠）
      if (cloudNode.hash) {
        matchedLocal = findNodeByHash(
          cloudNode.hash,
          localIndex,
          localChildren,
          processedLocalIds,
        );
      }

      // 2. Hash 匹配失败，通过 URL 兜底匹配（兼容旧数据或重复URL）
      if (!matchedLocal) {
        // 先在当前文件夹找
        matchedLocal = localChildren.find(
          (local) =>
            local.id &&
            normalizeUrl(local.url) === normalizedUrl &&
            !processedLocalIds.has(local.id),
        );

        // 如果当前文件夹没有，从全局索引找
        if (!matchedLocal && !usedUrls.has(normalizedUrl)) {
          const globalMatches = localIndex.urlToBookmarks.get(normalizedUrl);
          if (globalMatches && globalMatches.length > 0) {
            for (const gm of globalMatches) {
              if (gm.id && !processedLocalIds.has(gm.id)) {
                matchedLocal = {
                  id: gm.id,
                  title: gm.title,
                  url: gm.url,
                  parentId: gm.parentId,
                  index: gm.index,
                };
                break;
              }
            }
          }
        }
      }

      if (matchedLocal && matchedLocal.id) {
        processedLocalIds.add(matchedLocal.id);
        for (const key of bookmarkIdentityKeys) {
          processedBookmarkKeys.add(key);
        }
        usedUrls.add(normalizedUrl);

        // 检查是否需要更新
        const updates: { title?: string; url?: string } = {};

        // 更新标题
        if ((matchedLocal.title?.trim() || "") !== (cloudNode.title?.trim() || "")) {
          updates.title = cloudNode.title;
        }

        // 更新 URL
        if (normalizeUrl(matchedLocal.url) !== normalizedUrl) {
          updates.url = cloudNode.url;
        }

        if (Object.keys(updates).length > 0) {
          try {
            await BrowserBookmarksAPI.update(matchedLocal.id, updates);
            stats.bookmarksUpdated++;
          } catch (error) {
            console.warn(
              `[Merger] Failed to update bookmark ${matchedLocal.id}:`,
              error,
            );
          }
        }

        // 调整位置（如果不在当前文件夹或索引不对）
        if (
          matchedLocal.parentId !== localParentId ||
          matchedLocal.index !== i
        ) {
          try {
            await BrowserBookmarksAPI.move(matchedLocal.id, {
              parentId: localParentId,
              index: i,
            });
            stats.bookmarksMoved++;
          } catch (error) {
            const errorMsg = (error as Error).message || '';
            // 书签ID不存在是正常情况（可能被其他文件夹处理过）
            if (errorMsg.includes("Can't find bookmark")) {
              console.log(
                `[Merger] Bookmark ${matchedLocal.id} already processed, skipping move`,
              );
            } else {
              // 其他错误才需要警告
              console.warn(
                `[Merger] Failed to move bookmark ${matchedLocal.id}:`,
                error,
              );
            }
          }
        }
      } else {
        // 创建新书签
        usedUrls.add(normalizedUrl);
        try {
          const newBookmark = await BrowserBookmarksAPI.create({
            parentId: localParentId,
            title: cloudNode.title,
            url: cloudNode.url,
            index: i,
          });
          if (newBookmark.id) {
            processedLocalIds.add(newBookmark.id); // 记录新创建的 ID，防止 Phase 3 误删
            localChildren.push(newBookmark as BookmarkNode);
            for (const key of bookmarkIdentityKeys) {
              processedBookmarkKeys.add(key);
            }
            stats.bookmarksCreated++;
          }
        } catch (error) {
          console.warn(
            `[Merger] Failed to create bookmark "${cloudNode.title}":`,
            error,
          );
        }
      }
    } else if (cloudNode.children) {
      // === 处理文件夹 ===
      const cloudFolderPath = localParentPath
        ? `${localParentPath}/${cloudNode.title}`
        : cloudNode.title;
      const folderIdentityKey = getFolderIdentityKey(cloudNode);
      const existingTarget = folderTargets.get(folderIdentityKey);

      if (existingTarget?.id) {
        await smartSync(
          existingTarget.id,
          cloudNode.children,
          localIndex,
          cloudFolderPath,
          sharedState,
        );
        continue;
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
        await smartSync(
          matchedFolder.id,
          cloudNode.children,
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
            await smartSync(
              created.id,
              cloudNode.children,
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
  }

  // Phase 3: 删除本地多余的节点
  // 共享模式下删除阶段由上层（restoreFromBackup）统一延后执行，
  // 避免云端跨文件夹移动时“先删后配”丢数据；
  // 仅独立调用（无 sharedState）时在本调用内立即删除以保持旧行为
  if (standalone) {
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
        stats.itemsDeleted++;
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

