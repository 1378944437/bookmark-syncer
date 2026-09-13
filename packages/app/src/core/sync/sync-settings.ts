/**
 * 同步域状态（core 层）
 * 恢复标志、端到端加密设置、同步范围、备份窗口、设备身份、远端设备记录。
 * 原属 application/state-manager，因策略层（core）直接读写而下沉至此，
 * 消除 Core → Application 的反向依赖。UI 层可继续从 application barrel 使用
 */
import browser from "webextension-polyfill";
import type { LastBackupFileInfo } from "../storage/types";
import { STORAGE_CONSTANTS } from "../storage/types";
import { normalizeSyncScope, type SyncScope } from "../bookmark/sync-scope";
import { RESET_RESTORING_DELAY_MS, RESTORING_KEY, RESTORING_TIMEOUT_MS } from "./types";

type RestoringState = {
  value: boolean;
  timestamp: number;
  until?: number;
};

/** 恢复标志优先写 storage.session（SW 重启不丢），不可用时退回 local */
function getRestoringStorageArea(): typeof browser.storage.local | typeof browser.storage.session {
  return browser.storage.session ?? browser.storage.local;
}

/**
 * 检查是否正在执行恢复操作
 * 带超时保护，防止异常情况下状态一直锁定
 */
export async function getIsRestoring(): Promise<boolean> {
  try {
    const storageArea = getRestoringStorageArea();
    const result = await storageArea.get(RESTORING_KEY);
    const state = result[RESTORING_KEY] as RestoringState | undefined;

    if (!state) return false;

    const now = Date.now();

    if (typeof state.until === "number") {
      if (now >= state.until) {
        await setIsRestoring(false);
        return false;
      }

      return state.value;
    }

    // 检查超时（防止异常情况下状态一直锁定）
    if (now - state.timestamp > RESTORING_TIMEOUT_MS) {
      console.warn(
        `[StateManager] Restoring state timeout (${now - state.timestamp}ms), auto clearing`,
      );
      await setIsRestoring(false);
      return false;
    }

    return state.value;
  } catch (error) {
    console.error("[StateManager] Failed to get restoring state:", error);
    return false;
  }
}

/**
 * 设置恢复状态
 */
export async function setIsRestoring(value: boolean): Promise<void> {
  try {
    const storageArea = getRestoringStorageArea();

    if (value) {
      await storageArea.set({
        [RESTORING_KEY]: {
          value: true,
          timestamp: Date.now(),
        },
      });
      console.log("[StateManager] Restoring state activated");
    } else {
      await storageArea.remove(RESTORING_KEY);
      console.log("[StateManager] Restoring state cleared");
    }
  } catch (error) {
    console.error("[StateManager] Failed to set restoring state:", error);
  }
}

/**
 * 在恢复结束后保留一个短暂阻塞窗口，避免收尾事件立即触发同步
 */
export async function holdRestoringUntil(delayMs = RESET_RESTORING_DELAY_MS): Promise<void> {
  try {
    const storageArea = getRestoringStorageArea();
    const now = Date.now();
    await storageArea.set({
      [RESTORING_KEY]: {
        value: true,
        timestamp: now,
        until: now + delayMs,
      } satisfies RestoringState,
    });
    console.log(`[StateManager] Restoring hold scheduled for ${delayMs}ms`);
  } catch (error) {
    console.error("[StateManager] Failed to hold restoring state:", error);
    await setIsRestoring(false);
  }
}

/**
 * 获取备份文件间隔配置（分钟）
 */
export async function getBackupFileInterval(): Promise<number> {
  const result = await browser.storage.local.get('backup_file_interval');
  return (result.backup_file_interval as number) || 1; // 默认1分钟
}

export const DEFAULT_MAX_LOCAL_SNAPSHOTS = 15;
export const MIN_LOCAL_SNAPSHOTS = 5;
export const DEFAULT_MAX_CLOUD_BACKUPS = 15;
export const MIN_CLOUD_BACKUPS = 5;

/**
 * 获取本地快照最大保留份数（保底防呆）
 * 默认 15 份，最低保底 5 份
 */
export async function getMaxLocalSnapshots(): Promise<number> {
  const result = await browser.storage.local.get('max_local_snapshots');
  const val = Number(result.max_local_snapshots);
  if (isNaN(val) || val < MIN_LOCAL_SNAPSHOTS) {
    return DEFAULT_MAX_LOCAL_SNAPSHOTS;
  }
  return Math.max(MIN_LOCAL_SNAPSHOTS, Math.floor(val));
}

