/**
 * 二次确认抽屉（覆盖云端 / 恢复快照或云端备份）
 * 自 SyncView 拆出的展示型组件：状态与业务逻辑仍由 SyncView 持有，
 * 通过 props 传入，避免闭包语义变化
 */
import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { Snapshot } from '../../core/backup'
import type { CloudBackupFile } from '../../core/sync'
import { Button } from '../Button'
import { Drawer } from '../Drawer'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface OverwriteConfirmDrawerProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  busy: boolean
  online: boolean
  localCount: number
  t: Translate
}

export function OverwriteConfirmDrawer({
  isOpen,
  onClose,
  onConfirm,
  busy,
  online,
  localCount,
  t,
}: OverwriteConfirmDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={t('sync.confirmPush.title')}>
      <div className="space-y-4 pt-2">
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-foreground mb-1">{t('sync.confirmPush.heading')}</h4>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {t('sync.confirmPush.body1')}<br />
              {t('sync.confirmPush.body2')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy || !online || localCount === 0}
          >
            {t('sync.confirmPush.confirm')}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

export interface RestoreConfirmDrawerProps {
  isOpen: boolean
  onClose: () => void
  snapshot: Snapshot | null
  cloudBackup: CloudBackupFile | null
  onConfirmSnapshot: () => void
  onConfirmCloudBackup: () => void
  t: Translate
}

export function RestoreConfirmDrawer({
  isOpen,
  onClose,
  snapshot,
  cloudBackup,
  onConfirmSnapshot,
  onConfirmCloudBackup,
  t,
}: RestoreConfirmDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={t('sync.confirmRestore.title')}>
      {(snapshot || cloudBackup) && (
        <div className="space-y-4 pt-2">
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-400 dark:border-amber-500/20 p-4 rounded-xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-foreground mb-1">
                {snapshot ? t('sync.confirmRestore.snapshotTitle') : t('sync.confirmRestore.cloudTitle')}
              </h4>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {snapshot ? (
                  <>
                    {t('sync.confirmRestore.snapshotBody1', { time: new Date(snapshot.timestamp).toLocaleString() })}<br />
                    {t('sync.confirmRestore.snapshotBody2', { count: snapshot.count })}<br />
                    {t('sync.confirmRestore.overwriteAll')}
                  </>
                ) : cloudBackup ? (
                  <>
                    {t('sync.confirmRestore.cloudBody1', { time: new Date(cloudBackup.timestamp).toLocaleString() })}<br />
                    {cloudBackup.totalCount && t('sync.confirmRestore.snapshotBody2', { count: cloudBackup.totalCount })}<br />
                    {cloudBackup.browser && t('sync.confirmRestore.cloudBody3', { browser: cloudBackup.browser })}<br />
                    {t('sync.confirmRestore.cloudBody4')}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={snapshot ? onConfirmSnapshot : onConfirmCloudBackup}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('sync.confirmRestore.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
