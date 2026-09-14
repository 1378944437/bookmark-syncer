/**
 * Application 层状态管理
 * 应用级配置（WebDAV 连接、调度时间戳）的读写。
 * 同步域状态（恢复标志/加密设置/同步范围/设备身份等）见 core/sync/sync-settings
 */
import browser from "webextension-polyfill";
import type { StorageConfig } from "../core/storage/types";

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
 * 获取当前生效的云端存储配置（支持 WebDAV 与 GitHub Gist）
 */
export async function getActiveStorageConfig(): Promise<{
  config: StorageConfig | null;
  storageType: 'webdav' | 'gist';
  autoSyncEnabled: boolean;
  scheduledSyncEnabled: boolean;
  scheduledSyncInterval: number;
}> {
  const result = await browser.storage.local.get([
    "storage_type",
    "webdav_url",
    "webdav_username",
    "webdav_password",
    "gist_token",
    "gist_id",
    "gist_endpoint",
    "auto_sync_enabled",
    "scheduled_sync_enabled",
    "scheduled_sync_interval",
  ]);

  const storageType = (result.storage_type as 'webdav' | 'gist') || 'webdav';
  const autoSyncEnabled = result.auto_sync_enabled !== false;
  const scheduledSyncEnabled = result.scheduled_sync_enabled === true;
  const scheduledSyncInterval = (result.scheduled_sync_interval as number) || 30;

  if (storageType === 'gist') {
    const token = ((result.gist_token as string) || '').trim();
    const gistId = ((result.gist_id as string) || '').trim();
    const endpoint = ((result.gist_endpoint as string) || '').trim() || 'https://api.github.com';

    if (!token || !gistId) {
      return { config: null, storageType, autoSyncEnabled, scheduledSyncEnabled, scheduledSyncInterval };
    }

    return {
      config: { type: 'gist', token, gistId, endpoint },
      storageType,
      autoSyncEnabled,
      scheduledSyncEnabled,
      scheduledSyncInterval,
    };
  }

  const url = ((result.webdav_url as string) || '').trim();
  if (!url) {
    return { config: null, storageType, autoSyncEnabled, scheduledSyncEnabled, scheduledSyncInterval };
  }

  return {
    config: {
      type: 'webdav',
      url,
      username: ((result.webdav_username as string) || '').trim(),
      password: (result.webdav_password as string) || '',
    },
    storageType,
    autoSyncEnabled,
    scheduledSyncEnabled,
    scheduledSyncInterval,
  };
}

/**
 * 获取 WebDAV 配置（向后兼容）
 */
export async function getWebDAVConfig(): Promise<{
  config: { url: string; username: string; password: string } | null;
  autoSyncEnabled: boolean;
  scheduledSyncEnabled: boolean;
  scheduledSyncInterval: number;
}> {
  const active = await getActiveStorageConfig();
  if (active.config && 'url' in active.config) {
    return {
      config: {
        url: active.config.url,
        username: active.config.username,
        password: active.config.password,
      },
      autoSyncEnabled: active.autoSyncEnabled,
      scheduledSyncEnabled: active.scheduledSyncEnabled,
      scheduledSyncInterval: active.scheduledSyncInterval,
    };
  }
  return {
    config: null,
    autoSyncEnabled: active.autoSyncEnabled,
    scheduledSyncEnabled: active.scheduledSyncEnabled,
    scheduledSyncInterval: active.scheduledSyncInterval,
  };
}

