/**
 * 拉取策略
 * 智能下载：拉取云端数据并恢复到本地
 */
import { getWebDAVClient } from "../../../infrastructure/http/webdav-client";
import type { BookmarkNode } from "../../../types";
import { getE2ESettings, getMissingFolderFallback, getSyncScope, holdRestoringUntil, setIsRestoring } from "../sync-settings";
import { snapshotManager } from "../../backup";
import {
  bookmarkRepository,
  computeTreeHash,
  countBookmarks,
  filterTreeByScope,
} from "../../bookmark";
import { fetchValidatedCloudBackup } from "../utils/cloud-data-helper";
import type { WebDAVConfig } from "../../storage";
import { fileManager } from "../../storage";
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
    // 同步范围（每台设备独立）：范围外系统文件夹不参与本次拉取
    const syncScope = await getSyncScope();

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
    
    // 下载 →（端到端解密）→ 解压 → 解析 → 结构校验，统一由 helper 处理；
    // .enc 备份需要本机密码解密，未开启时队列层会抛出开启提示
    const e2e = await getE2ESettings();
    const cloudData = await fetchValidatedCloudBackup(client, latest.path, {
      passphrase: e2e.enabled ? e2e.passphrase : undefined,
    });
    if (!cloudData) {
      console.error("[PullStrategy] Pull aborted: failed to read backup file");
      return { success: false, action: "error", message: "无法读取云端备份" };
    }
    // 应用同步范围：范围外系统文件夹不参与恢复
    cloudData.data = filterTreeByScope(cloudData.data, syncScope);
    const cloudCount = countBookmarks(cloudData.data);
    const cloudTime = cloudData.metadata?.timestamp || 0;
    
    // 从文件名解析浏览器信息
    const fileName = latest.path.split("/").pop() || "";
    const parsed = fileManager.parseBackupFileName(fileName);
    const cloudBrowser = parsed?.browser || "unknown";

    console.log(
      `[PullStrategy] Cloud: ${cloudCount} bookmarks from ${cloudBrowser} (${new Date(cloudTime).toISOString()})`,
    );

    // 三方合并相关内容已移除：覆盖拉取直接应用云端（按同步范围过滤）数据
    const scopedLocalCount = countBookmarks(filterTreeByScope(currentTree, syncScope));
    if (mode === "overwrite" && scopedLocalCount > 20 && cloudCount < scopedLocalCount / 2) {
      console.error(
        `[PullStrategy] Overwrite pull aborted: cloud (${cloudCount}) far below local (${scopedLocalCount})`,
      );
      return {
        success: false,
        action: "error",
        message: `云端仅 ${cloudCount} 条，本地有 ${scopedLocalCount} 条，已中止覆盖拉取以防误覆盖；如确认以云端为准，请在「云端备份」中使用恢复功能`,
      };
    }

    // 2. 恢复书签
    console.log(`[PullStrategy] Restoring bookmarks (${mode} mode)...`);
    const missingFolderFallback = (await getMissingFolderFallback()) && syncScope.other;
    if (mode === "overwrite") {
      await bookmarkRepository.restoreFromBackup(cloudData, { missingFolderFallback });
    } else {
      await bookmarkRepository.mergeFromBackup(cloudData, { missingFolderFallback });
    }

    // 3. 记录本地树签名（按同步范围过滤，供脏检测使用）
    let localHash: string | undefined;
    try {
      const restoredTree = filterTreeByScope(await bookmarkRepository.getTree(), syncScope);
      localHash = await computeTreeHash(restoredTree);
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
