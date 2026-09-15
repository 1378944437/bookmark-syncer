import type { GistResponse } from './gist-client';
export const INDEX_FILE = 'marksync-index.json';
export const isBackupName = (name: string) => /^bookmarks_[^/]+\.json\.gz(?:\.enc)?$/.test(name);
export interface GistIndex {
  version: 1;
  revision: string;
  current: string | null;
  entries: { name: string; order: number; timestamp: number; legacy?: boolean }[];
}

export function readIndex(gist: GistResponse): GistIndex | null {
  if (gist.truncated) throw new Error('Gist 文件列表被截断，已停止写入');
  if (!gist.files || typeof gist.files !== 'object') throw new Error('Gist 文件列表无效');
  const file = gist.files[INDEX_FILE];
  if (!file) return null;
  if (file.truncated || !file.content) throw new Error('Gist 版本索引不完整');
  let index: GistIndex;
  try { index = JSON.parse(file.content); } catch { throw new Error('Gist 版本索引损坏'); }
  if (index?.version !== 1 || typeof index.revision !== 'string' || !Array.isArray(index.entries) ||
      !(index.current === null || typeof index.current === 'string')) throw new Error('不支持的 Gist 版本索引');
  const names = new Set<string>(); const orders = new Set<number>();
  for (const entry of index.entries) {
    if (!entry || !isBackupName(entry.name) || names.has(entry.name) || !gist.files[entry.name] ||
        !Number.isSafeInteger(entry.order) || entry.order < 1 || orders.has(entry.order) || !Number.isFinite(entry.timestamp)) throw new Error('Gist 版本索引条目无效');
    names.add(entry.name); orders.add(entry.order);
  }
  if (index.current !== null && !names.has(index.current)) throw new Error('Gist 当前版本缺失');
  // 未索引文件可能来自并发提交或旧客户端，禁止猜测顺序后继续覆盖。
  if (Object.keys(gist.files).some(name => isBackupName(name) && !names.has(name))) throw new Error('Gist 存在未索引备份，请先核对历史版本');
  return index;
}
