import browser from 'webextension-polyfill';
import { DEBOUNCE_ALARM, DEBOUNCE_ALARM_FALLBACK_MS, DEBOUNCE_DELAY_MS } from './constants';
import { getRecoveryRecord } from '../core/sync/recovery';
import { getActiveStorageConfig } from './state-manager';
import { getStorageIdentifier } from '../core/storage/types';
import { executeUpload } from './sync-executor';

const PENDING_KEY = 'pending_bookmark_upload';
const ACK_KEY = 'acknowledged_bookmark_upload';
interface PendingUpload { id: string; target: string }
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let uploadInFlight = false;

async function scheduleRetry(): Promise<void> {
  await browser.alarms.create(DEBOUNCE_ALARM, { when: Date.now() + DEBOUNCE_ALARM_FALLBACK_MS });
}
export async function resumePendingUpload(): Promise<void> {
  const stored = await browser.storage.local.get([PENDING_KEY, ACK_KEY]);
  const pending = stored[PENDING_KEY] as PendingUpload | undefined;
  if (pending && pending.id !== stored[ACK_KEY]) {
    const { config, autoSyncEnabled } = await getActiveStorageConfig();
    if (config && autoSyncEnabled && getStorageIdentifier(config) === pending.target) await scheduleRetry();
  }
}
async function runDebouncedUpload(): Promise<void> {
  if (uploadInFlight) return;
  uploadInFlight = true; // 同步设置，先于首次 await。
  try {
    const stored = await browser.storage.local.get([PENDING_KEY, ACK_KEY]);
    const pending = stored[PENDING_KEY] as PendingUpload | undefined;
    if (!pending || pending.id === stored[ACK_KEY]) return;
    const { config, autoSyncEnabled } = await getActiveStorageConfig();
    if (!config || !autoSyncEnabled || getStorageIdentifier(config) !== pending.target) return;
    if (await executeUpload()) {
      // ACK 单独存储，操作期间发生的新事件不会被旧任务删除。
      await browser.storage.local.set({ [ACK_KEY]: pending.id });
    }
  } catch (error) { console.error('[BookmarkMonitor] Pending upload failed:', error); }
  finally { uploadInFlight = false; await resumePendingUpload(); }
}
export async function triggerDebouncedSync(): Promise<void> {
  try {
    if (await getRecoveryRecord()) return; // 批量恢复自身产生的事件不作为用户编辑。
    const { config } = await getActiveStorageConfig();
    if (!config) return;
    await browser.storage.local.set({ [PENDING_KEY]: { id: crypto.randomUUID(), target: getStorageIdentifier(config) } satisfies PendingUpload });
    await scheduleRetry();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { debounceTimer = null; void runDebouncedUpload(); }, DEBOUNCE_DELAY_MS);
  } catch (error) { console.error('[BookmarkMonitor] Failed to schedule upload:', error); }
}
export async function handleDebounceAlarm(alarm: browser.Alarms.Alarm): Promise<void> {
  if (alarm.name !== DEBOUNCE_ALARM) return;
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  await runDebouncedUpload();
}
export const onBookmarkEvent = (): void => { void triggerDebouncedSync(); };
export function registerBookmarkListeners(): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.keys(changes).some(key => /^(auto_sync_enabled|storage_type|webdav_|gist_)/.test(key))) {
      void resumePendingUpload().catch(error => console.error('[BookmarkMonitor] Resume failed:', error));
    }
  });
  browser.bookmarks.onCreated.addListener(onBookmarkEvent);
  browser.bookmarks.onRemoved.addListener(onBookmarkEvent);
  browser.bookmarks.onChanged.addListener(onBookmarkEvent);
  browser.bookmarks.onMoved.addListener(onBookmarkEvent);
  void resumePendingUpload().catch(error => console.error('[BookmarkMonitor] Resume failed:', error));
}
