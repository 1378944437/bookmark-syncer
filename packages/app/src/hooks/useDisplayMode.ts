/**
 * 显示模式感知 Hook
 * 检测当前环境是紧凑弹窗（Popup）还是独立大屏控制台（Full-tab / Options）
 */
import { useEffect, useState } from 'react'
import browser from 'webextension-polyfill'
import { isMobileBrowser } from '../infrastructure/browser/info'

/**
 * 判断当前是否处于独立大屏模式
 */
function checkIsFullTab(): boolean {
  if (typeof window === 'undefined') return false

  // 1. 检查 URL 参数
  const params = new URLSearchParams(window.location.search)
  if (params.get('mode') === 'tab' || window.location.hash.includes('mode=tab')) {
    return true
  }

  // 2. 检查窗口视口宽度（弹窗通常固定 <= 420px，独立标签页通常 >= 600px）
  return window.innerWidth >= 640
}

/**
 * 在新标签页中打开全屏控制台
 */
export async function openInFullTab(): Promise<void> {
  try {
    const targetUrl = browser.runtime?.getURL?.('index.html?mode=tab') || 'index.html?mode=tab'
    if (browser.tabs?.create) {
      await browser.tabs.create({ url: targetUrl })
    } else if (typeof window !== 'undefined' && window.open) {
      window.open(targetUrl, '_blank')
    }
  } catch {
    if (typeof window !== 'undefined' && window.open) {
      window.open('index.html?mode=tab', '_blank')
    }
  }
}

export function useDisplayMode() {
  const [isFullTab, setIsFullTab] = useState<boolean>(checkIsFullTab)
  const [isMobile] = useState(isMobileBrowser)

  useEffect(() => {
    const handleResize = () => {
      setIsFullTab(checkIsFullTab())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    isFullTab,
    isMobile,
    openInFullTab,
  }
}
