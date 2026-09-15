/**
 * 同步状态管理器
 * 管理上次同步时间、URL、类型等状态信息
 */
import browser from "webextension-polyfill";
import { SYNC_STATE_KEY } from "./types";
import type { SyncState } from "./types";
import { getSyncScope } from './sync-settings';
import { SYNC_SCOPE_KEYS } from '../bookmark/sync-scope';

/**
 * 同步状态管理器类
 */
export class SyncStateManager {
  /**
   * 获取同步状态
   */
  async getState(url: string): Promise<SyncState | null> {
    try {
      const storage = await browser.storage.local.get(SYNC_STATE_KEY);
      const syncState = storage[SYNC_STATE_KEY] as SyncState | undefined;

      // 只返回匹配当前 URL 的状态
      if (syncState?.url === url) {
        const currentScope = await getSyncScope();
        if (!syncState.scope || SYNC_SCOPE_KEYS.some(key => syncState.scope![key] !== currentScope[key])) return null;
        return syncState;
      }

      return null;
    } catch (error) {
      console.error("[SyncStateManager] Failed to get sync state:", error);
      return null;
    }
  }

  /**
   * 设置同步状态
   */
  async setState(state: SyncState): Promise<void> {
    try {
      await browser.storage.local.set({
        [SYNC_STATE_KEY]: { ...state, scope: state.scope ?? await getSyncScope() },
      });
    } catch (error) {
      console.error("[SyncStateManager] Failed to set sync state:", error);
      throw error;
    }
  }

  /**
   * 获取上次同步时间（针对指定 URL）
   */
  async getLastSyncTime(url: string): Promise<number> {
    const state = await this.getState(url);
    return state?.time || 0;
  }
}

/**
 * 导出单例实例
 */
export const syncStateManager = new SyncStateManager();

/**
 * 兼容旧 API 的导出（向后兼容）
 */
export const getSyncState = (url: string) => syncStateManager.getState(url);
export const setSyncState = (state: SyncState) => syncStateManager.setState(state);
export const getLastSyncTime = (url: string) => syncStateManager.getLastSyncTime(url);
