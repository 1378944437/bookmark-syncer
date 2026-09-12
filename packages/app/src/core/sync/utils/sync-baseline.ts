/**
 * 同步基线存储
 * 保存「上次同步完成时」的完整书签树（压缩后存本地，不上云），
 * 作为三方合并的基准参照物。基线缺失时冲突检测退化为不可用，
 * 同步行为与没有基线的旧版本完全一致
 */
import browser from "webextension-polyfill";
import { compressText, decompressText } from "../../../infrastructure/utils/compression";
import type { BookmarkNode, CloudBackup } from "../../../types";

const SYNC_BASELINE_KEY = "sync_base_backup";

/** 基线里树 JSON 的压缩包装（含版本，便于将来格式演进） */
interface StoredBaseline {
  version: 1;
  url: string;
  time: number;
  /** gzip + base64 的 CloudBackup JSON */
  compressed: string;
}

/**
 * 保存同步基线（压缩整个树）
 * 存储失败（如配额不足）只告警不抛出：基线缺失不影响同步
 */
export async function saveSyncBaseline(url: string, tree: BookmarkNode[]): Promise<void> {
  const payload: CloudBackup = {
    metadata: { timestamp: Date.now(), clientVersion: "1-baseline" },
    data: tree,
  };
  const compressed = await compressText(JSON.stringify(payload));
  const stored: StoredBaseline = {
    version: 1,
    url,
    time: Date.now(),
    compressed,
  };
  await browser.storage.local.set({ [SYNC_BASELINE_KEY]: stored });
}

/**
 * 读取同步基线；不存在、URL 不匹配或数据损坏时返回 null
 */
export async function loadSyncBaseline(
  url: string,
): Promise<{ time: number; data: BookmarkNode[] } | null> {
  const result = await browser.storage.local.get(SYNC_BASELINE_KEY);
  const stored = result[SYNC_BASELINE_KEY] as StoredBaseline | undefined;
  if (!stored || stored.url !== url || !stored.compressed) return null;

  try {
    const json = await decompressText(stored.compressed);
    const payload = JSON.parse(json) as CloudBackup;
    if (!payload?.data || !Array.isArray(payload.data)) return null;
    return { time: stored.time, data: payload.data };
  } catch (error) {
    console.warn("[SyncBaseline] Baseline corrupted, ignoring:", error);
    return null;
  }
}
