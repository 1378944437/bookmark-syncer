/**
 * 防误删安全熔断二次确认警示卡片
 * 当检测到本地大规模删除触发熔断时展示，提供放行上传与一键恢复选项
 */
import { useState } from "react";
import { RotateCcw, ShieldAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useStorage } from "../../hooks/useStorage";
import {
  clearPendingSafetyConfirmation,
  type PendingSafetyConfirmation,
} from "../../core/sync/utils/safety-guard";
import { smartPushInBackground } from "../../application/background-ops";
import type { StorageConfig } from "../../core/storage/types";
import { Button } from "../Button";

export interface SafetyConfirmationCardProps {
  t: (key: string, vars?: Record<string, string | number>) => string;
  getConfig: () => StorageConfig;
  onOpenHistory: () => void;
  loadCounts?: () => void;
}

export function SafetyConfirmationCard({
  t,
  getConfig,
  onOpenHistory,
  loadCounts,
}: SafetyConfirmationCardProps) {
  const [pending, setPending] = useStorage<PendingSafetyConfirmation | null>(
    "pending_safety_confirmation",
    null
  );
  const [isPushing, setIsPushing] = useState(false);

  if (!pending) return null;

  const handleDismiss = async () => {
    await clearPendingSafetyConfirmation();
    setPending(null);
  };

  const handleConfirmPush = async () => {
    setIsPushing(true);
    try {
      const result = await smartPushInBackground(getConfig(), { skipSafetyGuard: true, confirmationId: pending.id });
      if (result.success) {
        toast.success(t("safety.banner.pushSuccess"));
        await clearPendingSafetyConfirmation();
        setPending(null);
        loadCounts?.();
      } else {
        toast.error("上传失败", { description: result.message });
      }
    } catch (error) {
      toast.error("上传发生异常", { description: (error as Error).message });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="mx-1 my-2 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/20 text-foreground relative shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <span>{t("safety.banner.title")}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-500/30">
              -{pending.deletedCount} ({pending.deletePercentage}%)
            </span>
          </h4>

          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {t("safety.banner.desc", {
              deleted: pending.deletedCount,
              percent: pending.deletePercentage,
              threshold: pending.threshold,
            })}
          </p>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5 bg-background/80 hover:bg-muted"
              onClick={onOpenHistory}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              {t("safety.banner.restoreSnapshot")}
            </Button>

            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white"
              disabled={isPushing}
              onClick={handleConfirmPush}
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {isPushing ? "正在上传..." : t("safety.banner.confirmPush")}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          title={t("safety.banner.dismiss")}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-rose-500/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
