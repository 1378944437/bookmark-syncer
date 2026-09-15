import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useI18n } from '../../i18n'

export type FullTabNavKey = 'dashboard' | 'activity' | 'snapshots' | 'settings'

export function FullTabHeader({ activeNav, isOnline, isConfigured }: {
  activeNav: FullTabNavKey; isOnline: boolean; isConfigured: boolean
}) {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  const themeLabel = t('theme.current', { theme: t(`theme.${theme}`) })
  return <header className="console-page-header">
    <div>
      <p className="console-eyebrow">{t('fulltab.workspace')}</p>
      <h1 id="console-page-title">{t(`fulltab.nav.${activeNav}`)}</h1>
      <p className="console-page-description">{t(`fulltab.description.${activeNav}`)}</p>
    </div>
    <div className="console-header-actions">
      <span className={`console-status ${!isOnline ? 'is-offline' : !isConfigured ? 'is-pending' : ''}`}>
        <span aria-hidden="true" />
        {t(!isOnline ? 'fulltab.status.offline' : !isConfigured ? 'fulltab.status.unconfigured' : 'fulltab.status.online')}
      </span>
      <button type="button" className="console-icon-button" aria-label={themeLabel} title={themeLabel}
        onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}>
        <Icon size={18} />
      </button>
    </div>
  </header>
}
