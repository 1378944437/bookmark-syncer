import type { BookmarkNode } from '../../types';

/** 云端和本地快照都是不可信输入；先校验整棵树，再允许任何浏览器写入。 */
export function validateBookmarkTree(value: unknown): asserts value is BookmarkNode[] {
  if (!Array.isArray(value)) throw new Error('备份数据必须是书签树');
  const pending: { node: unknown; depth: number }[] = value.map(node => ({ node, depth: 0 }));
  const seen = new Set<object>();
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 100 || seen.has(node)) {
      throw new Error('备份节点无效或层级过深');
    }
    seen.add(node);
    if (seen.size > 100_000) throw new Error('备份节点超过 100000 个');
    const n = node as Record<string, unknown>;
    if (typeof n.title !== 'string' ||
        (n.id !== undefined && typeof n.id !== 'string') ||
        (n.folderType !== undefined && typeof n.folderType !== 'string')) throw new Error('备份节点字段无效');
    if (n.url !== undefined) {
      if (typeof n.url !== 'string' || !n.url.trim() || n.children !== undefined) throw new Error('备份书签无效');
      try { new URL(n.url); } catch { throw new Error('备份书签 URL 无效'); }
    } else {
      if (!Array.isArray(n.children)) throw new Error('备份文件夹缺少子节点数组');
      for (const child of n.children) pending.push({ node: child, depth: depth + 1 });
    }
  }
}

export function validateRestoreTree(value: unknown): asserts value is BookmarkNode[] {
  validateBookmarkTree(value);
  if (!value.length) throw new Error("备份数据为空");
  if (value.length !== 1 || !Array.isArray(value[0].children) || value[0].url !== undefined ||
      value[0].children.some(folder => folder.url !== undefined || !Array.isArray(folder.children))) {
    throw new Error('备份根结构无效：需要根容器及系统文件夹');
  }
}
