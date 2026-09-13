/**
 * 通用设置子页面（外观主题、语言等）
 * 自 SettingsView 拆出
 */
import { Monitor, Moon, Sun } from 'lucide-react'
import { useI18n, writeLanguageSetting, type LanguageSetting } from '../../i18n'
import { Label } from '../Label'
import { useStorage } from '../../hooks/useStorage'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../infrastructure/utils/format'
import { SubPageHeader } from './SettingsShared'

// 外观主题选项（与 TabNav 图标按钮循环的三态一致）
const THEME_OPTIONS = [
  { value: 'light' as const, icon: Sun, labelKey: 'theme.light' },
  { value: 'dark' as const, icon: Moon, labelKey: 'theme.dark' },
  { value: 'system' as const, icon: Monitor, labelKey: 'theme.system' },
]

// 通用/语言设置子页面
export function GeneralSettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [languageSetting, setLanguageSetting] = useStorage<LanguageSetting>('app_language', 'auto')
  const { locale } = useI18n()
  const { theme, setTheme } = useTheme()

  const handleLanguageChange = async (value: LanguageSetting) => {
    setLanguageSetting(value)
    await writeLanguageSetting(value)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.general.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 外观主题 */}
        <div className="space-y-2 p-4 surface-card">
          <Label className="text-foreground">{t('settings.general.appearance')}</Label>
          <p className="text-xs text-muted-foreground mb-2">{t('settings.general.appearanceDesc')}</p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border py-2.5 text-xs transition-colors',
                  theme === value
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-secondary/70 dark:hover:bg-secondary/60'
                )}
              >
                <Icon className="w-4 h-4" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* 语言 */}
        <div className="space-y-2 p-4 surface-card">
          <Label className="text-foreground">{t('settings.general.language')}</Label>
          <p className="text-xs text-muted-foreground mb-2">{t('settings.general.languageDesc')}</p>
          <select
            value={languageSetting}
            onChange={(e) => handleLanguageChange(e.target.value as LanguageSetting)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
          >
            <option value="auto">{t('settings.general.language.auto')}</option>
            <option value="zh-CN">{t('settings.general.language.zh-CN')}</option>
            <option value="en">{t('settings.general.language.en')}</option>
          </select>
          {languageSetting === 'auto' && (
            <p className="text-xs text-muted-foreground mt-1">
              ({t('settings.general.currentLocale')}: {locale})
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
