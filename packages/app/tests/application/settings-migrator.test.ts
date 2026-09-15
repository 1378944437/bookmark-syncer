/**
 * settings-migrator.ts 单元测试
 * 测试配置代码打包、敏感密码过滤、解析校验与跨端导入应用
 */
import { __resetMockStore } from "@src/__mocks__/webextension-polyfill";
import {
  applyMigratedSettings,
  exportSettings,
  MIGRATION_PREFIX,
  parseAndValidateSettings,
} from "@src/application/settings-migrator";
import { beforeEach, describe, expect, it } from "vitest";
import browser from "webextension-polyfill";

describe("SettingsMigrator - 配置导出与导入迁移", () => {
  beforeEach(() => {
    __resetMockStore();
  });

  describe("exportSettings", () => {
    it("默认情况下导出配置并过滤敏感密码", async () => {
      await browser.storage.local.set({
        webdav_url: "https://dav.example.com",
        webdav_username: "user1",
        webdav_password: "secret-password",
        max_local_snapshots: 20,
      });

      const code = await exportSettings({ includePasswords: false });
      expect(code.startsWith(MIGRATION_PREFIX)).toBe(true);

      const parsed = parseAndValidateSettings(code);
      expect(parsed.valid).toBe(true);
      expect(parsed.payload?.settings.webdav_url).toBe("https://dav.example.com");
      expect(parsed.payload?.settings.webdav_username).toBe("user1");
      expect(parsed.payload?.settings.webdav_password).toBeUndefined();
      expect(parsed.payload?.settings.max_local_snapshots).toBe(20);
    });

    it("显式指定 includePasswords: true 时包含密码", async () => {
      await browser.storage.local.set({
        webdav_url: "https://dav.example.com",
        webdav_password: "secret-password",
      });

      const code = await exportSettings({ includePasswords: true });
      const parsed = parseAndValidateSettings(code);
      expect(parsed.valid).toBe(true);
      expect(parsed.payload?.settings.webdav_password).toBe("secret-password");
    });
  });

  describe("parseAndValidateSettings", () => {
    it("空输入或非法格式返回对应错误", () => {
      expect(parseAndValidateSettings("").valid).toBe(false);
      expect(parseAndValidateSettings("invalid-string").valid).toBe(false);
      expect(parseAndValidateSettings(JSON.stringify({ app: "other" })).valid).toBe(false);
    });

    it("能正确解析纯 JSON 格式配置代码", () => {
      const json = JSON.stringify({
        app: "marksync",
        version: "1.0",
        exportedAt: Date.now(),
        settings: { webdav_url: "https://dav.example.com" },
      });

      const res = parseAndValidateSettings(json);
      expect(res.valid).toBe(true);
      expect(res.payload?.settings.webdav_url).toBe("https://dav.example.com");
    });
  });

  describe("applyMigratedSettings", () => {
    it('does not retain old-target credentials or auto sync after an incomplete import', async () => {
      await browser.storage.local.set({ gist_token: 'old-target-secret', e2e_passphrase: 'old-password' });
      await applyMigratedSettings({ app: 'marksync', version: '1.0', exportedAt: 1,
        settings: { storage_type: 'gist', gist_id: 'new-target', e2e_enabled: true, auto_sync_enabled: true } });
      expect(await browser.storage.local.get(['gist_token', 'e2e_passphrase', 'auto_sync_enabled', 'scheduled_sync_enabled']))
        .toEqual({ gist_token: '', e2e_passphrase: '', auto_sync_enabled: false, scheduled_sync_enabled: false });
    });
    it("正确将解析后的配置应用并写入 storage，配额保底 5 份", async () => {
      const payload = {
        app: "marksync" as const,
        version: "1.0",
        exportedAt: Date.now(),
        settings: {
          webdav_url: "https://dav.new.com",
          max_local_snapshots: 3, // 低于保底值，应被修正为 5
          auto_sync_enabled: false,
        },
      };

      await applyMigratedSettings(payload);

      const stored = await browser.storage.local.get([
        "webdav_url",
        "max_local_snapshots",
        "auto_sync_enabled",
      ]);
      expect(stored.webdav_url).toBe("https://dav.new.com");
      expect(stored.max_local_snapshots).toBe(5);
      expect(stored.auto_sync_enabled).toBe(false);
    });
  });
});
