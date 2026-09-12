/**
 * sync-indicator.ts 测试
 * 同步完成提示：图标角标 + 活动页面轻提示
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifySyncCompleted } from "@src/application/sync-indicator";
import browser from "webextension-polyfill";

describe("notifySyncCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(browser.tabs.query).mockResolvedValue([
      { id: 1, active: true },
      { id: 2, active: true },
      { id: undefined, active: true },
    ] as any);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined);
  });

  it("上传成功后闪现角标并向活动标签页发提示", async () => {
    await notifySyncCompleted("uploaded");

    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: "✓" });
    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(2); // 无 id 的标签页被跳过
    const message = vi.mocked(browser.tabs.sendMessage).mock.calls[0][1] as {
      type: string;
      text: string;
    };
    expect(message.type).toBe("bookmark-syncer:sync-completed");
    expect(message.text).toBeTruthy();
  });

  it("下载成功后同样提示", async () => {
    await notifySyncCompleted("downloaded");
    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ text: "✓" });
    expect(browser.tabs.sendMessage).toHaveBeenCalled();
  });

  it("内容相同（skip_identical）不提示，避免噪音", async () => {
    await notifySyncCompleted("skipped");
    expect(browser.action.setBadgeText).not.toHaveBeenCalled();
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("发送失败（如 chrome:// 页面）不影响其他标签页", async () => {
    vi.mocked(browser.tabs.sendMessage).mockRejectedValueOnce(new Error("no receiver"));
    vi.mocked(browser.tabs.sendMessage).mockResolvedValueOnce(undefined);

    await expect(notifySyncCompleted("uploaded")).resolves.toBeUndefined();
    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });
});
