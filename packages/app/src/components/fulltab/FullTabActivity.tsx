import { SyncActivityPanel } from '../analytics/SyncActivityPanel'
export function FullTabActivity({ compact = false }: { compact?: boolean } = {}) {
  return <SyncActivityPanel maxHeightClass={compact ? 'max-h-[230px]' : 'max-h-[calc(100vh-260px)]'} />
}
