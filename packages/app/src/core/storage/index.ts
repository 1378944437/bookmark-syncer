/**
 * Storage 领域统一导出
 * 提供存储相关的所有功能
 */

// 类型定义
export type {
  WebDAVConfig,
  GistConfig,
  StorageConfig,
  WebDAVFile,
  CloudBackupFile,
  CloudInfo,
  CachedBackup,
  CachedBackupList,
  BackupFileMetadata,
} from "./types";

export { STORAGE_CONSTANTS, getStorageIdentifier } from "./types";

// 存储提供者契约
export type {
  IStorageProvider,
  StorageProviderType,
  RemoteFileInfo,
  ConnectionTestResult,
} from "./provider-interface";

// 缓存管理
export { CacheManager, cacheManager } from "./cache-manager";

// 队列管理
export { QueueManager, queueManager } from "./queue-manager";

// 文件管理
export { FileManager, fileManager } from "./file-manager";
