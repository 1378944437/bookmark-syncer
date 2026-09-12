/**
 * 同步完成小提示
 * 两条通道（都短时、不打扰）：
 * 1. 扩展图标闪现绿色 ✓ 角标（面板关着也能看到）
 * 2. 向当前活动标签页的内容脚本发消息，在网页底部中央弹出轻提示
 *    （手机/折叠菜单里图标很难被注意到，页面内提示最直接）
 */
import browser from "webextension-polyfill";
import type { SyncResult } from "../core/sync";

const BADGE_DURATION_MS = 2000;
const SYNC_COMPLETED_MESSAGE = "bookmark-syncer:sync-completed";

let badgeTimer: ReturnType<typeof setTimeout> | null = null;

/** 同步完成文案（后台拿不到 React 的 i18n 上下文，按浏览器 UI 语言二选一） */
function syncCompletedText(): string {
  try {
    const lang = browser.i18n?.getUILanguage?.() ?? "en";
    return lang.toLowerCase().startsWith("zh") ? "同步完成" : "Sync complete";
  } catch {
    return "Sync complete";
  }
}

function flashBadge(): void {
  try {
    void browser.action.setBadgeBackgroundColor({ color: "#16a34a" });
    void browser.action.setBadgeTextColor({ color: "#ffffff" });
    void browser.action.setBadgeText({ text: "✓" });

    if (badgeTimer) clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => {
      badgeTimer = null;
      void browser.action.setBadgeText({ text: "" });
    }, BADGE_DURATION_MS);
  } catch (error) {
    console.warn("[SyncIndicator] Failed to flash badge:", error);
  }
}

/**
 * 同步成功后的统一提示入口
 * 非上传/下载类结果（跳过、错误）不提示，避免噪音
 */
export async function notifySyncCompleted(action: SyncResult["action"]): Promise<void> {
  if (action !== "uploaded" && action !== "downloaded") return;

  flashBadge();

  // 向所有窗口的活动标签页发消息；chrome:// 等无内容脚本的页面会失败，静默忽略
  try {
    const tabs = await browser.tabs.query({ active: true });
    const text = syncCompletedText();
    await Promise.allSettled(
      tabs
        .filter((tab) => tab.id !== undefined)
        .map((tab) =>
          browser.tabs.sendMessage(tab.id as number, {
            type: SYNC_COMPLETED_MESSAGE,
            text,
          }),
        ),
    );
  } catch (error) {
    console.warn("[SyncIndicator] Failed to notify active page:", error);
  }
}
