/**
 * 推送策略
 * 智能上传：检查内容差异，只有真正有变化时才上传
 */
import { getBackupFileInterval, getDeviceIdentity, getE2ESettings, getLastBackupFileInfo, getMaxCloudBackups, getSyncScope, saveLastBackupFileInfo } from "../sync-settings";
import { getBrowserInfo } from "../../../infrastructure/browser/info";
import { createStorageProvider } from "../../../infrastructure/storage/provider-factory";
import { compressText } from "../../../infrastructure/utils/compression";
import { encryptText } from "../../../infrastructure/utils/crypto";
import { snapshotManager } from "../../backup";
import { bookmarkRepository, computeTreeHash, countBookmarks, filterTreeByScope } from "../../bookmark";
import { checkCloudStateBeforeUpload } from "../utils/upload-precheck";
import { clearPendingSafetyConfirmation } from "../utils/safety-guard";
import { getStorageIdentifier, type StorageConfig } from "../../storage/types";
import { fileManager, STORAGE_CONSTANTS } from "../../storage";
import { cacheManager } from "../../storage/cache-manager";
import { acquireSyncLock, releaseSyncLock } from "../lock-manager";
import { setSyncState } from "../state-manager";
import { type SyncBasis } from "../types";
import type { SyncResult } from "../types";

const DIR = STORAGE_CONSTANTS.BACKUP_DIR;

/**
 * 智能上传：检查内容差异，只有真正有变化时才上传
 * @param config 存储配置
 * @param lockHolder 锁持有者标识
 * @param options.skipLock 是否跳过锁管理（由上层 smartSync 传递锁时使用）
 * @param options.skipSafetyGuard 是否跳过防误删熔断保护（二次确认时使用）
 */
