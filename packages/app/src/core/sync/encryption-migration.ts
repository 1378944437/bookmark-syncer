import browser from 'webextension-polyfill';
import { generateHash } from '../../infrastructure/utils/crypto';
import { createStorageProvider } from '../../infrastructure/storage/provider-factory';
import { getStorageIdentifier, type StorageConfig } from '../storage/types';
import { fileManager } from '../storage/file-manager';
import { acquireSyncLock, releaseSyncLock } from './lock-manager';
import { getE2ESettings, type E2ESettings } from './sync-settings';
import { smartPush } from './strategies/push-strategy';
import { assertNoRecovery } from './recovery';
import { SYNC_STATE_KEY, type SyncResult, type SyncState } from './types';

export const MIGRATION_KEY = 'encryption_migration';
interface Migration { target: string; next: E2ESettings; path?: string; contentHash?: string; state?: SyncState }
/** 密码只存本机；候选文件路径在发起外部写入前落盘，重启后先核对再继续。 */
export async function migrateEncryption(config: StorageConfig, next: E2ESettings): Promise<SyncResult> {
  if (!await acquireSyncLock('encryption')) throw new Error('同步正在进行中');
  try {
    await assertNoRecovery(true);
    const target = getStorageIdentifier(config);
    const pending = (await browser.storage.local.get(MIGRATION_KEY))[MIGRATION_KEY] as Migration | undefined;
    if (pending && pending.target !== target) throw new Error('请切回发起加密迁移的存储目标');
    const migration: Migration = pending ?? { target, next };
    if (typeof migration.next.enabled !== 'boolean' || typeof migration.next.passphrase !== 'string' ||
        (migration.next.enabled && migration.next.passphrase.length < 8)) throw new Error('加密密码至少 8 位');
    const client = createStorageProvider(config);
    let verified = false;
    if (migration.path) {
      const exists = await client.exists?.(migration.path);
      if (exists !== false) {
        const content = await client.getFile(migration.path);
        if (await generateHash('', content) !== migration.contentHash) throw new Error('迁移候选文件校验失败，原设置已保留');
        if ((await fileManager.getLatestBackupFile(client))?.path !== migration.path) throw new Error('迁移期间云端版本发生变化，请先核对云端备份');
        verified = true;
      }
    }
    if (!verified) {
      await browser.storage.local.set({ [MIGRATION_KEY]: migration });
      const old = await getE2ESettings();
      const result = await smartPush(config, 'manual', { skipLock: true, preserveHistory: true,
        writeEncryption: migration.next,
        readEncryption: old.passphrase ? old : migration.next,
        onPrepared: async (path, content, state) => {
          migration.path = path; migration.contentHash = await generateHash('', content);
          migration.state = state;
          await browser.storage.local.set({ [MIGRATION_KEY]: migration });
        } });
      if (!result.success) throw new Error(result.message);
    }
    const latest = await fileManager.getLatestBackupFile(client);
    if (!migration.state || !latest || latest.path !== migration.path) throw new Error('迁移基线或当前版本无法确认，已暂停同步');
    // 新密码与候选文件对应的基线在同一次本地写入中提交。
    await browser.storage.local.set({ e2e_enabled: migration.next.enabled,
      e2e_passphrase: migration.next.enabled ? migration.next.passphrase : '',
      [SYNC_STATE_KEY]: { ...migration.state, basis: { filePath: latest.path, mtime: latest.lastModified } } });
    await browser.storage.local.remove(MIGRATION_KEY);
    return { success: true, action: 'uploaded', message: '加密设置已完成迁移，历史备份仍需原密码' };
  } finally { await releaseSyncLock('encryption'); }
}
