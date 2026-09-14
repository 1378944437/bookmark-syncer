/**
 * 近期同步活动热力图组件
 * 纯 SVG + TailwindCSS 实现轻量 GitHub 风格贡献格子与 14 天频次热度
 */
import type { DailyActivity } from "../../core/analytics/sync-analytics";

export interface ActivityHeatmapProps {
  activities: DailyActivity[];
}

export function ActivityHeatmap({ activities }: ActivityHeatmapProps) {
  const totalSyncs = activities.reduce((sum, item) => sum + item.count, 0);
  const totalAdded = activities.reduce((sum, item) => sum + item.added, 0);
  const totalUpdated = activities.reduce((sum, item) => sum + item.updated, 0);
  const totalDeleted = activities.reduce((sum, item) => sum + item.deleted, 0);

  const getLevelColor = (count: number) => {
    if (count === 0) return "bg-muted/50 border-border/40 text-transparent";
    if (count <= 2) return "bg-emerald-500/25 border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
    if (count <= 5) return "bg-emerald-500/50 border-emerald-500/60 text-white";
    return "bg-emerald-600 border-emerald-700 text-white font-bold";
  };

  return (
    <div className="p-3.5 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-3 select-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">近 14 天同步活跃度</span>
        <span className="text-[10px] text-muted-foreground font-mono">
          累计 {totalSyncs} 次同步
        </span>
      </div>

      {/* 14 天热力方格横轴排列 */}
      <div className="grid grid-cols-7 gap-1.5 pt-1">
        {activities.map((act) => {
          const dayLabel = act.date.slice(5); // "MM-DD"
          const tooltip = `${act.date}: 同步 ${act.count} 次 (+${act.added} / ~${act.updated} / -${act.deleted})`;

          return (
            <div
              key={act.date}
              title={tooltip}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div
                className={`w-full aspect-square rounded-md border flex items-center justify-center text-[10px] font-mono transition-transform group-hover:scale-110 ${getLevelColor(
                  act.count
                )}`}
              >
                {act.count > 0 ? act.count : ""}
              </div>
              <span className="text-[9px] text-muted-foreground font-mono group-hover:text-foreground">
                {dayLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* 变动聚合微标统计 */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono">
        <span className="text-muted-foreground">近两周总计变动</span>
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-emerald-600 dark:text-emerald-400">+{totalAdded}</span>
          <span className="text-sky-600 dark:text-sky-400">~{totalUpdated}</span>
          <span className="text-rose-600 dark:text-rose-400">-{totalDeleted}</span>
        </div>
      </div>
    </div>
  );
}
