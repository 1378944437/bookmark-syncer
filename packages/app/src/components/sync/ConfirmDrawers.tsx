/**
 * 二次确认模态对话框（覆盖云端 / 恢复快照或云端备份）
 * 居中模态弹窗呈现高风险操作警示，避免抽屉嵌套与手势层级混乱
 */
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { Snapshot } from "../../core/backup";
import type { CloudBackupFile } from "../../core/sync";
import { Button } from "../Button";
import { Modal } from "../Modal";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface OverwriteConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  online: boolean;
  localCount: number;
  t: Translate;
}

/**
 * 覆盖云端二次确认对话框
 */
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
    <Modal isOpen={isOpen} onClose={onClose} title={t("sync.confirmPush.title")}>
      <div className="space-y-4 pt-1">
        <div className="bg-destructive/10 border border-destructive/20 p-3.5 rounded-xl flex gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-foreground mb-1">
              {t("sync.confirmPush.heading")}
            </h4>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {t("sync.confirmPush.body1")}
              <br />
              {t("sync.confirmPush.body2")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy || !online || localCount === 0}
            className="rounded-xl"
          >
            {t("sync.confirmPush.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export interface RestoreConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: Snapshot | null;
  cloudBackup: CloudBackupFile | null;
  onConfirmSnapshot: () => void;
  onConfirmCloudBackup: () => void;
  t: Translate;
}

/**
 * 恢复快照 / 云端备份二次确认对话框
 */
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
    <Modal isOpen={isOpen} onClose={onClose} title={t("sync.confirmRestore.title")}>
      {(snapshot || cloudBackup) && (
        <div className="space-y-4 pt-1">
          <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-foreground mb-1">
                {snapshot
                  ? t("sync.confirmRestore.snapshotTitle")
                  : t("sync.confirmRestore.cloudTitle")}
              </h4>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {snapshot ? (
                  <>
                    {t("sync.confirmRestore.snapshotBody1", {
                      time: new Date(snapshot.timestamp).toLocaleString(),
                    })}
                    <br />
                    {t("sync.confirmRestore.snapshotBody2", {
                      count: snapshot.count,
                    })}
                    <br />
                    {t("sync.confirmRestore.overwriteAll")}
                  </>
                ) : cloudBackup ? (
                  <>
                    {t("sync.confirmRestore.cloudBody1", {
                      time: new Date(cloudBackup.timestamp).toLocaleString(),
                    })}
                    <br />
                    {cloudBackup.totalCount &&
                      t("sync.confirmRestore.snapshotBody2", {
                        count: cloudBackup.totalCount,
                      })}
                    <br />
                    {cloudBackup.browser &&
                      t("sync.confirmRestore.cloudBody3", {
                        browser: cloudBackup.browser,
                      })}
                    <br />
                    {t("sync.confirmRestore.cloudBody4")}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={snapshot ? onConfirmSnapshot : onConfirmCloudBackup}
              className="rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              {t("sync.confirmRestore.confirm")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// 导出别名以便于更清晰的语义引用
export {
  OverwriteConfirmDrawer as OverwriteConfirmModal,
  RestoreConfirmDrawer as RestoreConfirmModal,
};
