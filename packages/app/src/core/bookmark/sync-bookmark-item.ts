/**
 * 处理单个云端书签节点：Hash/URL 匹配 → 更新标题与 URL → 调整位置；未匹配则创建。
 * 由 smart-sync-engine 在阶段 1 调用。
 */
import { BrowserBookmarksAPI } from "../../infrastructure/browser/api";
import type { BookmarkNode } from "../../types";
import { normalizeUrl } from "./normalizer";
import { findNodeByHash, getBookmarkIdentityKeys } from "./indexer";
import type { SyncItemContext } from "./sync-item-types";

export async function syncCloudBookmark(
  ctx: SyncItemContext,
  cloudNode: BookmarkNode,
  i: number,
): Promise<void> {
  const {
    localParentId,
    localParentPath,
    localIndex,
    localChildren,
    processedLocalIds,
    processedBookmarkKeys,
    usedUrls,
    stats,
  } = ctx;

  // === 处理书签 ===
  const normalizedUrl = normalizeUrl(cloudNode.url);
  const bookmarkIdentityKeys = getBookmarkIdentityKeys(cloudNode, normalizedUrl);

  if (bookmarkIdentityKeys.some((key) => processedBookmarkKeys.has(key))) {
    console.log(
      `[Merger] Skipping duplicate cloud bookmark "${cloudNode.title}" in "${localParentPath}"`,
    );
    return;
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
}
