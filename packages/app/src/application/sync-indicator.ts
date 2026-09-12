/**
 * 同步完成小提示
 * 在扩展图标上闪现角标（✓）：面板开着或关着都能看到，短时间后自动消失，
 * 不打扰用户（不用系统通知，那个太重）
 */
import browser from "webextension-polyfill";
import type { SyncResult } from "../core/sync";

const BADGE_DURATION_MS = 2000;

let badgeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 同步成功后在图标上闪现 ✓ 角标，短暂展示后清除
 * 非上传/下载类结果（跳过、错误）不提示，避免噪音
 */
export function flashSyncBadge(action: SyncResult["action"]): void {
  if (action !== "uploaded" && action !== "downloaded") return;

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
