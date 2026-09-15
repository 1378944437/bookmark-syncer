/** 导入和显式保存共用的设置边界，拒绝无效类型而不是悄悄改变含义。 */
export function validateSettings(settings: unknown): asserts settings is Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('设置必须是对象');
  const s = settings as Record<string, unknown>;
  const strings = ['webdav_url', 'webdav_username', 'webdav_password', 'gist_token', 'gist_id', 'gist_endpoint', 'e2e_passphrase', 'device_name'];
  for (const key of strings) if (key in s && typeof s[key] !== 'string') throw new Error(`设置字段类型无效: ${key}`);
  for (const key of ['auto_sync_enabled', 'scheduled_sync_enabled', 'e2e_enabled']) if (key in s && typeof s[key] !== 'boolean') throw new Error(`设置字段类型无效: ${key}`);
  for (const key of ['max_local_snapshots', 'max_cloud_backups', 'backup_file_interval', 'scheduled_sync_interval']) {
    if (key in s && (!Number.isSafeInteger(s[key]) || Number(s[key]) < 1 || Number(s[key]) > 10080)) throw new Error(`设置数值无效: ${key}`);
  }
  for (const key of ['webdav_url', 'gist_endpoint']) if (s[key]) {
    const url = new URL(s[key] as string);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error(`设置地址无效: ${key}`);
  }
  if (s.storage_type !== undefined && !['webdav', 'gist'].includes(s.storage_type as string)) throw new Error('不支持的存储类型');
  if (s.app_language !== undefined && !['auto', 'zh-CN', 'en'].includes(s.app_language as string)) throw new Error('不支持的语言');
  if (s.sync_scope !== undefined) {
    if (!s.sync_scope || typeof s.sync_scope !== 'object' || Array.isArray(s.sync_scope)) throw new Error('同步范围无效');
    const entries = Object.entries(s.sync_scope);
    if (entries.some(([key, value]) => !['bookmarks-bar', 'other', 'mobile'].includes(key) || typeof value !== 'boolean') || !entries.some(([,value]) => value === true)) throw new Error('同步范围无效');
  }
  if (s.sync_safety_settings !== undefined) {
    const safety = s.sync_safety_settings as { enabled?: unknown; threshold?: unknown } | null;
    if (!safety || typeof safety.enabled !== 'boolean' || !Number.isFinite(safety.threshold) || Number(safety.threshold) < 10 || Number(safety.threshold) > 50) throw new Error('防误删配置无效');
  }
}
