/**
 * 云端数据辅助函数
 * 统一「下载 → （端到端解密）→ 解压 → 解析 → 结构校验」的通用流程，
 * 三大同步策略与云端恢复共用。空内容同样视为损坏并中止；
 * 格式损坏/结构无效抛出 CloudDataError（调用方一律中止，不得覆盖云端）
 */
import type { IWebDAVClient } from "../../../infrastructure/http/webdav-client";
import type { IStorageProvider } from "../../storage/provider-interface";
import type { CloudBackup } from "../../../types";
import { CloudDataError } from "../types";
import { queueManager } from "../../storage/queue-manager";
import { validateRestoreTree } from '../../bookmark/validation';
import { assignHashes } from '../../bookmark/hash-calculator';

/**
 * 下载并校验云端备份
 *
 * @param client 存储客户端（IStorageProvider 或 IWebDAVClient）
 * @param path 备份文件路径（.json.gz 或加密的 .json.gz.enc）
 * @param opts.passphrase 端到端加密密码（.enc 备份必需，缺失时队列层抛出开启提示）
 * @returns 解析后的合法备份数据
 */
export async function fetchValidatedCloudBackup(
  client: IStorageProvider | IWebDAVClient,
  path: string,
  opts: { passphrase?: string } = {},
): Promise<CloudBackup | null> {
  const json = await queueManager.getFileWithDedup(client, path, {
    passphrase: opts.passphrase,
  });
  if (!json) {
    throw new CloudDataError('云端备份为空，已停止同步');
  }

  let data: CloudBackup;
  try {
    data = JSON.parse(json) as CloudBackup;
  } catch {
    throw new CloudDataError("云端备份数据格式损坏，无法解析");
  }
  try { validateRestoreTree(data?.data); }
  catch { throw new CloudDataError("云端备份数据结构无效"); }
  // 不信任备份携带的旧 hash，统一按实际内容计算。
  data.data = await assignHashes(data.data);
  return data;
}
