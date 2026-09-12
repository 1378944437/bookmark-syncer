/**
 * Application 层状态管理
 * 管理恢复状态，避免同步循环
 */
import browser from "webextension-polyfill";
import type { LastBackupFileInfo } from "../core/storage/types";
import { STORAGE_CONSTANTS } from "../core/storage/types";
import { RESET_RESTORING_DELAY_MS, RESTORING_KEY, RESTORING_TIMEOUT_MS } from "./constants";

type RestoringState = {
  value: boolean;
  timestamp: number;
  until?: number;
};

function getRestoringStorageArea(): typeof browser.storage.local | typeof browser.storage.session {
  return browser.storage.session ?? browser.storage.local;
}

/**
 * 检查是否正在执行恢复操作
 * 使用 storage.session 确保 Service Worker 重启后状态不丢失
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

/**
 * 缺失文件夹兜底开关：本地缺少云端系统文件夹时，
 * 把其中书签合并到本地「其他书签」（只增不删）。默认关闭
 */
export async function getMissingFolderFallback(): Promise<boolean> {
  const result = await browser.storage.local.get('missing_folder_fallback');
  return result.missing_folder_fallback === true;
}

/**
 * 三树合并（实验）开关：拉取时以基线为参照自动取舍本地与云端的改动。
 * 默认关闭——关闭时保持原行为（脏→合并拉取+推送；干净→覆盖拉取）
 */
export async function getThreeWayMergeEnabled(): Promise<boolean> {
  const result = await browser.storage.local.get('three_way_merge_enabled');
  return result.three_way_merge_enabled === true;
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
 * 供面板显示「云端数据来自 XX」，无需额外下载
 */
export async function saveLastRemoteDevice(info: RemoteDeviceInfo): Promise<void> {
  await browser.storage.local.set({ [LAST_REMOTE_DEVICE_KEY]: info });
}

export async function getLastRemoteDevice(): Promise<RemoteDeviceInfo | null> {
  const result = await browser.storage.local.get(LAST_REMOTE_DEVICE_KEY);
  return (result[LAST_REMOTE_DEVICE_KEY] as RemoteDeviceInfo | undefined) || null;
}

/** 上次定时同步检查的时间戳存储键 */
const LAST_SCHEDULED_CHECK_KEY = 'last_scheduled_check';

/**
 * 获取上次定时同步检查时间（0 表示从未检查）
 */
export async function getLastScheduledCheck(): Promise<number> {
  const result = await browser.storage.local.get(LAST_SCHEDULED_CHECK_KEY);
  return (result[LAST_SCHEDULED_CHECK_KEY] as number) || 0;
}

/**
 * 记录定时同步检查时间
 */
export async function setLastScheduledCheck(time: number): Promise<void> {
  await browser.storage.local.set({ [LAST_SCHEDULED_CHECK_KEY]: time });
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

/**
 * 获取 WebDAV 配置
 */
export async function getWebDAVConfig(): Promise<{
  config: { url: string; username: string; password: string } | null;
  autoSyncEnabled: boolean;
  scheduledSyncEnabled: boolean;
  scheduledSyncInterval: number;
}> {
  const result = await browser.storage.local.get([
    "webdav_url",
    "webdav_username",
    "webdav_password",
    "auto_sync_enabled",
    "scheduled_sync_enabled",
    "scheduled_sync_interval",
  ]);

  const url = result.webdav_url as string;
  if (!url) {
    return {
      config: null,
      autoSyncEnabled: result.auto_sync_enabled !== false,
      scheduledSyncEnabled: result.scheduled_sync_enabled === true,
      scheduledSyncInterval: (result.scheduled_sync_interval as number) || 30,
    };
  }

  return {
    config: {
      url: url.trim(),
      username: ((result.webdav_username as string) || "").trim(),
      // 密码保留原样：trim 会破坏含首尾空格的真实密码
      password: (result.webdav_password as string) || "",
    },
    autoSyncEnabled: result.auto_sync_enabled !== false,
    scheduledSyncEnabled: result.scheduled_sync_enabled === true,
    scheduledSyncInterval: (result.scheduled_sync_interval as number) || 30,
  };
}
