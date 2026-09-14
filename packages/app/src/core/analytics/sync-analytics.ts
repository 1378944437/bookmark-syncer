/**
 * 同步日志与活动统计领域服务
 * 负责持久化最近 100 条同步日志与按日聚合近期同步活动数据
 */
import browser from "webextension-polyfill";

export const SYNC_LOGS_STORAGE_KEY = "sync_history_logs";
export const MAX_SYNC_LOGS = 100;

/**
 * 差分变动数量
 */
export interface SyncLogDiff {
  added: number;
  updated: number;
  deleted: number;
}

/**
 * 同步历史日志记录
 */
export interface SyncLogEntry {
  /** 唯一标识 */
  id: string;
  /** 执行时间戳 */
  timestamp: number;
  /** 触发方式：手动 / 自动 / 定时 */
  trigger: "manual" | "auto" | "schedule";
  /** 操作结果动作 */
  action: "uploaded" | "downloaded" | "merged" | "skipped" | "error";
  /** 状态或提示文案 */
  message: string;
  /** 变动差分统计 */
  diff?: SyncLogDiff;
  /** 耗时毫秒数 */
  durationMs?: number;
  /** 发起或关联的设备名称 */
  deviceName?: string;
}

/**
 * 按日聚合的活动统计
 */
export interface DailyActivity {
  /** 日期格式：YYYY-MM-DD */
  date: string;
  /** 当日同步总频次 */
  count: number;
  /** 新增总数 */
  added: number;
  /** 更新总数 */
  updated: number;
  /** 删除总数 */
  deleted: number;
}

/**
 * 获取所有同步日志（最新的排在前面）
 */
export async function getSyncLogs(): Promise<SyncLogEntry[]> {
  try {
    const result = await browser.storage.local.get(SYNC_LOGS_STORAGE_KEY);
    const logs = result[SYNC_LOGS_STORAGE_KEY] as SyncLogEntry[] | undefined;
    if (!Array.isArray(logs)) return [];
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("[SyncAnalytics] Failed to get sync logs:", error);
    return [];
  }
}

/**
 * 追加一条同步日志，自动维护最多 100 条 FIFO 轮转
 */
export async function addSyncLog(
  entry: Omit<SyncLogEntry, "id">
): Promise<SyncLogEntry> {
  const newLog: SyncLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  try {
    const current = await getSyncLogs();
    // 保持最多 MAX_SYNC_LOGS 份记录
    const updated = [newLog, ...current].slice(0, MAX_SYNC_LOGS);
    await browser.storage.local.set({ [SYNC_LOGS_STORAGE_KEY]: updated });
    return newLog;
  } catch (error) {
    console.error("[SyncAnalytics] Failed to add sync log:", error);
    return newLog;
  }
}

/**
 * 清空所有同步日志
 */
export async function clearSyncLogs(): Promise<void> {
  try {
    await browser.storage.local.remove(SYNC_LOGS_STORAGE_KEY);
    console.log("[SyncAnalytics] Sync logs cleared");
  } catch (error) {
    console.error("[SyncAnalytics] Failed to clear sync logs:", error);
  }
}

/**
 * 格式化日期为 YYYY-MM-DD 本地字符串
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 获取最近 N 天的按日聚合活动热力数据（按日期从旧到新升序排列）
 *
 * @param days 天数，默认 14 天
 * @returns 每日活动统计数组
 */
export async function getDailyActivities(days: number = 14): Promise<DailyActivity[]> {
  const safeDays = Math.max(1, Math.min(60, Math.floor(days)));
  const logs = await getSyncLogs();

  // 构建从 safeDays 天前到当天的连续日期字典
  const now = new Date();
  const dateMap = new Map<string, DailyActivity>();

  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = formatDateKey(d);
    dateMap.set(key, {
      date: key,
      count: 0,
      added: 0,
      updated: 0,
      deleted: 0,
    });
  }

  // 聚合日志数据到对应日期
  for (const log of logs) {
    const key = formatDateKey(new Date(log.timestamp));
    const item = dateMap.get(key);
    if (item) {
      item.count += 1;
      if (log.diff) {
        item.added += log.diff.added || 0;
        item.updated += log.diff.updated || 0;
        item.deleted += log.diff.deleted || 0;
      }
    }
  }

  return Array.from(dateMap.values());
}
