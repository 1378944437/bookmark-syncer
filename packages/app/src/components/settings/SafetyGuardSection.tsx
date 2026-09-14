/**
 * 防误删安全防御配置区块
 * 支持开启/关闭防误删熔断保护及自定义删除百分比阈值
 */
import { ShieldAlert, Percent, AlertCircle } from "lucide-react";
import { useI18n } from "../../i18n";
import { useStorage } from "../../hooks/useStorage";
import { SettingGroup, SettingRow } from "./SettingRow";
import { Button } from "../Button";
import {
  DEFAULT_SAFETY_SETTINGS,
  type SafetySettings,
} from "../../core/sync/utils/safety-guard";

export function SafetyGuardSection() {
  const { t } = useI18n();
  const [settings, setSettings] = useStorage<SafetySettings>(
    "sync_safety_settings",
    DEFAULT_SAFETY_SETTINGS
  );

  const enabled = settings?.enabled ?? true;
  const threshold = settings?.threshold ?? 20;

  const handleToggleEnabled = (val: boolean) => {
    setSettings({ ...settings, enabled: val });
  };

  const handleSetThreshold = (val: number) => {
    const clamped = Math.max(10, Math.min(50, Math.round(val)));
    setSettings({ ...settings, threshold: clamped });
  };

  return (
    <SettingGroup title={t("settings.safety.group")}>
      <SettingRow
        icon={ShieldAlert}
        iconColor="text-rose-600 bg-rose-500/10 dark:text-rose-400"
        label={t("settings.safety.enable")}
        description={t("settings.safety.enableDesc")}
        type="switch"
        checked={enabled}
        onCheckedChange={handleToggleEnabled}
      />

      {enabled && (
        <div className="p-3.5 space-y-3 bg-muted/30 border-t border-border/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs text-foreground font-medium flex items-center gap-1">
                <Percent className="w-3 h-3 text-rose-500" />
                {t("settings.safety.threshold")}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t("settings.safety.thresholdDesc")}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              {threshold}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[10, 15, 20, 30, 50].map((val) => (
              <Button
                key={val}
                size="sm"
                variant={threshold === val ? "default" : "outline"}
                className={`text-xs h-6 px-2 flex-1 font-mono ${
                  threshold === val
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => handleSetThreshold(val)}
              >
                {val}%
              </Button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1 pt-0.5">
            <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
            <span>单次批量删除超过 10 条且占当前总书签比例达到上述阈值即触发熔断拦截。</span>
          </p>
        </div>
      )}
    </SettingGroup>
  );
}
