/**
 * 冲突处理抽屉面板
 * 当两端书签均有变动且无法无损自动合并时展示
 */
import { AlertTriangle, Cloud, FilePlus, ShieldCheck } from 'lucide-react'
import type { ClassValue } from 'clsx'
import { Button } from '../Button'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface ConflictPanelProps {
  t: Translate
  cn: (...inputs: ClassValue[]) => string
  isOnline: boolean
  isSyncBusy: boolean
  localCount: number
  cloudCount: number
  cloudMeta: { time: number; device: string; count: number; browser?: string } | null
  executePull: (mode: 'overwrite' | 'merge') => void
  forceNewBackup: () => void
  requestForcePush: () => void
}

export function ConflictPanel({
  t,
  cn,
  isOnline,
  isSyncBusy,
  localCount,
  cloudCount,
  cloudMeta,
  executePull,
  forceNewBackup,
  requestForcePush,
}: ConflictPanelProps) {
  return (
    <div className="space-y-4 pt-2">
      {/* 冲突提示与跨设备警告 */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-400 dark:border-amber-500/20 p-4 rounded-xl flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-foreground mb-1">{t('sync.conflict.title')}</h4>
          <p className="text-xs text-foreground/70 leading-relaxed">
            {t('sync.conflict.cloudHas', { count: cloudCount })}
            {cloudMeta?.browser && <span className="text-muted-foreground"> ({cloudMeta.browser})</span>}
            {t('sync.conflict.updatedAt', {
              time: cloudMeta ? new Date(cloudMeta.time).toLocaleTimeString() : t('sync.conflict.unknownTime'),
            })}
            <br />
            {t('sync.conflict.localHas', { count: localCount })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className={cn(
            "h-20 flex flex-col gap-1 hover:bg-accent hover:text-accent-foreground",
            (!isOnline || isSyncBusy) && "opacity-50"
          )}
          onClick={() => executePull('overwrite')}
          disabled={!isOnline || isSyncBusy}
        >
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <span className="text-foreground text-sm">{t('sync.conflict.restoreLocal')}</span>
          <span className="text-[10px] text-muted-foreground">{t('sync.conflict.restoreLocalDesc')}</span>
        </Button>
        <Button
          className={cn(
            "h-20 flex flex-col gap-1",
            (localCount === 0 || !isOnline || isSyncBusy) && "opacity-50"
          )}
          onClick={requestForcePush}
          disabled={localCount === 0 || !isOnline || isSyncBusy}
        >
          {localCount === 0 ? (
            <>
              <Cloud className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-foreground/50">{t('sync.conflict.uploadForbidden')}</span>
              <span className="text-[10px] text-foreground/30">{t('sync.conflict.uploadForbiddenDesc')}</span>
            </>
          ) : (
            <>
              <Cloud className="w-5 h-5" />
              <span className="text-sm">{t('sync.conflict.uploadCloud')}</span>
              <span className="text-[10px] text-primary-foreground/70">{t('sync.conflict.uploadCloudDesc')}</span>
            </>
          )}
        </Button>
      </div>

      {/* 强制新备份按钮 */}
      <div className="flex justify-end mt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={forceNewBackup}
        >
          <FilePlus className="w-3 h-3" />
          {t('sync.conflict.forceNewBackup')}
        </Button>
      </div>
    </div>
  )
}
