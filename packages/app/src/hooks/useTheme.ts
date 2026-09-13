/**
 * 主题钩子
 * 消费顶层 ThemeProvider 上下文，保留完全向后兼容的调用契约
 */
import { useThemeContext, type Theme, type ThemeContextType } from '../components/ThemeProvider'

export type { Theme, ThemeContextType }

export function useTheme(): ThemeContextType {
  return useThemeContext()
}
