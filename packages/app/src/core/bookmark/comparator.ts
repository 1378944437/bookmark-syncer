/**
 * 书签树比对工具
 * 用于检测本地和云端的差异
 */
import { generateHash } from "../../infrastructure/utils/crypto";
import type { BookmarkNode, CloudBackup } from "../../types";
import { assignHashes } from "./hash-calculator";
import { isSystemRootFolder } from "./normalizer";

/**
 * 提取签名（使用 hash，用于精确比对）
 * 格式：B|hash（书签）或 F|title|childCount（文件夹）
 */
export function extractSignaturesWithHash(nodes: BookmarkNode[]): string[] {
  const signatures: string[] = [];

  for (const node of nodes) {
    if (!isSystemRootFolder(node)) {
      if (node.url && node.hash) {
        // 书签：使用 hash 作为唯一标识
        signatures.push(`B|${node.hash}`);
      } else if (!node.url) {
        // 文件夹：使用标题和子节点数量
        signatures.push(`F|${node.title.trim()}|${node.children?.length ?? 0}`);
      }
    }

    if (node.children?.length) {
      signatures.push(...extractSignaturesWithHash(node.children));
    }
  }

  return signatures;
}

/**
 * 比对本地和云端是否一致
 *
 * 判定口径：书签多重集（URL+标题 的 hash）是否一致。
 * 有意忽略顺序与文件夹排布——不同浏览器的层级/排序本就不同，
 * 若按序比较，两端即使书签完全一样也永远无法判定"已同步"，
 * 导致互相覆盖式同步（ping-pong）。文件夹结构差异属于设备本地偏好，
 * 由覆盖拉取/推送按需搬运，不参与"是否需要同步"的判定
 */
export async function compareWithCloud(
  localTree: BookmarkNode[],
  cloudData: CloudBackup | BookmarkNode[],
): Promise<boolean> {
  const cloudTree = Array.isArray(cloudData) ? cloudData : cloudData.data;

  // 为了准确比对，先将本地树也转换为云端格式（精简字段 + 添加 hash）
  const normalizedLocalTree = await assignHashes(localTree);

  const localSigs = extractSignaturesWithHash(normalizedLocalTree);
  const cloudSigs = extractSignaturesWithHash(cloudTree);

  console.log(
    `[Comparator] Comparing signatures: local=${localSigs.length}, cloud=${cloudSigs.length}`,
  );

  // 只取书签签名（B|hash），组成多重集比较；文件夹签名（F|...）不参与
  const toMultiset = (sigs: string[]): Map<string, number> => {
    const multiset = new Map<string, number>();
    for (const sig of sigs) {
      if (sig.startsWith("B|")) {
        multiset.set(sig, (multiset.get(sig) ?? 0) + 1);
      }
    }
    return multiset;
  };

  const localMultiset = toMultiset(localSigs);
  const cloudMultiset = toMultiset(cloudSigs);

  if (localMultiset.size !== cloudMultiset.size) {
    console.log(
      `[Comparator] Bookmark multiset size differs: local=${localMultiset.size}, cloud=${cloudMultiset.size}`,
    );
    return false;
  }

  for (const [sig, count] of localMultiset) {
    if (cloudMultiset.get(sig) !== count) {
      console.log(`[Comparator] Bookmark differs: ${sig} (local x${count})`);
      return false;
    }
  }

  console.log("[Comparator] Bookmark multisets match");
  return true;
}

/**
 * 计算书签树的整体签名哈希（用于检测本地是否有未同步的修改）
 * 口径与 compareWithCloud 一致：只看书签多重集（排序后哈希），
 * 顺序、文件夹排布、空文件夹的变化不改变哈希——
 * 重排不是「修改」，不应触发冲突判定
 */
export async function computeTreeHash(nodes: BookmarkNode[]): Promise<string> {
  const withHash = await assignHashes(nodes);
  const signatures = extractSignaturesWithHash(withHash)
    .filter((sig) => sig.startsWith("B|"))
    .sort();
  return generateHash(signatures.join("\n"), "tree-signature");
}

/**
 * 统计书签数量
 */
export function countBookmarks(nodes: BookmarkNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.url) count++;
    if (node.children && node.children.length > 0) {
      count += countBookmarks(node.children);
    }
  }
  return count;
}