export async function smartPush(
  config: StorageConfig,
  lockHolder: string,
  options?: { skipLock?: boolean; skipSafetyGuard?: boolean },
): Promise<SyncResult> {
  const startTime = Date.now();
  const skipLock = options?.skipLock ?? false;
  console.log(`[PushStrategy] Starting push by "${lockHolder}"${skipLock ? ' (lock inherited)' : ''}`);

  // 检查网络
  if (!navigator.onLine) {
    console.warn("[PushStrategy] Push aborted: offline");
    return { success: false, action: "error", message: "网络断开" };
  }

  // 获取锁（如果上层未传递锁）
  if (!skipLock) {
    const lockAcquired = await acquireSyncLock(lockHolder);
    if (!lockAcquired) {
      console.warn("[PushStrategy] Push aborted: lock not acquired");
      return { success: false, action: "error", message: "同步正在进行中" };
    }
  }

  try {
    const client = createStorageProvider(config);
    // 端到端加密设置：预检解密与上传加密共用
    const e2e = await getE2ESettings();

    // 1. 获取本地书签
    console.log("[PushStrategy] Getting local bookmarks...");
    const localTree = await bookmarkRepository.getTree();
    // 同步范围（每台设备独立）：范围外系统文件夹不参与本次上传与比较
    const syncScope = await getSyncScope();
    const scopedLocalTree = filterTreeByScope(localTree, syncScope);
    const localCount = countBookmarks(localTree);
    console.log(`[PushStrategy] Local: ${localCount} bookmarks`);

    // 安全检查：书签为空时不同步
    if (localCount === 0) {
      console.error("[PushStrategy] Push aborted: local bookmarks empty");
      return { success: false, action: "error", message: "本地书签为空" };
    }

    // 1.5. 创建本地快照（上传前备份）
    console.log("[PushStrategy] Creating local snapshot before push...");
    try {
      await snapshotManager.createSnapshot(
        localTree,
        localCount,
        `上传前 (${lockHolder === "manual" ? "手动" : "自动"} 备份)`
      );
    } catch (error) {
      console.warn("[PushStrategy] Failed to create snapshot:", error);
      // 快照创建失败不影响同步
    }

    // 2. 上传前云端状态预检（云端更新判断、内容比对、加密提示；见 utils/upload-precheck）
    const check = await checkCloudStateBeforeUpload({
      client,
      configUrl: getStorageIdentifier(config),
      lockHolder,
      scopedLocalTree,
      e2e,
      syncScope,
      skipSafetyGuard: options?.skipSafetyGuard,
    });
    if (check.kind === "abort") return check.result;
    if (check.kind === "skip") return check.result;

    // 3. 执行上传 - 判断是否需要创建新文件
    console.log("[PushStrategy] Uploading to cloud...");
    const identity = await getDeviceIdentity();
    const browserInfo = getBrowserInfo();
    const deviceTag = identity.deviceId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
    const backup = await bookmarkRepository.createCloudBackup({
      deviceId: identity.deviceId,
      deviceName: identity.deviceName || browserInfo.name,
    });
    // 应用同步范围：范围外系统文件夹不上传
    backup.data = filterTreeByScope(backup.data, syncScope);

    // 验证 backup 数据完整性
    if (!backup || !backup.data || !backup.metadata) {
      console.error("[PushStrategy] Invalid backup data: missing data or metadata");
      return { success: false, action: "error", message: "生成的备份数据无效" };
    }
    if (!Array.isArray(backup.data) || backup.data.length === 0) {
      console.error("[PushStrategy] Invalid backup data: empty bookmark tree");
      return { success: false, action: "error", message: "书签数据为空，无法上传" };
    }

    // 确保目录存在
    if (client.exists && !(await client.exists(DIR))) {
      console.log(`[PushStrategy] Creating directory: ${DIR}`);
      if (client.createDirectory) await client.createDirectory(DIR);
    }

    // 获取配置的时间间隔（分钟）
    const backupIntervalMinutes = await getBackupFileInterval();
    const backupIntervalMs = backupIntervalMinutes * 60 * 1000;

    // 获取最后备份文件信息
    const lastBackupInfo = await getLastBackupFileInfo();
    const now = Date.now();

    let targetFilePath: string;
    let targetFileName: string;
    let revisionNumber = 1;
    let isNewFile = true;

    // 获取当前书签数量（浏览器信息已在上方获取）
    const bookmarkCount = countBookmarks(backup.data);
    
    // 记录需要在上传后清理的旧文件路径
    let oldFileToDelete: string | null = null;

    // 判断是否在时间窗口内
    if (lastBackupInfo && (now - lastBackupInfo.createdAt) < backupIntervalMs) {
      // 时间窗口内：创建新文件替换旧文件（先传后删，保证原子性）
      console.log(`[PushStrategy] Within time window (${backupIntervalMinutes}min), replacing: ${lastBackupInfo.fileName}`);
      
      // 生成新文件名（书签数量会更新，并携带设备自定义备注标识）
      targetFileName = fileManager.generateBackupFileName(
        browserInfo.name,
        bookmarkCount,
        lastBackupInfo.revisionNumber + 1, // 保持修订号递增
        deviceTag,
        identity.deviceName
      );
      targetFilePath = `${DIR}/${targetFileName}`;
      revisionNumber = lastBackupInfo.revisionNumber + 1;
      isNewFile = false;  // 逻辑上还是覆盖（不触发清理旧文件）
      oldFileToDelete = lastBackupInfo.filePath; // 上传成功后再删除旧文件
    } else {
      // 时间窗口外：创建新文件
      console.log("[PushStrategy] Time window expired, creating new backup file");
      targetFileName = fileManager.generateBackupFileName(
        browserInfo.name,
        bookmarkCount,
        1, // 初始修订号
        deviceTag,
        identity.deviceName
      );
      targetFilePath = `${DIR}/${targetFileName}`;
      revisionNumber = 1;
      isNewFile = true;
    }

    // 准备文件内容（强制压缩；开启端到端加密时先压缩后加密）
    const backupJson = JSON.stringify(backup);

    console.log("[PushStrategy] Compressing backup...");
    const startCompress = Date.now();
    const compressed = await compressText(backupJson);
    const compressTime = Date.now() - startCompress;
    console.log(`[PushStrategy] Compression: ${backupJson.length} → ${compressed.length} bytes in ${compressTime}ms`);

    let fileContent: string = compressed;
    let finalFileName = targetFileName.endsWith(".gz") ? targetFileName : targetFileName + ".gz";
    if (!targetFilePath.endsWith(".gz")) {
      targetFilePath = targetFilePath + ".gz";
    }

    // 端到端加密处理
    if (e2e.enabled) {
      if (!e2e.passphrase) {
        console.error("[PushStrategy] Push aborted: E2E enabled but passphrase missing");
        return {
          success: false,
          action: "error",
          message: "端到端加密已开启但密码缺失，请在设置中重新输入密码",
        };
      }
      console.log("[PushStrategy] Encrypting backup (E2E)...");
      fileContent = await encryptText(fileContent, e2e.passphrase);
      finalFileName = finalFileName + ".enc";
      targetFilePath = targetFilePath + ".enc";
    }

    console.log(`[PushStrategy] ${isNewFile ? 'Creating new backup' : 'Overwriting existing backup'}: ${finalFileName} (revision ${revisionNumber})`);
    
    // 上传新文件（先传）
    await client.putFile(targetFilePath, fileContent);

    // 上传成功后删除旧文件（后删，保证至少有一个有效备份存在）
    if (oldFileToDelete && client.deleteFile) {
      try {
        await client.deleteFile(oldFileToDelete);
        console.log(`[PushStrategy] Deleted old file: ${oldFileToDelete}`);
      } catch (error) {
        console.warn(`[PushStrategy] Failed to delete old file (non-critical):`, error);
        // 旧文件删除失败不影响同步结果，下次清理会处理
      }
    }

    // 保存最后备份文件信息（必须先于 setSyncState，保证状态一致性）
    try {
      await saveLastBackupFileInfo({
        fileName: finalFileName,
        filePath: targetFilePath,
        createdAt: isNewFile ? now : (lastBackupInfo?.createdAt || now), // 保持原创建时间
        revisionNumber: revisionNumber,
      });
    } catch (error) {
      console.error(`[PushStrategy] Failed to save backup file info:`, error);
      // 文件已上传但元数据保存失败，不影响同步结果
    }

    console.log(`[PushStrategy] Backup saved: ${targetFilePath} (revision ${revisionNumber})`);
    
    // 清理旧备份（双轨防空法则：保底保留 5 份，上限动态读取用户配置，默认 15 份，先传后清）
    if (isNewFile) {
      const maxCloudBackups = await getMaxCloudBackups();
      await fileManager.cleanOldBackups(client, { maxToKeep: maxCloudBackups, minToKeep: 5 });
    }

    // 4. 清除备份列表缓存（因为刚上传了新文件）
    await cacheManager.clearBackupListCache();

    // 5. 更新同步时间（基线取服务器记录的新文件时间；查询失败时退回本地时钟）
    let basis: SyncBasis = { mtime: Date.now(), filePath: targetFilePath };
    try {
      const uploadedFiles = await client.listFiles(DIR);
      const uploaded = uploadedFiles.find(
        (f) => f.path === targetFilePath || f.name === finalFileName
      );
      if (uploaded) {
        basis = {
          mtime: uploaded.lastModified || basis.mtime,
          filePath: uploaded.path || targetFilePath,
        };
      }
    } catch (error) {
      console.warn("[PushStrategy] Failed to resolve uploaded file time:", error);
    }

    await setSyncState({
      time: Date.now(),
      url: getStorageIdentifier(config),
      type: "upload",
      basis,
      // 记录上传时的本地树签名（按同步范围过滤），作为下次拉取前脏检测的基准
      localHash: await computeTreeHash(scopedLocalTree),
    });

    await clearPendingSafetyConfirmation();
    const elapsed = Date.now() - startTime;
    console.log(`[PushStrategy] Push completed in ${elapsed}ms`);
    return { success: true, action: "uploaded", message: "上传成功" };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = (error as Error).message || "上传失败";
    console.error(`[PushStrategy] Push failed after ${elapsed}ms:`, error);
    return { success: false, action: "error", message };
  } finally {
    if (!skipLock) await releaseSyncLock(lockHolder);
  }
}