/**
 * 获取云端备份最大保留份数（保底防呆）
 * 默认 15 份，最低保底 5 份
 */
export async function getMaxCloudBackups(): Promise<number> {
  const result = await browser.storage.local.get('max_cloud_backups');
  const val = Number(result.max_cloud_backups);
  if (isNaN(val) || val < MIN_CLOUD_BACKUPS) {
    return DEFAULT_MAX_CLOUD_BACKUPS;
  }
  return Math.max(MIN_CLOUD_BACKUPS, Math.floor(val));
}

/**
 * 缺失文件夹兜底开关：本地缺少云端系统文件夹时，
 * 把其中书签合并到本地「其他书签」（只增不删）。默认关闭
 */
export async function getMissingFolderFallback(): Promise<boolean> {
  const result = await browser.storage.local.get('missing_folder_fallback');
  return result.missing_folder_fallback === true;
}

/**
 * 同步范围（每台设备独立）：参与同步的系统文件夹。
 * 默认仅书签栏；范围外的文件夹完全不参与同步，内容保留在本地
 */
export async function getSyncScope(): Promise<SyncScope> {
  const result = await browser.storage.local.get('sync_scope');
  return normalizeSyncScope(result.sync_scope as Partial<SyncScope> | undefined);
}

export interface E2ESettings {
  enabled: boolean;
  passphrase: string;
}

/**
 * 端到端加密设置：密码只保存在本设备（storage.local），不上传云端。
 * 所有设备需输入相同密码才能互相解密备份
 */
export async function getE2ESettings(): Promise<E2ESettings> {
  const result = await browser.storage.local.get(['e2e_enabled', 'e2e_passphrase']);
  return {
    enabled: result.e2e_enabled === true,
    passphrase: (result.e2e_passphrase as string) || "",
  };
}

export async function saveE2ESettings(settings: E2ESettings): Promise<void> {
  await browser.storage.local.set({
    e2e_enabled: settings.enabled,
    // 关闭时清除本地密码；已上传的加密备份仍需原密码才能恢复
    e2e_passphrase: settings.enabled ? settings.passphrase : "",
  });
}

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
}

/**
 * 获取设备身份：deviceId 首次调用时生成并持久化；
 * deviceName 为用户设置的备注（设置页可改，默认空，展示时回退浏览器名）
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const result = await browser.storage.local.get(['device_id', 'device_name']);
  let deviceId = result.device_id as string | undefined;
  if (!deviceId) {
    deviceId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await browser.storage.local.set({ device_id: deviceId });
  }
  const deviceName = (result.device_name as string) || "";
  return { deviceId, deviceName };
}

export interface RemoteDeviceInfo {
  deviceId?: string;
  deviceName?: string;
  time: number;
}

const LAST_REMOTE_DEVICE_KEY = 'last_remote_device';

/**
 * 记录最近一次从云端读到的备份所属设备（推送预检/恢复时捕获），
 * 供面板显示「来自 XX」，无需额外下载
 */
export async function saveLastRemoteDevice(info: RemoteDeviceInfo): Promise<void> {
  await browser.storage.local.set({ [LAST_REMOTE_DEVICE_KEY]: info });
}

export async function getLastRemoteDevice(): Promise<RemoteDeviceInfo | null> {
  const result = await browser.storage.local.get(LAST_REMOTE_DEVICE_KEY);
  return (result[LAST_REMOTE_DEVICE_KEY] as RemoteDeviceInfo | undefined) || null;
}

/**
 * 获取最后备份文件信息
 */
export async function getLastBackupFileInfo(): Promise<LastBackupFileInfo | null> {
  const result = await browser.storage.local.get(STORAGE_CONSTANTS.LAST_BACKUP_FILE_KEY);
  return (result[STORAGE_CONSTANTS.LAST_BACKUP_FILE_KEY] as LastBackupFileInfo | undefined) || null;
}

/**
 * 保存最后备份文件信息
 */
export async function saveLastBackupFileInfo(info: LastBackupFileInfo): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_CONSTANTS.LAST_BACKUP_FILE_KEY]: info,
  });
}

/**
 * 清除最后备份文件信息（用于强制创建新文件）
 */
export async function clearLastBackupFileInfo(): Promise<void> {
  await browser.storage.local.remove(STORAGE_CONSTANTS.LAST_BACKUP_FILE_KEY);
}
