/**
 * 设置页共享小组件（SettingsItem / SubPageHeader）
 * 自 SettingsView 拆出
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../../i18n'

// 设置项组件
export function SettingsItem({ icon: Icon, label, description, onClick }: {
  icon: React.ElementType
  label: string
  description?: string
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } }}
      className="flex items-center justify-between p-4 surface-card hover:bg-secondary/70 dark:hover:bg-secondary/60 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
  )
}

// 子页面头部
export function SubPageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        aria-label={t('repair.back')}
        onClick={onBack}
        className="w-8 h-8 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-foreground" />
      </button>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </div>
  )
}
