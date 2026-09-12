/**
 * Sync 领域类型定义
 */

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  action: "uploaded" | "downloaded" | "skipped" | "error";
  message: string;
}

/**
 * 同步基线（服务器时间基准）
 * 方向判断只使用服务器记录的文件时间，设备本地时钟不参与比较
 */
export interface SyncBasis {
  /** 云端文件的服务器最后修改时间 */
  mtime: number;

  /** 云端文件路径（同一秒内文件被替换时以路径变化补充判断） */
  filePath: string;
}

/**
 * 同步状态
 */
export interface SyncState {
  /** 同步时间戳 */
  time: number;
  
  /** 同步的 URL */
  url: string;
  
  /** 同步类型 */
  type: "upload" | "download" | "skip_identical" | "restore";

  /**
   * 同步基线：最后一次同步所对应云端文件的服务器时间与路径。
   * 旧版本状态无此字段，比较时退化为旧逻辑（见 sync-basis.ts）
   */
  basis?: SyncBasis;

  /**
   * 本地树签名基线：最后一次同步完成时的本地树整体哈希。
   * 拉取前用它判断本地是否存在未同步的修改；
   * 旧版本状态无此字段，视为“本地可能有修改”，走不丢数据的安全分支
   */
  localHash?: string;
}

/**
 * 智能同步结果
 */
export interface SmartSyncResult extends SyncResult {
  /** 是否需要冲突解决 */
  needsConflictResolution?: boolean;
  
  /** 云端信息 */
  cloudInfo?: import("../storage/types").CloudInfo;
}

/**
 * 同步锁
 */
export interface SyncLock {
  /** 锁持有者 */
  holder: string;
  
  /** 获取锁的时间戳 */
  timestamp: number;
  
  /** 锁 ID（用于验证锁的有效性，防止 race condition） */
  lockId: string;
}

/**
 * 常量
 */
export const SYNC_LOCK_KEY = "sync_lock";
/** 锁超时：大书签集 + 慢 WebDAV 时单次同步可能超过 1 分钟，
 * 60 秒会让下一次同步强抢锁并发执行，提到 5 分钟 */
export const LOCK_TIMEOUT_MS = 300000; // 5 分钟超时自动释放
