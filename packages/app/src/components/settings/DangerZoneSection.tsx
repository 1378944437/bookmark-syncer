/**
 * 危险操作区配置区块组件
 * 包含清空本地书签、清空云端备份与恢复出厂设置等高风险操作，均附带二次确认与自动备份机制
 */
import { useState } from "react";
import { BookmarkX, CloudOff, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../Button";
import {
  clearCloudBackups,
  clearLocalBookmarks,
  resetFactorySettings,
} from "../../core/sync/danger-operations";
import { useStorage } from "../../hooks/useStorage";

export function DangerZoneSection() {
  const [webdavUrl] = useStorage("webdav_url", "");
  const [username] = useStorage("webdav_username", "");
  const [password] = useStorage("webdav_password", "");

  const [confirmMode, setConfirmMode] = useState<"local" | "cloud" | "factory" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const getConfig = () => ({
    url: webdavUrl.trim(),
    username: username.trim(),
    password,
  });

  const handleClearLocal = async () => {
    setIsProcessing(true);
    try {
      const res = await clearLocalBookmarks();
      toast.success(`已清空本地书签（共删除 ${res.deletedCount} 项）`, {
        description: `已自动创建快照 #${res.snapshotId}，随时可在快照历史中撤销恢复`,
      });
      setConfirmMode(null);
    } catch (err) {
      toast.error("清空本地书签失败", { description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearCloud = async () => {
    if (!webdavUrl.trim()) {
      toast.error("尚未配置 WebDAV 服务器");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await clearCloudBackups(getConfig());
      toast.success(`云端备份已清空（删除了 ${res.deletedCount} 份文件）`);
      setConfirmMode(null);
    } catch (err) {
      toast.error("清空云端备份失败", { description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFactoryReset = async () => {
    setIsProcessing(true);
    try {
      await resetFactorySettings();
      toast.success("插件已恢复出厂设置", {
        description: "所有配置与本地快照已清除，插件即将重新加载",
      });
      setConfirmMode(null);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      toast.error("恢复出厂设置失败", { description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-3.5 space-y-3.5">
      <div className="flex items-center gap-2 text-destructive">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span className="text-xs font-semibold">危险操作区 (Danger Zone)</span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        以下操作具有破坏性或不可逆风险，请谨慎点击。本地清空将自动为您创建本地快照以便随时回滚。
      </p>

      {/* 清空本地书签 */}
      <div className="p-3 rounded-lg border border-border/70 bg-background/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <BookmarkX className="w-3.5 h-3.5 text-destructive" />
              清空本地所有书签
            </div>
            <div className="text-[10px] text-muted-foreground">
              清空浏览器内所有书签与文件夹（保留系统根目录，清空前自动创建快照备份）
            </div>
          </div>
          {confirmMode !== "local" ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
              onClick={() => setConfirmMode("local")}
            >
              清空本地
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmMode(null)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2.5 text-xs"
                disabled={isProcessing}
                onClick={handleClearLocal}
              >
                确认清空
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 清空云端备份 */}
      <div className="p-3 rounded-lg border border-border/70 bg-background/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <CloudOff className="w-3.5 h-3.5 text-destructive" />
              清空云端历史备份
            </div>
            <div className="text-[10px] text-muted-foreground">
              删除 WebDAV 上存储的全部历史备份文件并清空云端缓存
            </div>
          </div>
          {confirmMode !== "cloud" ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
              onClick={() => setConfirmMode("cloud")}
            >
              清空云端
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmMode(null)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2.5 text-xs"
                disabled={isProcessing}
                onClick={handleClearCloud}
              >
                确认删除
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 恢复出厂设置 */}
      <div className="p-3 rounded-lg border border-border/70 bg-background/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <RefreshCcw className="w-3.5 h-3.5 text-destructive" />
              恢复插件出厂设置
            </div>
            <div className="text-[10px] text-muted-foreground">
              清空插件的所有本地配置、登录凭证与本地快照，恢复为初始安装状态
            </div>
          </div>
          {confirmMode !== "factory" ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
              onClick={() => setConfirmMode("factory")}
            >
              恢复出厂
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmMode(null)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2.5 text-xs"
                disabled={isProcessing}
                onClick={handleFactoryReset}
              >
                确认重置
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
