/**
 * 存储提供者工厂 (StorageProviderFactory)
 * 统一实例化与管理存储提供者，为后续即插即用接入 GitHub / Gist 铺路
 */
import type { IStorageProvider } from '../../core/storage/provider-interface'
import type { WebDAVConfig } from '../../core/storage/types'
import { WebDAVStorageProvider } from './webdav-provider'

export interface StorageOptions {
  type?: 'webdav' | 'gist' | 'github'
  webdavConfig?: WebDAVConfig
}

/**
 * 创建存储驱动提供者
 */
export function createStorageProvider(
  config: WebDAVConfig | StorageOptions
): IStorageProvider {
  if ('url' in config && 'username' in config) {
    return new WebDAVStorageProvider(config as WebDAVConfig)
  }

  const options = config as StorageOptions
  if (options.webdavConfig) {
    return new WebDAVStorageProvider(options.webdavConfig)
  }

  throw new Error('[StorageProviderFactory] 未提供有效的存储驱动配置')
}
