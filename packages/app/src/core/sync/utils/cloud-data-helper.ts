/**
 * 云端数据辅助函数
 * 统一「下载 → （端到端解密）→ 解压 → 解析 → 结构校验」的通用流程，
 * 三大同步策略与云端恢复共用。空内容返回 null，由调用方按各自语义处理；
 * 格式损坏/结构无效抛出 CloudDataError（调用方一律中止，不得覆盖云端）
 */
import type { IWebDAVClient } from "../../../infrastructure/http/webdav-client";
import type { IStorageProvider } from "../../storage/provider-interface";
import type { CloudBackup } from "../../../types";
import { CloudDataError } from "../types";
import { queueManager } from "../../storage/queue-manager";

/**
 * 下载并校验云端备份
 *
 * @param client 存储客户端（IStorageProvider 或 IWebDAVClient）
 * @param path 备份文件路径（.json.gz 或加密的 .json.gz.enc）
 * @param opts.passphrase 端到端加密密码（.enc 备份必需，缺失时队列层抛出开启提示）
 * @returns 解析后的备份数据；文件内容为空时返回 null
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
    return null;
  }

  let data: CloudBackup;
  try {
    data = JSON.parse(json) as CloudBackup;
  } catch {
    throw new CloudDataError("云端备份数据格式损坏，无法解析");
  }
  if (!data.data || !Array.isArray(data.data)) {
    throw new CloudDataError("云端备份数据结构无效");
  }
  return data;
}
