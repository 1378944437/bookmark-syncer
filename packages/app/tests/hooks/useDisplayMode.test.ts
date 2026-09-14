import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import browser from 'webextension-polyfill'
import { openInFullTab } from '../../src/hooks/useDisplayMode'

describe('useDisplayMode Hook & openInFullTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('openInFullTab 调用 browser.tabs.create 打开新标签页', async () => {
    await openInFullTab()
    expect(browser.runtime.getURL).toHaveBeenCalledWith('index.html?mode=tab')
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://mock-id/index.html?mode=tab'
    })
  })

  it('在无 browser.tabs 时平滑降级调用 window.open', async () => {
    const originalTabs = browser.tabs
    // @ts-ignore
    delete browser.tabs
    const mockOpen = vi.fn()
    // @ts-ignore
    globalThis.window = { open: mockOpen } as any

    await openInFullTab()
    expect(mockOpen).toHaveBeenCalledWith('chrome-extension://mock-id/index.html?mode=tab', '_blank')

    // 恢复 mock
    browser.tabs = originalTabs
    // @ts-ignore
    delete globalThis.window
  })
})
