/**
 * 关闭端到端加密二次防手滑确认卡片组件
 */
import { AlertTriangle } from 'lucide-react'
import { Button } from '../Button'

export interface DisableE2EConfirmCardProps {
  onCancel: () => void
  onConfirm: () => void
  t: (key: string) => string
}

export function DisableE2EConfirmCard({ onCancel, onConfirm, t }: DisableE2EConfirmCardProps) {
  return (
    <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <h4 className="text-xs font-semibold text-foreground">
            {t('settings.security.disableConfirmTitle')}
          </h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t('settings.security.disableConfirmDesc')}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs px-2.5"
        >
          {t('settings.security.cancel')}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onConfirm}
          className="h-7 text-xs px-3"
        >
          {t('settings.security.disableConfirmBtn')}
        </Button>
      </div>
    </div>
  )
}
