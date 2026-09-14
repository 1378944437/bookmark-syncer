/**
 * 大屏控制台顶部导航栏
 * 包含品牌 Logo、大屏 Tab 切换、在线状态徽标与主题切换
 */
import { motion } from 'framer-motion'
import { Bookmark, Clock, Cloud, LayoutDashboard, Monitor, Moon, Settings, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useI18n } from '../../i18n'
import { cn } from '../../infrastructure/utils/format'

export type FullTabNavKey = 'dashboard' | 'snapshots' | 'settings'

interface FullTabHeaderProps {
  activeNav: FullTabNavKey
  onNavChange: (nav: FullTabNavKey) => void
  isOnline: boolean
  isConfigured: boolean
}

export function FullTabHeader({
  activeNav,
  onNavChange,
  isOnline,
  isConfigured,
}: FullTabHeaderProps) {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()

  const cycleTheme = () => {
    const order = ['dark', 'light', 'system'] as const
    const currentIndex = order.indexOf(theme)
    const nextIndex = (currentIndex + 1) % order.length
    setTheme(order[nextIndex])
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  const navItems = [
    { key: 'dashboard' as const, label: t('fulltab.nav.dashboard'), icon: LayoutDashboard },
    { key: 'snapshots' as const, label: t('fulltab.nav.snapshots'), icon: Clock },
    { key: 'settings' as const, label: t('fulltab.nav.settings'), icon: Settings },
  ]

  return (
    <header className="w-full flex flex-col md:flex-row md:items-center justify-between pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-border/60 gap-3 sm:gap-4">
      {/* 品牌与标题 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
          <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
              {t('fulltab.title')}
            </h1>
            <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Console
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            {t('fulltab.subtitle')}
          </p>
        </div>
      </div>

      {/* 导航与快捷操作 */}
      <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto">
        {/* 导航 Pills */}
        <nav className="flex-1 md:flex-initial flex items-center justify-between bg-muted/80 backdrop-blur-md p-1 rounded-full border border-border shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeNav === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavChange(item.key)}
                className={cn(
                  'relative flex-1 md:flex-initial px-2.5 sm:px-4 md:px-5 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition-colors z-10 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap',
                  isActive ? 'text-white font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="fullTabActiveNav"
                    className="absolute inset-0 bg-indigo-600 rounded-full -z-10 shadow-[0_2px_10px_rgba(99,102,241,0.35)]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs md:text-sm">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* 状态徽标与主题切换 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 在线状态 */}
          <div
            className={cn(
              'hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm',
              !isOnline
                ? 'bg-destructive/10 text-destructive border-destructive/20'
                : !isConfigured
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            )}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>
              {!isOnline
                ? t('fulltab.status.offline')
                : !isConfigured
                ? t('fulltab.status.unconfigured')
                : t('fulltab.status.online')}
            </span>
          </div>

          {/* 主题按钮 */}
          <button
            type="button"
            onClick={cycleTheme}
            className="p-2 sm:p-2.5 rounded-full transition-all border shadow-sm bg-muted/80 border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            title={t('theme.current', {
              theme:
                theme === 'dark'
                  ? t('theme.dark')
                  : theme === 'light'
                  ? t('theme.light')
                  : t('theme.system'),
            })}
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
