/**
 * GitHub Gist 存储驱动提供者 (GistStorageProvider)
 * 实现 IStorageProvider 契约，将 GistClient 适配到统一存储层
 */
import type { ConnectionTestResult, IStorageProvider, RemoteFileInfo } from '../../core/storage/provider-interface'
import type { GistConfig } from '../../core/storage/types'
import { GistClient } from './gist-client'

export class GistStorageProvider implements IStorageProvider {
  readonly type = 'gist' as const
  private client: GistClient

  constructor(config: GistConfig) {
    this.client = new GistClient(config)
  }

  /**
   * 连通性与权限测试
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this.client.testConnection()
  }

  /**
   * 下载 Gist 单文件内容
   */
  async getFile(path: string, signal?: AbortSignal): Promise<string> {
    const fileName = path.split('/').pop() || path
    const gist = await this.client.getGist(signal)
    const file = gist.files[fileName]

    if (!file) {
      throw new Error(`[GistStorageProvider] Gist 中未找到文件: ${fileName}`)
    }

    if (file.truncated && file.raw_url) {
      return this.client.fetchRaw(file.raw_url, signal)
    }

    return file.content ?? ''
  }

  /**
   * 写入/更新 Gist 单文件内容（自动产生一次新 Git Revision）
   */
  async putFile(path: string, content: string): Promise<void> {
    const fileName = path.split('/').pop() || path
    await this.client.updateGist({
      [fileName]: { content },
    })
  }

  /**
   * 创建远程目录（Gist 属于平铺文件集合，虚拟目录天然支持）
   */
  async createDirectory(): Promise<void> {
    return Promise.resolve()
  }

  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    const fileName = path.split('/').pop() || path
    // 顶层目录如 MarkSync/BookmarkSyncer 天然存在
    if (!fileName || fileName === 'MarkSync' || fileName === 'BookmarkSyncer') {
      return true
    }

    try {
      const gist = await this.client.getGist()
      return !!gist.files[fileName]
    } catch {
      return false
    }
  }

  /**
   * 列出 Gist 中托管的所有文件
   */
  async listFiles(dirPath: string): Promise<RemoteFileInfo[]> {
    try {
      const gist = await this.client.getGist()
      const lastModified = new Date(gist.updated_at).getTime()
      const files: RemoteFileInfo[] = []

      for (const [name, file] of Object.entries(gist.files)) {
        files.push({
          name: file.filename || name,
          path: `${dirPath}/${file.filename || name}`,
          lastModified,
          size: file.size,
        })
      }
      return files
    } catch (err) {
      console.warn('[GistStorageProvider] Failed to list files:', err)
      return []
    }
  }

  /**
   * 删除 Gist 中的指定文件
   */
  async deleteFile(path: string): Promise<void> {
    const fileName = path.split('/').pop() || path
    await this.client.updateGist({
      [fileName]: null,
    })
  }

  /**
   * 获取底层 GistClient 实例（供专属操作如一键自动创建 Gist 使用）
   */
  getClient(): GistClient {
    return this.client
  }
}
