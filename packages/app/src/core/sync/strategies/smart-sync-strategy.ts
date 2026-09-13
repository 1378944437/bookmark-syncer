/**
 * 智能同步策略
 * 自动判断推送或拉取
 */
import { acquireSyncLock, releaseSyncLock } from "../lock-manager";
import { getLastSyncTime, getSyncState, setSyncState } from "../state-manager";
import { getWebDAVClient } from "../../../infrastructure/http/webdav-client";
import { CloudBackup } from "../../../types";
import { getE2ESettings, getSyncScope } from "../../../application/state-manager";
import { E2EDecryptError, E2EPasswordRequiredError } from "../../../infrastructure/utils/crypto";
import { bookmarkRepository, compareWithCloud, computeTreeHash, countBookmarks, filterTreeByScope } from "../../bookmark";
import { fileManager } from "../../storage";
import { queueManager } from "../../storage/queue-manager";
import type { CloudInfo, WebDAVConfig } from "../../storage/types";
import type { SmartSyncResult } from "../types";
import { CloudDataError } from "../types";
import { isCloudNewerThanBasis, isLocalDirty } from "../utils/sync-basis";
import { smartPull } from "./pull-strategy";
import { smartPush } from "./push-strategy";

/**
 * 智能同步：自动判断推送或拉取
 */
