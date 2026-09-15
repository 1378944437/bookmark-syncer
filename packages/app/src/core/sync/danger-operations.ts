/**
 * 危险操作领域服务
 * 包含清空本地书签、清空云端备份与恢复出厂设置等高风险操作
 * 关键操作前均自动触发本地安全快照备份以防数据意外损毁
 */
import browser from "webextension-polyfill";
import { BrowserBookmarksAPI } from "../../infrastructure/browser/api";
import { createStorageProvider } from "../../infrastructure/storage/provider-factory";
import { snapshotManager } from "../backup";
import { countBookmarks } from "../bookmark";
import { cacheManager } from "../storage/cache-manager";
import { STORAGE_CONSTANTS } from "../storage/types";
import { clearLastBackupFileInfo } from "./sync-settings";
import type { StorageConfig } from "../storage/types";
import { beginRecovery, finishRecovery } from './recovery';
import { fileManager } from '../storage/file-manager';

/**
 * 清空所有本地书签（保留系统根目录，如书签栏、其他书签等）
 * 操作前强制自动创建本地快照，确保随时可撤销回滚
 */
export async function clearLocalBookmarks(): Promise<{ deletedCount: number; snapshotId: number }> {
  const tree = await BrowserBookmarksAPI.getTree();
  const totalCount = countBookmarks(tree);

  // 1. 自动快照备份机制（遵循安全与应急回滚规范）
  const snapshotId = await snapshotManager.createSnapshot(
    tree,
    totalCount,
    "清空本地书签前自动备份"
  );
  console.warn(`[DangerOperations] Created backup snapshot #${snapshotId} before wiping local bookmarks`);
  await beginRecovery(snapshotId, 'clear-local');

  let deletedCount = 0;
  // 获取顶层根节点（通常只有1个顶级根）
  for (const root of tree) {
    if (root.children && root.children.length > 0) {
      // 遍历系统文件夹（如书签栏、其他书签、移动书签）
      for (const systemFolder of root.children) {
        if (systemFolder.children && systemFolder.children.length > 0) {
          for (const item of systemFolder.children) {
            try {
              if (item.url) {
                await BrowserBookmarksAPI.remove(item.id);
              } else {
                await BrowserBookmarksAPI.removeTree(item.id);
              }
              deletedCount++;
            } catch (err) {
              console.warn(`[DangerOperations] Failed to remove item ${item.id}:`, err);
              throw err;
            }
          }
        }
      }
    }
  }

  console.warn(`[DangerOperations] Wiped local bookmarks. Total items deleted: ${deletedCount}`);
  await finishRecovery();
  return { deletedCount, snapshotId };
}

/**
 * 清空云端存储上的所有历史备份文件
 * 删除整个备份目录下的所有文件并重置缓存
 */
export async function clearCloudBackups(config: StorageConfig): Promise<{ deletedCount: number }> {
  const client = createStorageProvider(config);
  const dir = STORAGE_CONSTANTS.BACKUP_DIR;

  let deletedCount = 0;
  try {
    if (client.exists && !(await client.exists(dir))) {
      return { deletedCount: 0 };
    }

    const files = await client.listFiles(dir);
    if (client.clearBackups) {
      deletedCount = await client.clearBackups();
      await cacheManager.clearBackupListCache();
      await clearLastBackupFileInfo();
      return { deletedCount };
    }
    for (const file of files) {
      // 仅清理备份文件，防止误伤其他文件
      if (fileManager.isBackupFile(file.name)) {
        try {
          if (client.deleteFile) {
            await client.deleteFile(file.path);
            deletedCount++;
          }
        } catch (err) {
          console.warn(`[DangerOperations] Failed to delete cloud file ${file.path}:`, err);
          throw err;
        }
      }
    }

    // 清空本地缓存与上次备份信息
    cacheManager.clearBackupListCache();
    await clearLastBackupFileInfo();
    console.warn(`[DangerOperations] Deleted ${deletedCount} cloud backup files`);
  } catch (error) {
    console.error("[DangerOperations] Failed to clear cloud backups:", error);
    throw error;
  }

  return { deletedCount };
}

/**
 * 恢复出厂设置
 * 清空所有本地快照、清空所有持久化配置与缓存
 */
export async function resetFactorySettings(): Promise<void> {
  console.warn("[DangerOperations] Initiating factory reset...");
  try {
    // 1. 清空所有 IndexedDB 本地快照
    await browser.storage.local.set({ auto_sync_enabled: false, scheduled_sync_enabled: false });
    await snapshotManager.deleteAllSnapshots();

    // 2. 清空 storage.local
    await browser.storage.local.clear();

    // 3. 清空 storage.session（如果环境支持）
    if (browser.storage.session) {
      await browser.storage.session.clear();
    }

    // 4. 重置内存缓存
    cacheManager.clearBackupListCache();

    console.warn("[DangerOperations] Factory reset completed successfully");
  } catch (error) {
    console.error("[DangerOperations] Factory reset failed:", error);
    throw error;
  }
}
