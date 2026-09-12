/**
 * 拉取策略
 * 智能下载：拉取云端数据并恢复到本地
 */
import { getWebDAVClient } from "../../../infrastructure/http/webdav-client";
import { CloudBackup, type BookmarkNode } from "../../../types";
import { getMissingFolderFallback, getThreeWayMergeEnabled, holdRestoringUntil, setIsRestoring } from "../../../application/state-manager";
import { snapshotManager } from "../../backup";
import {
  bookmarkRepository,
  computeTreeHash,
  detectThreeWayConflicts,
  countBookmarks,
  mergeThreeWay,
} from "../../bookmark";
import { loadSyncBaseline, saveSyncBaseline } from "../utils/sync-baseline";
import type { WebDAVConfig } from "../../storage";
import { fileManager } from "../../storage";
import { queueManager } from "../../storage/queue-manager";
import { acquireSyncLock, releaseSyncLock } from "../lock-manager";
import { setSyncState } from "../state-manager";
import type { SyncResult } from "../types";

/**
 * 智能下载：拉取云端数据并恢复到本地
 * @param config WebDAV 配置
 * @param lockHolder 锁持有者标识
 * @param mode 恢复模式：覆盖或合并
 * @param options.skipLock 是否跳过锁管理（由上层 smartSync 传递锁时使用）
 */
