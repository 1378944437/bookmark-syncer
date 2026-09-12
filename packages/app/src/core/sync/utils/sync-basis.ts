/**
 * 同步方向判断的统一时间基准
 *
 * 全部比较只使用服务器记录的文件时间（mtime）：
 * metadata.timestamp 是推送方客户机的时钟，跨设备时钟有偏差时会把
 * "对方刚推过"误判成"云端有未拉取的更新"，反过来阻断自动上传；
 * 服务器 mtime 对所有设备是同一块钟，没有这个问题。
 */
import type { SyncBasis, SyncState } from "../types";

/** 云端最新备份的引用（与 FileManager.getLatestBackupFile 的返回结构兼容） */
export interface LatestBackupRef {
  path: string;
  lastModified: number;
}

/**
 * 判断云端最新备份是否比本地已同步基线更新
 *
 * - 无基线（从未在此 URL 同步过）→ 云端有数据即视为更新
 * - 旧版本状态（无 basis，升级迁移）→ 退化为旧比较：
 *   服务器 mtime vs 本地记录时间（行为与历史版本一致）
 * - 有基线 → 纯服务器时间比较；mtime 相同但文件路径不同（同一秒被替换）也视为更新
 */
export function isCloudNewerThanBasis(
  latest: LatestBackupRef | null,
  state: SyncState | null,
  url: string,
): boolean {
  if (!latest) return false;
  if (!state || state.url !== url) return true;
  if (!state.basis) return latest.lastModified > state.time;

  const basis: SyncBasis = state.basis;
  return (
    latest.lastModified > basis.mtime ||
    (latest.lastModified === basis.mtime && latest.path !== basis.filePath)
  );
}
