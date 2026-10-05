import { useTranslation } from "react-i18next";
import { FontDetailedInfo } from "../../../types/font";

interface MetricsTabProps {
  details: FontDetailedInfo;
}

export function MetricsTab({ details }: MetricsTabProps) {
  const { t } = useTranslation();
  const { metrics, os2 } = details;

  return (
    <div className="space-y-4 text-xs text-theme-text">
      {/* 1. UPM 및 비율 메트릭 요약 배너 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-theme-text-muted mb-0.5">{t("font_info.metrics.units_per_em", "Units Per Em (UPM)")}</span>
          <span className="text-base font-bold font-mono text-theme-accent">{metrics.units_per_em}</span>
        </div>

        <div className="p-3 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-theme-text-muted mb-0.5">{t("font_info.metrics.cap_height", "Cap Height")}</span>
          <span className="text-base font-bold font-mono text-theme-text">
            {metrics.cap_height !== null && metrics.cap_height !== undefined ? metrics.cap_height : "-"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-theme-text-muted mb-0.5">{t("font_info.metrics.x_height", "X-Height")}</span>
          <span className="text-base font-bold font-mono text-theme-text">
            {metrics.x_height !== null && metrics.x_height !== undefined ? metrics.x_height : "-"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-theme-text-muted mb-0.5">{t("font_info.metrics.italic_angle", "Italic Angle")}</span>
          <span className="text-base font-bold font-mono text-theme-text">
            {metrics.italic_angle !== 0 ? `${metrics.italic_angle.toFixed(1)}°` : "0°"}
          </span>
        </div>
      </div>

      {/* 2. 타이포그래피 수직 메트릭 (Typo vs Win) */}
      <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-3">
        <h4 className="text-[11px] font-semibold text-theme-text uppercase tracking-wider">
          {t("font_info.metrics.typo_metrics")}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border-subtle/60">
            <span className="text-[10px] text-theme-text-muted block">{t("font_info.metrics.ascender")}</span>
            <span className="text-sm font-semibold font-mono text-emerald-500 mt-0.5 block">
              +{metrics.ascender}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border-subtle/60">
            <span className="text-[10px] text-theme-text-muted block">{t("font_info.metrics.descender")}</span>
            <span className="text-sm font-semibold font-mono text-rose-500 mt-0.5 block">
              {metrics.descender}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border-subtle/60">
            <span className="text-[10px] text-theme-text-muted block">{t("font_info.metrics.line_gap")}</span>
            <span className="text-sm font-semibold font-mono text-theme-text mt-0.5 block">
              {metrics.line_gap}
            </span>
          </div>
        </div>

        {(metrics.win_ascent !== null || metrics.win_descent !== null) && (
          <div className="pt-2 border-t border-theme-border-subtle/60">
            <h5 className="text-[10px] font-medium text-theme-text-muted mb-2">
              {t("font_info.metrics.win_metrics")}
            </h5>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 rounded-lg bg-theme-surface border border-theme-border-subtle/50 flex justify-between items-center">
                <span className="text-[11px] text-theme-text-muted">{t("font_info.metrics.win_ascent")}</span>
                <span className="font-mono font-medium">{metrics.win_ascent ?? "-"}</span>
              </div>
              <div className="p-2 rounded-lg bg-theme-surface border border-theme-border-subtle/50 flex justify-between items-center">
                <span className="text-[11px] text-theme-text-muted">{t("font_info.metrics.win_descent")}</span>
                <span className="font-mono font-medium">{metrics.win_descent ?? "-"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. 굵기, 장평 및 글리프 바운딩 박스 */}
      <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-2.5">
        <h4 className="text-[11px] font-semibold text-theme-text uppercase tracking-wider">
          {t("font_info.metrics.proportions")}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <div className="flex justify-between py-1 border-b border-theme-border-subtle/40">
            <span className="text-theme-text-muted">{t("font_info.metrics.weight_class")}</span>
            <span className="font-mono font-medium">{os2?.weight_class || 400}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-theme-border-subtle/40">
            <span className="text-theme-text-muted">{t("font_info.metrics.width_class")}</span>
            <span className="font-mono font-medium">
              {os2?.width_class === 5
                ? t("font_info.metrics.width_normal")
                : `${os2?.width_class ?? 5}`}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-theme-border-subtle/40">
            <span className="text-theme-text-muted">{t("font_info.metrics.underline")}</span>
            <span className="font-mono font-medium">
              {t("font_info.metrics.thickness")} {metrics.underline_thickness} / {t("font_info.metrics.position")} {metrics.underline_position}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-theme-border-subtle/40">
            <span className="text-theme-text-muted">{t("font_info.metrics.monospace_label")}</span>
            <span className="font-medium">
              {metrics.is_monospaced
                ? t("font_info.metrics.monospace_yes")
                : t("font_info.metrics.monospace_no")}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <span className="text-[10px] text-theme-text-muted block mb-1">
            {t("font_info.metrics.bounding_box")}
          </span>
          <div className="p-2 rounded-lg bg-theme-surface border border-theme-border-subtle/60 font-mono text-[11px] text-theme-text flex justify-around">
            <span>xMin: {metrics.bbox_xmin}</span>
            <span>yMin: {metrics.bbox_ymin}</span>
            <span>xMax: {metrics.bbox_xmax}</span>
            <span>yMax: {metrics.bbox_ymax}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
