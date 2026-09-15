import { ArrowRight, Cloud, Laptop, LockKeyhole, RefreshCw } from 'lucide-react'
import { SyncView } from '../SyncView'
import { useActiveStorage } from '../../hooks/useActiveStorage'
import { useStorage } from '../../hooks/useStorage'
import { useI18n } from '../../i18n'
import { FullTabActivity } from './FullTabActivity'
import type { FullTabNavKey } from './FullTabHeader'

export function FullTabDashboard({ onNavigate }: { onNavigate: (nav: FullTabNavKey) => void }) {
  const { t } = useI18n()
  const { isConfigured, isGist, hostLabel } = useActiveStorage()
  const [device] = useStorage('device_name', '')
  const [encrypted] = useStorage('e2e_enabled', false)
  const [automatic] = useStorage('auto_sync_enabled', true)
  const details = [
    { icon: Laptop, label: t('fulltab.device'), value: device || t('fulltab.thisDevice') },
    { icon: LockKeyhole, label: t('fulltab.encryption'), value: t(encrypted ? 'fulltab.enabled' : 'fulltab.disabled') },
    { icon: RefreshCw, label: t('fulltab.autoSync'), value: t(automatic ? 'fulltab.enabled' : 'fulltab.disabled') },
  ]
  return <div className="console-stack">
    <div className="console-dashboard-grid">
      <section className="console-panel console-sync-panel" aria-label={t('fulltab.syncTitle')}>
        <div className="console-section-heading"><div><h2>{t('fulltab.syncTitle')}</h2><p>{t('fulltab.syncHint')}</p></div></div>
        <SyncView />
      </section>
      <section className="console-panel console-connection" aria-label={t('fulltab.connection')}>
        <div className="console-section-heading"><h2>{t('fulltab.connection')}</h2><Cloud size={19} /></div>
        <div className="console-provider"><span>{isGist ? 'GitHub Gist' : 'WebDAV'}</span>
          <strong>{isConfigured ? hostLabel : t('fulltab.status.unconfigured')}</strong>
          <p>{t('fulltab.connectionHint')}</p></div>
        <dl className="console-detail-list">{details.map(({ icon: Icon, label, value }) => <div key={label}>
          <dt><Icon size={16} />{label}</dt><dd title={value}>{value}</dd>
        </div>)}</dl>
        <button className="console-text-button" type="button" onClick={() => onNavigate('settings')}>
          {t('fulltab.manageConnection')}<ArrowRight size={16} />
        </button>
      </section>
    </div>
    <section className="console-panel">
      <div className="console-section-heading"><div><h2>{t('fulltab.recentActivity')}</h2><p>{t('fulltab.recentHint')}</p></div>
        <button className="console-text-button" type="button" onClick={() => onNavigate('activity')}>{t('fulltab.viewAll')}<ArrowRight size={16} /></button>
      </div>
      <FullTabActivity compact />
    </section>
  </div>
}
