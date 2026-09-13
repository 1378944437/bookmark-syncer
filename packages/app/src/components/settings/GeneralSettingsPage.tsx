/**
 * 通用设置子页面（语言等）
 * 自 SettingsView 拆出
 */
import { useI18n, writeLanguageSetting, type LanguageSetting } from '../../i18n'
import { Label } from '../Label'
import { useStorage } from '../../hooks/useStorage'
import { SubPageHeader } from './SettingsShared'

// 通用/语言设置子页面
export function GeneralSettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [languageSetting, setLanguageSetting] = useStorage<LanguageSetting>('app_language', 'auto')
  const { locale } = useI18n()

  const handleLanguageChange = async (value: LanguageSetting) => {
    setLanguageSetting(value)
    await writeLanguageSetting(value)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.general.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 语言 */}
        <div className="space-y-2 p-4 rounded-xl bg-secondary/30">
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
