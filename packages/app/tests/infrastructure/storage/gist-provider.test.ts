import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GistStorageProvider } from '@src/infrastructure/storage/gist-provider'
import { GistClient } from '@src/infrastructure/storage/gist-client'
import { createStorageProvider } from '@src/infrastructure/storage/provider-factory'
import { getStorageIdentifier } from '@src/core/storage/types'

describe('GistClient & GistStorageProvider 测试', () => {
  const mockConfig = {
    token: 'ghp_mock_token_123456',
    gistId: 'gist_mock_id_789',
    endpoint: 'https://api.github.com',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('GistStorageProvider 正确声明驱动类型为 gist', () => {
    const provider = new GistStorageProvider(mockConfig)
    expect(provider.type).toBe('gist')
  })

  it('testConnection 在 Gist 存在且权限正常时返回 { ok: true }', async () => {
    const provider = new GistStorageProvider(mockConfig)
    const client = provider.getClient()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gist_mock_id_789' }),
    } as any)

    const res = await provider.testConnection()
    expect(res.ok).toBe(true)
  })

  it('testConnection 在 Token 无效或 401 时返回友好的错误提示', async () => {
    const provider = new GistStorageProvider(mockConfig)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
    } as any)

    const res = await provider.testConnection()
    expect(res.ok).toBe(false)
    expect(res.message).toContain('401')
  })

  it('createGist 发起 POST 请求自动创建私密 Gist 并返回 ID', async () => {
    const client = new GistClient(mockConfig)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'new_created_gist_id',
        updated_at: '2026-09-14T10:00:00Z',
      }),
    } as any)

    const result = await client.createGist('测试备份', false)
    expect(result.id).toBe('new_created_gist_id')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/gists',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('putFile 通过 PATCH 调用更新指定文件', async () => {
    const provider = new GistStorageProvider(mockConfig)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gist_mock_id_789' }),
    } as any)

    await provider.putFile('/MarkSync/bookmarks_test.json.gz', 'mock_gz_content')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/gists/gist_mock_id_789',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          files: {
            'bookmarks_test.json.gz': { content: 'mock_gz_content' },
          },
        }),
      })
    )
  })

  it('getFile 正确提取 Gist 中的文件内容', async () => {
    const provider = new GistStorageProvider(mockConfig)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'gist_mock_id_789',
        files: {
          'bookmarks.json': {
            filename: 'bookmarks.json',
            content: '{"hello":"world"}',
            size: 17,
          },
        },
      }),
    } as any)

    const content = await provider.getFile('bookmarks.json')
    expect(content).toBe('{"hello":"world"}')
  })

  it('deleteFile 发送 null 值删除文件', async () => {
    const provider = new GistStorageProvider(mockConfig)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gist_mock_id_789' }),
    } as any)

    await provider.deleteFile?.('/MarkSync/old_backup.json')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/gists/gist_mock_id_789',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          files: {
            'old_backup.json': null,
          },
        }),
      })
    )
  })

  it('createStorageProvider 正确识别 Gist 配置', () => {
    const provider = createStorageProvider({
      token: 'ghp_token',
      gistId: 'gist_id',
    })
    expect(provider.type).toBe('gist')
  })

  it('createStorageProvider 正确识别 WebDAV 配置', () => {
    const provider = createStorageProvider({
      url: 'https://dav.example.com',
      username: 'user',
      password: 'pwd',
    })
    expect(provider.type).toBe('webdav')
  })

  it('getStorageIdentifier 对 Gist 与 WebDAV 正确生成状态存储目标标识', () => {
    expect(getStorageIdentifier({ token: 't', gistId: 'gist_abc' })).toBe('gist://gist_abc')
    expect(getStorageIdentifier({ url: 'https://dav.example.com', username: 'u', password: 'p' })).toBe('https://dav.example.com')
  })
})

