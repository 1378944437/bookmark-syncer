/**
 * 书签索引构建与身份匹配
 * 全局索引（哈希/URL/路径）用于跨文件夹定位节点，是三阶段同步与
 * 基础合并共用的查找基础设施；身份键（规范化 URL + 标题）用于去重判定
 */
import { generateHash } from "../../infrastructure/utils/crypto";
import type { BookmarkNode } from "../../types";
import type { BookmarkLocation, FolderLocation, GlobalIndex, NodeLocation } from "./types";
import { hasCrossBrowserMapping, isSystemRootFolder, normalizeUrl } from "./normalizer";

/**
 * 构建全局索引（本地树：动态计算 hash）
 * 优化：并行计算所有书签的 hash，提升大量书签时的性能
 */
export async function buildGlobalIndex(tree: BookmarkNode[]): Promise<GlobalIndex> {
  const hashToNode = new Map<string, NodeLocation[]>();
  const urlToBookmarks = new Map<string, BookmarkLocation[]>();
  const pathToFolder = new Map<string, FolderLocation>();
  const idToPath = new Map<string, string>();

  // 第一步：收集所有书签和文件夹（不计算 hash）
  interface BookmarkInfo {
    node: BookmarkNode;
    normalizedUrl: string;
    parentId: string;
    index: number;
  }

  interface FolderInfo {
    node: BookmarkNode;
    path: string;
    parentId: string;
    index: number;
  }

  const bookmarksToHash: BookmarkInfo[] = [];
  const foldersToIndex: FolderInfo[] = [];

  function collect(node: BookmarkNode, parentPath: string) {
    const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title;

    if (node.url) {
      // 收集书签信息
      bookmarksToHash.push({
        node,
        normalizedUrl: normalizeUrl(node.url),
        parentId: node.parentId || "",
        index: node.index ?? 0,
      });
    } else if (node.children) {
      // 收集文件夹信息
      if (!isSystemRootFolder(node)) {
        foldersToIndex.push({
          node,
          path: currentPath,
          parentId: node.parentId || "",
          index: node.index ?? 0,
        });
      }

      // 递归收集子节点
      // 系统根的一级子节点用 folderType（或标题）作路径前缀：
      // 避免 bar/Work 与 other/Work 同 key 互相覆盖
      const childPrefix = isSystemRootFolder(node)
        ? (node.folderType || node.title || "")
        : currentPath;

      for (const child of node.children) {
        // 跳过无跨浏览器映射的系统根子树（如 Firefox 的 menu________）：
        // 这些子树设计上不同步，若编入索引会被全局匹配搬空
        if (isSystemRootFolder(node) && isSystemRootFolder(child) && !hasCrossBrowserMapping(child)) {
          continue;
        }
        collect(child, isSystemRootFolder(node) ? childPrefix : currentPath);
      }
    }
  }

  // 收集所有节点
  for (const node of tree) {
    collect(node, "");
  }

  // 第二步：并行计算所有书签的 hash（性能优化关键）
  const hashes = await Promise.all(
    bookmarksToHash.map(({ normalizedUrl, node }) =>
      generateHash(normalizedUrl, node.title)
    )
  );

  // 第三步：构建索引（同步操作，很快）
  bookmarksToHash.forEach(({ node, normalizedUrl, parentId, index }, i) => {
    const hash = hashes[i];

    const location: BookmarkLocation = {
      id: node.id,
      hash,
      parentId,
      index,
      title: node.title,
      url: normalizedUrl,
    };

    // Hash 索引（主要匹配方式，同 hash 可能有多个节点）
    const hashList = hashToNode.get(hash) || [];
    hashList.push({
      id: node.id,
      hash,
      parentId,
      index,
      title: node.title,
      url: normalizedUrl,
      isFolder: false,
    });
    hashToNode.set(hash, hashList);

    // URL 索引（兜底匹配）
    const existing = urlToBookmarks.get(normalizedUrl) || [];
    existing.push(location);
    urlToBookmarks.set(normalizedUrl, existing);
  });

  // 第四步：索引文件夹
  foldersToIndex.forEach(({ node, path, parentId, index }) => {
    const location: FolderLocation = {
      id: node.id,
      parentId,
      index,
      title: node.title,
      path,
    };

    pathToFolder.set(path, location);
    if (node.id) {
      idToPath.set(node.id, path);
    }
  });

  return { hashToNode, urlToBookmarks, pathToFolder, idToPath };
}

/**
 * 通过 Hash 查找节点（优先从本地子节点查找，否则从全局索引构建）
 */
export function findNodeByHash(
  hash: string,
  localIndex: GlobalIndex,
  localChildren: BookmarkNode[],
  processedLocalIds: Set<string>,
): BookmarkNode | undefined {
  const hashMatches = localIndex.hashToNode.get(hash);
  if (!hashMatches || hashMatches.length === 0) {
    return undefined;
  }

  // 从匹配列表中找到第一个未被处理过的节点
  for (const hashMatch of hashMatches) {
    if (!hashMatch.id || processedLocalIds.has(hashMatch.id)) {
      continue;
    }

    // 先尝试从本地子节点获取完整信息
    const localNode = localChildren.find((l) => l.id === hashMatch.id);
    if (localNode) {
      return localNode;
    }

    // 节点不在当前文件夹，从全局索引构建基本信息
    return {
      id: hashMatch.id,
      title: hashMatch.title,
      url: hashMatch.url,
      parentId: hashMatch.parentId,
      index: hashMatch.index,
      children: hashMatch.isFolder ? [] : undefined,
    };
  }

  return undefined;
}

function normalizeTitle(title: string | undefined): string {
  return title?.trim() || "";
}

export function getBookmarkIdentityKeys(
  node: BookmarkNode,
  normalizedUrl = normalizeUrl(node.url),
): string[] {
  const keys = [`bookmark:${normalizedUrl}|${normalizeTitle(node.title)}`];

  if (node.hash) {
    keys.unshift(`hash:${node.hash}`);
  }

  return keys;
}

export function getFolderIdentityKey(node: BookmarkNode): string {
  return `folder:${normalizeTitle(node.title)}`;
}