export async function smartPull(
  config: WebDAVConfig,
  lockHolder: string,
  mode: "overwrite" | "merge" = "overwrite",
  options?: { skipLock?: boolean },
): Promise<SyncResult> {
  const startTime = Date.now();
  const skipLock = options?.skipLock ?? false;
  console.log(`[PullStrategy] Starting pull by "${lockHolder}" (mode: ${mode})${skipLock ? ' (lock inherited)' : ''}`);

  // 检查网络
  if (!navigator.onLine) {
    console.warn("[PullStrategy] Pull aborted: offline");
    return { success: false, action: "error", message: "网络断开" };
  }

  // 获取锁（如果上层未传递锁）
  if (!skipLock) {
    const lockAcquired = await acquireSyncLock(lockHolder);
    if (!lockAcquired) {
      console.warn("[PullStrategy] Pull aborted: lock not acquired");
      return { success: false, action: "error", message: "同步正在进行中" };
    }
  }

  try {
    await setIsRestoring(true);

    const client = getWebDAVClient(config);

    // 0. 创建本地快照（下载前备份）
    console.log("[PullStrategy] Creating local snapshot before pull...");
    let currentTree: BookmarkNode[] = [];
    let currentCount = 0;
    try {
      currentTree = await bookmarkRepository.getTree();
      currentCount = countBookmarks(currentTree);
      await snapshotManager.createSnapshot(
        currentTree,
        currentCount,
        `下载前自动备份 (${lockHolder === "manual" ? "手动" : "自动"}, ${mode === "overwrite" ? "覆盖" : "合并"})`
      );
    } catch (error) {
      console.warn("[PullStrategy] Failed to create snapshot:", error);
      // 快照创建失败不影响同步
    }

    // 1. 下载云端最新备份数据
    console.log("[PullStrategy] Downloading from cloud...");
    const latest = await fileManager.getLatestBackupFile(client);
    if (!latest) {
      console.error("[PullStrategy] Pull aborted: no cloud backup found");
      return { success: false, action: "error", message: "云端无备份数据" };
    }
    
    const json = await queueManager.getFileWithDedup(client, latest.path);
    if (!json) {
      console.error("[PullStrategy] Pull aborted: failed to read backup file");
      return { success: false, action: "error", message: "无法读取云端备份" };
    }

    let cloudData: CloudBackup;
    try {
      cloudData = JSON.parse(json) as CloudBackup;
    } catch {
      console.error("[PullStrategy] Cloud data is corrupted, cannot parse");
      return { success: false, action: "error", message: "云端备份数据格式损坏" };
    }
    if (!cloudData.data || !Array.isArray(cloudData.data)) {
      console.error("[PullStrategy] Cloud data structure invalid: missing or non-array data");
      return { success: false, action: "error", message: "云端备份数据结构无效" };
    }
    const cloudCount = countBookmarks(cloudData.data);
    const cloudTime = cloudData.metadata?.timestamp || 0;
    
    // 从文件名解析浏览器信息
    const fileName = latest.path.split("/").pop() || "";
    const parsed = fileManager.parseBackupFileName(fileName);
    const cloudBrowser = parsed?.browser || "unknown";

    console.log(
      `[PullStrategy] Cloud: ${cloudCount} bookmarks from ${cloudBrowser} (${new Date(cloudTime).toISOString()})`,
    );

    // 三方合并第 1 步：只检测并记录冲突，行为与合并结果完全不变
    try {
      const baseline = await loadSyncBaseline(config.url);
      const report = detectThreeWayConflicts(baseline?.data ?? null, currentTree, cloudData.data);
      if (report.conflictCount > 0 || report.deleteVsChange > 0 || report.changeVsCloudDelete > 0) {
        console.warn(
          "[ThreeWay] Sync conflicts detected (current behavior: last push wins):",
          JSON.stringify(report),
        );
      } else {
        console.log(
          `[ThreeWay] No conflicts (cloudChanged=${report.cloudChanged}, localChanged=${report.localChanged}, localAdded=${report.localAdded}, cloudAdded=${report.cloudAdded})`,
        );
      }
    } catch (error) {
      console.warn("[ThreeWay] Conflict detection failed:", error);
    }

    // 防呆：覆盖拉取前，若云端书签数远少于本地（不足一半且本地非空），
    // 大概率是目录迁移未播种/云端异常，中止以保护本地书签。
    // 确认要以云端为准时，请使用「云端备份」中的恢复功能（无此保护）
    if (mode === "overwrite" && currentCount > 20 && cloudCount < currentCount / 2) {
      console.error(
        `[PullStrategy] Overwrite pull aborted: cloud (${cloudCount}) far below local (${currentCount})`,
      );
      return {
        success: false,
        action: "error",
        message: `云端仅 ${cloudCount} 条，本地有 ${currentCount} 条，已中止覆盖拉取以防误覆盖；如确认以云端为准，请在「云端备份」中使用恢复功能`,
      };
    }

    // 2. 恢复书签
    console.log(`[PullStrategy] Restoring bookmarks (${mode} mode)...`);
    const missingFolderFallback = await getMissingFolderFallback();
    let targetTree: BookmarkNode[] = cloudData.data;
    if (mode === "overwrite") {
      // 三树合并（实验）：以基线为参照自动取舍本地与云端的改动，结果交由既有恢复流程应用
      const threeWayEnabled = await getThreeWayMergeEnabled();
      if (threeWayEnabled) {
        const baseline = await loadSyncBaseline(config.url);
        if (baseline) {
          const merged = mergeThreeWay(baseline.data, currentTree, cloudData.data);
          targetTree = merged.tree;
          console.log(
            `[ThreeWay] merged: adoptedCloud=${merged.report.adoptedCloud}, keptLocal=${merged.report.keptLocal}, conflicts=${merged.report.conflicts}, deletedByCloud=${merged.report.deletedByCloud}`,
          );
          if (merged.report.conflicts > 0) {
            console.warn(
              "[ThreeWay] conflicts (dual-kept):",
              JSON.stringify(merged.report.samples),
            );
          }
        } else {
          console.log("[ThreeWay] enabled but no baseline yet, falling back to overwrite");
        }
      }
      await bookmarkRepository.restoreFromBackup(targetTree, { missingFolderFallback });
    } else {
      await bookmarkRepository.mergeFromBackup(cloudData, { missingFolderFallback });
    }

    // 3. 记录基线：本地树签名（脏检测用）+ 完整基线树（三方合并用）
    let localHash: string | undefined;
    try {
      const restoredTree = await bookmarkRepository.getTree();
      localHash = await computeTreeHash(restoredTree);
      await saveSyncBaseline(config.url, restoredTree);
    } catch (error) {
      console.warn("[PullStrategy] Failed to compute local baseline:", error);
    }

    // 4. 更新同步时间（基线 = 所拉取文件的服务器时间）
    await setSyncState({
      time: Date.now(),
      url: config.url,
      type: "download",
      basis: { mtime: latest.lastModified, filePath: latest.path },
      localHash,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[PullStrategy] Pull completed in ${elapsed}ms`);
    return { success: true, action: "downloaded", message: "同步完成" };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = (error as Error).message || "恢复失败";
    console.error(`[PullStrategy] Pull failed after ${elapsed}ms:`, error);
    return {
      success: false,
      action: "error",
      message: errorMessage,
    };
  } finally {
    await holdRestoringUntil();

    if (!skipLock) {
      await releaseSyncLock(lockHolder);
    }
  }
}
