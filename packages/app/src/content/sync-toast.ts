/**
 * 内容脚本：同步完成时在网页底部中央弹出轻提示
 *
 * 图标角标在手机/折叠菜单里很难被注意到，这里把提示直接画在
 * 用户正在浏览的页面上（底部中央，2.5 秒自动消失，不可交互、不挡操作）。
 * 由后台在同步成功后通过 tabs.sendMessage 触发。
 */
import browser from "webextension-polyfill";

const MESSAGE_TYPE = "bookmark-syncer:sync-completed";
const TOAST_DURATION_MS = 2500;
const FADE_OUT_MS = 300;

let toastEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const TOAST_STYLES = [
  "position: fixed",
  "bottom: 28px",
  "left: 50%",
  "transform: translateX(-50%)",
  "background: rgba(17, 24, 39, 0.9)",
  "color: #ffffff",
  "padding: 8px 18px",
  "border-radius: 999px",
  "font: 500 13px/1.4 system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  "z-index: 2147483647",
  "box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25)",
  "opacity: 0",
  "transition: opacity 0.25s ease",
  "pointer-events: none",
].join(";");

function showSyncToast(text: string): void {
  // 已有提示在显示时：复用节点刷新文案和计时
  if (toastEl && document.body.contains(toastEl)) {
    toastEl.textContent = `✓ ${text}`;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => dismissToast(toastEl!), TOAST_DURATION_MS);
    return;
  }

  const el = document.createElement("div");
  el.textContent = `✓ ${text}`;
  el.setAttribute("style", TOAST_STYLES);
  document.body.appendChild(el);
  toastEl = el;

  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });

  hideTimer = setTimeout(() => dismissToast(el), TOAST_DURATION_MS);
}

function dismissToast(el: HTMLDivElement): void {
  el.style.opacity = "0";
  setTimeout(() => {
    el.remove();
    if (toastEl === el) toastEl = null;
  }, FADE_OUT_MS);
}

if (document.body) {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as { type?: string; text?: string } | null;
    if (m && m.type === MESSAGE_TYPE && typeof m.text === "string" && m.text) {
      showSyncToast(m.text);
    }
    return undefined;
  });
}