export async function smartSync(
  config: WebDAVConfig,
  lockHolder: string,
): Promise<SmartSyncResult> {
  const startTime = Date.now();
  console.log(`[SmartSyncStrategy] Starting smart sync by "${lockHolder}"`);

  // 检查网络
  if (!navigator.onLine) {
    console.warn("[SmartSyncStrategy] Smart sync aborted: offline");
    return { success: false, action: "error", message: "网络断开" };
  }

  // 获取锁
  const lockAcquired = await acquireSyncLock(lockHolder);
  if (!lockAcquired) {
    console.warn("[SmartSyncStrategy] Smart sync aborted: lock not acquired");
    return { success: false, action: "error", message: "同步正在进行中" };
  }

  try {
    const client = getWebDAVClient(config);

    // 1. 获取本地书签
    console.log("[SmartSyncStrategy] Getting local bookmarks...");
    const localTree = await bookmarkRepository.getTree();
    const localCount = countBookmarks(localTree);
    console.log(`[SmartSyncStrategy] Local: ${localCount} bookmarks`);

    // 2. 获取云端最新备份数据
    console.log("[SmartSyncStrategy] Getting cloud data...");
    let cloudData: CloudBackup | null = null;
    let cloudInfo: CloudInfo = { exists: false };
    let latest: { path: string; lastModified: number } | null = null;

    try {
      latest = await fileManager.getLatestBackupFile(client);
      if (latest) {
        // .enc 备份需本机密码解密；未开启时队列层抛出开启提示
        const e2e = await getE2ESettings();
        const json = await queueManager.getFileWithDedup(client, latest.path, {
          passphrase: e2e.enabled ? e2e.passphrase : undefined,
        });
        if (json) {
          try {
            cloudData = JSON.parse(json) as CloudBackup;
          } catch {
            console.error("[SmartSyncStrategy] Cloud data is corrupted");
            throw new CloudDataError("云端备份数据格式损坏，无法解析");
          }
          if (!cloudData.data || !Array.isArray(cloudData.data)) {
            console.error("[SmartSyncStrategy] Cloud data structure invalid");
            throw new CloudDataError("云端备份数据结构无效");
          }
          
          // 从文件名解析浏览器信息
          const fileName = latest.path.split("/").pop() || "";
          const parsed = fileManager.parseBackupFileName(fileName);
          
          cloudInfo = {
            exists: true,
            timestamp: latest.lastModified,
            totalCount: parsed?.count || countBookmarks(cloudData.data),
            browser: parsed?.browser,
            browserVersion: undefined,
          };
          console.log(
            `[SmartSyncStrategy] Cloud: ${cloudInfo.totalCount} bookmarks from ${cloudInfo.browser || "unknown"}`,
          );
        }
      }
    } catch (error) {
      // 端到端加密的提示/解密错误不能当作「云端无备份」处理：
      // 否则会走 Case A 用本机明文覆盖云端加密现场
      if (
        error instanceof E2EPasswordRequiredError ||
        error instanceof E2EDecryptError
      ) {
        throw error;
      }
      console.warn("[SmartSyncStrategy] No cloud data found:", error);
    }

    // Case A: 云端无数据 → 直接上传
    if (!cloudData || !latest) {
      console.log("[SmartSyncStrategy] No cloud backup, uploading...");
      // 传递锁给 smartPush，避免释放后重新获取的竞态窗口
      return await smartPush(config, lockHolder, { skipLock: true });
    }

    // 3. 比对内容（双方均按同步范围过滤后再比较）
    console.log("[SmartSyncStrategy] Comparing local and cloud...");
    const syncScope = await getSyncScope();
    const isIdentical = await compareWithCloud(
      filterTreeByScope(localTree, syncScope),
      filterTreeByScope(cloudData.data, syncScope),
    );

    if (isIdentical) {
      console.log("[SmartSyncStrategy] Content identical, no sync needed");
      await setSyncState({
        time: Date.now(),
        url: config.url,
        type: "skip_identical",
        basis: { mtime: latest.lastModified, filePath: latest.path },
      });
      return {
        success: true,
        action: "skipped",
        message: "书签已同步，无需操作",
        cloudInfo,
      };
    }

    // 4. 检查是否需要用户选择
    const lastSyncTime = await getLastSyncTime(config.url);
    const syncState = await getSyncState(config.url);

    console.log(
      `[SmartSyncStrategy] Sync times - Last: ${new Date(lastSyncTime).toISOString()}, Cloud(server): ${new Date(latest.lastModified).toISOString()}`,
    );

    // 首次同步或环境变更，且云端有数据 → 需要用户选择
    if (
      lastSyncTime === 0 &&
      cloudInfo.totalCount &&
      cloudInfo.totalCount > 0
    ) {
      console.log("[SmartSyncStrategy] First sync detected, need user choice");
      return {
        success: false,
        action: "skipped",
        message: "需要选择同步方向",
        needsConflictResolution: true,
        cloudInfo,
      };
    }

    // 5. 智能判断（传递锁给子策略，避免释放后重新获取的竞态窗口）
    // 时间基准：服务器记录的文件时间，与设备本地时钟无关
    if (isCloudNewerThanBasis(latest, syncState, config.url)) {
      // 云端比本地新 → 拉取。但先判断本地是否有未同步的修改：
      // 有 → 绝不静默覆盖（否则本地未上传的新增/修改会被删掉），交给用户选择方向
      const currentTreeHash = await computeTreeHash(filterTreeByScope(localTree, syncScope));
      if (isLocalDirty(syncState, currentTreeHash)) {
        console.warn(
          "[SmartSyncStrategy] Cloud is newer AND local has unsynced changes, asking user",
        );
        return {
          success: false,
          action: "skipped",
          message: "本地有未同步的修改，需要选择同步方向",
          needsConflictResolution: true,
          cloudInfo,
        };
      }

      // 本地干净 → 覆盖拉取（保留删除传播能力）
      console.log("[SmartSyncStrategy] Cloud is newer, pulling...");
      const result = await smartPull(config, lockHolder, "overwrite", { skipLock: true });
      const elapsed = Date.now() - startTime;
      console.log(`[SmartSyncStrategy] Smart sync completed (pull) in ${elapsed}ms`);
      return { ...result, cloudInfo };
    } else {
      // 本地可能更新 → 上传
      console.log("[SmartSyncStrategy] Local might be newer, pushing...");
      const result = await smartPush(config, lockHolder, { skipLock: true });
      const elapsed = Date.now() - startTime;
      console.log(`[SmartSyncStrategy] Smart sync completed (push) in ${elapsed}ms`);
      return { ...result, cloudInfo };
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = (error as Error).message || "同步失败";
    console.error(`[SmartSyncStrategy] Smart sync failed after ${elapsed}ms:`, error);
    return {
      success: false,
      action: "error",
      message: errorMessage,
    };
  } finally {
    // 确保锁被释放（如果还持有的话）
    await releaseSyncLock(lockHolder);
  }
}
