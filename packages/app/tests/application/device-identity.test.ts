/**
 * 设备身份与三树合并开关测试
 */
import { __resetMockStore } from "@src/__mocks__/webextension-polyfill";
import {
  getDeviceIdentity,
} from "@src/application/state-manager";
import browser from "webextension-polyfill";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  __resetMockStore();
});

describe("getDeviceIdentity", () => {
  it("首次调用生成 deviceId 并持久化", async () => {
    const first = await getDeviceIdentity();
    expect(first.deviceId).toBeTruthy();
    // 再次调用返回同一身份
    const second = await getDeviceIdentity();
    expect(second.deviceId).toBe(first.deviceId);
    // 已写入存储
    const stored = await browser.storage.local.get("device_id");
    expect(stored.device_id).toBe(first.deviceId);
  });

  it("deviceName 默认为空（展示时回退浏览器名），可被设置覆盖", async () => {
    expect((await getDeviceIdentity()).deviceName).toBe("");
    await browser.storage.local.set({ device_name: "客厅电脑" });
    expect((await getDeviceIdentity()).deviceName).toBe("客厅电脑");
  });
});
