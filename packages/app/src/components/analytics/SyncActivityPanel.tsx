/**
 * 同步活动与历史日志抽屉面板
 * 聚合展示近期 14 天活跃热力图与最近 100 条同步日志流
 */
import { useEffect, useState } from "react";
import { Activity, Clock, Trash2, ArrowUpRight, ArrowDownLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  clearSyncLogs,
  getDailyActivities,
  getSyncLogs,
  type DailyActivity,
  type SyncLogEntry,
} from "../../core/analytics/sync-analytics";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { Button } from "../Button";
import { cn } from "../../infrastructure/utils/format";

export function SyncActivityPanel({
  maxHeightClass = "max-h-[260px]",
}: {
  maxHeightClass?: string;
} = {}) {
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [act, l] = await Promise.all([getDailyActivities(14), getSyncLogs()]);
      setActivities(act);
      setLogs(l);
    } catch (error) {
      console.error("[SyncActivityPanel] Failed to load activity data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleClear = async () => {
    await clearSyncLogs();
    await loadData();
    toast.success("同步日志已清空");
  };

  const getActionBadge = (action: SyncLogEntry["action"]) => {
    switch (action) {
      case "uploaded":
        return (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
            <ArrowUpRight className="w-3 h-3" /> 上传
          </span>
        );
      case "downloaded":
      case "merged":
        return (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-medium">
            <ArrowDownLeft className="w-3 h-3" /> {action === "merged" ? "合并" : "下载"}
          </span>
        );
      case "skipped":
        return (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border font-medium">
            <CheckCircle2 className="w-3 h-3" /> 无变动
          </span>
        );
      case "error":
      default:
        return (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium">
            <AlertCircle className="w-3 h-3" /> 失败
          </span>
        );
    }
  };

  const getTriggerLabel = (trigger: SyncLogEntry["trigger"]) => {
    switch (trigger) {
      case "manual":
        return "手动";
      case "schedule":
        return "定时";
      case "auto":
      default:
        return "自动";
    }
  };

  return (
    <div className="space-y-3.5 pt-1 pb-2">
      {/* 活跃度热力图 */}
      <ActivityHeatmap activities={activities} />

      {/* 日志列表标题与操作 */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span>历史同步明细 ({logs.length})</span>
        </div>

        {logs.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive gap-1"
            onClick={handleClear}
          >
            <Trash2 className="w-3 h-3" /> 清空日志
          </Button>
        )}
      </div>

      {/* 历史日志流列表 */}
      <div className={cn("space-y-2 overflow-y-auto pr-0.5", maxHeightClass)}>
        {logs.map((log) => (
          <div
            key={log.id}
            className="p-2.5 rounded-xl border border-border bg-card/40 hover:bg-card/70 transition-colors space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {getActionBadge(log.action)}
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border/50 font-mono">
                  {getTriggerLabel(log.trigger)}
                </span>
                {log.diff && (log.diff.added > 0 || log.diff.updated > 0 || log.diff.deleted > 0) && (
                  <div className="flex items-center gap-1 text-[9px] font-mono font-semibold">
                    {log.diff.added > 0 && <span className="text-emerald-600">+{log.diff.added}</span>}
                    {log.diff.updated > 0 && <span className="text-sky-600">~{log.diff.updated}</span>}
                    {log.diff.deleted > 0 && <span className="text-rose-600">-{log.diff.deleted}</span>}
                  </div>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5 shrink-0">
                <Clock className="w-2.5 h-2.5" />
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground truncate">{log.message}</p>
          </div>
        ))}

        {!loading && logs.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            暂无同步历史日志
          </div>
        )}
      </div>
    </div>
  );
}
