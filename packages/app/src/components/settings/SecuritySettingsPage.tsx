/**
 * 端到端加密安全配置页面
 * 自主管理的专属安全设置页，展示加密标准与密钥配置
 */
import { KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { SubPageHeader } from './SettingsShared'
import { E2EEncryptionSection } from './E2EEncryptionSection'
import { SafetyGuardSection } from './SafetyGuardSection'

export function SecuritySettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [e2eEnabled] = useStorage('e2e_enabled', false)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SubPageHeader title={t('settings.security.title')} onBack={onBack} />
      <div className="space-y-4 pb-4">
        {/* 安全状态概览横幅 */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              e2eEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
            }`}>
              {e2eEnabled ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {e2eEnabled ? t('settings.security.badgeOn') : t('settings.security.badgeOff')}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <KeyRound className="w-3 h-3" />
                <span>{t('settings.security.algorithm')}: {t('settings.security.algorithmVal')}</span>
              </p>
            </div>
          </div>
        </div>

        {/* 核心加密配置表单区块 */}
        <E2EEncryptionSection />

        {/* 防误删安全防御区块 */}
        <SafetyGuardSection />
      </div>
    </div>
  )
}
