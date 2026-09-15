import { useI18n } from '../i18n'
/**
 * 统一活跃云端存储调度 Hook (useActiveStorage)
 * 支持 WebDAV 与 GitHub Gist 动态切换与配置组装
 */
import { useCallback } from 'react'
import { useStorage } from './useStorage'
import type { GistConfig, StorageConfig, WebDAVConfig } from '../core/storage/types'

export interface ActiveStorageState {
  storageType: 'webdav' | 'gist'
  isConfigured: boolean
  isGist: boolean
  hostLabel: string
  accountLabel: string
  getConfig: () => StorageConfig
}

export function useActiveStorage(): ActiveStorageState {
  const { locale } = useI18n()
  const [storageType] = useStorage<'webdav' | 'gist'>('storage_type', 'webdav')
  const [webdavUrl] = useStorage('webdav_url', '')
  const [username] = useStorage('webdav_username', '')
  const [password] = useStorage('webdav_password', '')
  const [gistToken] = useStorage('gist_token', '')
  const [gistId] = useStorage('gist_id', '')
  const [gistEndpoint] = useStorage('gist_endpoint', 'https://api.github.com')

  const isGist = storageType === 'gist'
  const validUrl = (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }
  const isConfigured = isGist
    ? !!gistToken.trim() && !!gistId.trim() && validUrl(gistEndpoint.trim() || 'https://api.github.com')
    : validUrl(webdavUrl.trim()) && !!username.trim()

  const hostLabel = isGist
    ? (gistId.trim() ? `GitHub Gist (${gistId.trim().slice(0, 7)})` : 'GitHub Gist')
    : (() => {
        try {
          return webdavUrl.trim() ? new URL(webdavUrl.trim()).host : (locale === 'en' ? 'WebDAV not configured' : '未配置 WebDAV')
        } catch {
          return (locale === 'en' ? 'Custom WebDAV' : '自定义 WebDAV')
        }
      })()

  const accountLabel = isGist
    ? (gistToken.trim() ? (locale === 'en' ? 'GitHub token ready' : 'GitHub 个人令牌已就绪') : (locale === 'en' ? 'Configure a token in Settings' : '请在设置中配置 Token'))
    : (username.trim() ? `${locale === 'en' ? 'Account' : '用户'}: ${username.trim()}` : (locale === 'en' ? 'Configure credentials in Settings' : '请在设置中配置服务凭证'))

  const getConfig = useCallback((): StorageConfig => {
    if (isGist) {
      const gistConfig: GistConfig = {
        type: 'gist',
        token: gistToken.trim(),
        gistId: gistId.trim(),
        endpoint: gistEndpoint.trim() || 'https://api.github.com',
      }
      return gistConfig
    }

    const webdavConfig: WebDAVConfig = {
      type: 'webdav',
      url: webdavUrl.trim(),
      username: username.trim(),
      password,
    }
    return webdavConfig
  }, [isGist, gistToken, gistId, gistEndpoint, webdavUrl, username, password])

  return {
    storageType,
    isConfigured,
    isGist,
    hostLabel,
    accountLabel,
    getConfig,
  }
}
