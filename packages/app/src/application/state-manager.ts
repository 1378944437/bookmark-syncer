/**
 * Application 层状态管理
 * 应用级配置（WebDAV 连接、调度时间戳）的读写。
 * 同步域状态（恢复标志/加密设置/同步范围/设备身份等）见 core/sync/sync-settings
 */
import browser from "webextension-polyfill";

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
