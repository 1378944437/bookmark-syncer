/**
 * 基础合并：只添加不存在的节点（保守策略，无删除语义）
 * 自 merger.ts 拆出；供 mergeFromBackup 与缺失文件夹兜底使用
 */
import { BrowserBookmarksAPI } from "../../infrastructure/browser/api";
import type { BookmarkNode } from "../../types";
import { normalizeUrl } from "./normalizer";

/**
 * 递归创建子节点
 */
export async function createChildren(
  parentId: string,
  children: BookmarkNode[],
): Promise<void> {
  for (const child of children) {
    if (child.url) {
      // 创建书签
      try {
        await BrowserBookmarksAPI.create({
          parentId,
          title: child.title,
          url: child.url,
        });
      } catch (error) {
        console.warn(
          `[Merger] Failed to create bookmark "${child.title}":`,
          error
        );
      }
    } else if (child.children) {
      // 创建文件夹并递归
      try {
        const newFolder = await BrowserBookmarksAPI.create({
          parentId,
          title: child.title,
        });
        if (newFolder.id && child.children.length > 0) {
          await createChildren(newFolder.id, child.children);
        }
      } catch (error) {
        console.warn(
          `[Merger] Failed to create folder "${child.title}":`,
          error
        );
      }
    }
  }
}

/**
 * 执行智能同步（三阶段）
 * @param localParentId 本地系统文件夹 ID
 * @param cloudNodes 云端该文件夹下的节点
 * @param localIndex 本地全局索引
 * @param localParentPath 本地父路径
 */
/**
 * 跨多次 smartSync 调用共享的同步状态
 * 解决“先删后配”竞态：删除阶段必须等所有顶层文件夹处理完后统一执行，
 * 否则云端跨系统文件夹移动书签时（bar→other），先处理的文件夹会删掉本地节点，
 * 后续文件夹找不到节点而丢数据；共享 processed 集合也让跨文件夹的重复书签
 * 命中“已处理”时降级为创建副本，而非互抢同一物理节点。
 */
/**
 * 合并节点（只添加新的）
 * 用于保守的合并策略
 */
export async function mergeNodes(parentId: string, nodes: BookmarkNode[]): Promise<void> {
  const localChildren = [...((await BrowserBookmarksAPI.getChildren(parentId)) as BookmarkNode[])];
  let addedCount = 0;

  for (const node of nodes) {
    if (node.url) {
      const normalizedNodeUrl = normalizeUrl(node.url);
      const exists = localChildren.some((local) => normalizeUrl(local.url) === normalizedNodeUrl);
      if (!exists) {
        try {
          const createdBookmark = await BrowserBookmarksAPI.create({
            parentId,
            title: node.title,
            url: node.url,
            index: node.index,
          });
          localChildren.push(createdBookmark as BookmarkNode);
          addedCount++;
        } catch (error) {
          console.warn(
            `[Merger] Failed to create bookmark during merge: ${node.title}`,
            error,
          );
        }
      }
    } else {
      const existingFolder = localChildren.find(
        (local) => !local.url && local.title === node.title,
      );

      if (existingFolder?.id) {
        if (node.children && node.children.length > 0) {
          await mergeNodes(existingFolder.id, node.children);
        }
      } else {
        try {
          const newFolder = await BrowserBookmarksAPI.create({
            parentId,
            title: node.title,
            index: node.index,
          });
          localChildren.push({ ...(newFolder as BookmarkNode), children: [] });
          addedCount++;

          if (node.children && node.children.length > 0) {
            await mergeNodes(newFolder.id, node.children);
          }
        } catch (error) {
          console.warn(
            `[Merger] Failed to create folder during merge: ${node.title}`,
            error,
          );
        }
      }
    }
  }

  if (addedCount > 0) {
    console.log(`[Merger] Merged ${addedCount} new items`);
  }
}
