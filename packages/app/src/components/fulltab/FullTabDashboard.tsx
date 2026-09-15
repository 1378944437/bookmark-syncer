import { SyncView } from '../SyncView';
import { SyncActivityPanel } from '../analytics/SyncActivityPanel';

/** 共用完整的同步交互，保持弹窗和大屏的确认、冲突与错误处理一致。 */
export function FullTabDashboard() {
  return <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    <div className="lg:col-span-5 relative rounded-2xl border border-border bg-card p-4"><SyncView /></div>
    <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-4"><SyncActivityPanel maxHeightClass="max-h-[480px]" /></div>
  </div>;
}
