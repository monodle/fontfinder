import { useTranslation } from "react-i18next";
import { AlignLeft, LayoutList } from "lucide-react";
import { FontDetailMode } from "./font-card/types";
import { SegmentedControl, SegmentOption } from "./common/SegmentedControl";

export interface DetailModeControlProps {
  detailMode: FontDetailMode;
  onChange: (mode: FontDetailMode) => void;
  variant?: "segment" | "button" | "compact";
  className?: string;
  disabled?: boolean;
}

export function DetailModeControl({
  detailMode,
  onChange,
  variant = "segment",
  className = "",
  disabled = false,
}: DetailModeControlProps) {
  const { t } = useTranslation();

  const isCardButton = variant === "button";

  const options: SegmentOption<FontDetailMode>[] = [
    {
      value: "simple",
      label: isCardButton
        ? t("settings.font_detail_simple", "간단히 보기")
        : undefined,
      description: isCardButton
        ? t("settings.font_detail_simple_desc", "폰트명, 굵기 및 문구 내용을 최대한 시원하게 표시합니다.")
        : undefined,
      icon: <AlignLeft className={isCardButton ? "w-4 h-4 text-theme-accent" : "w-3.5 h-3.5"} />,
      title: t("toolbar.detail_mode_simple", { defaultValue: "간단히 보기" }),
    },
    {
      value: "detailed",
      label: isCardButton
        ? t("settings.font_detail_detailed", "자세히 보기")
        : undefined,
      description: isCardButton
        ? t("settings.font_detail_detailed_desc", "모든 메타데이터, 포맷 뱃지, 파일 정보 등을 풍부하게 표시합니다.")
        : undefined,
      icon: <LayoutList className={isCardButton ? "w-4 h-4 text-theme-accent" : "w-3.5 h-3.5"} />,
      title: t("toolbar.detail_mode_detailed", { defaultValue: "자세히 보기" }),
    },
  ];

  return (
    <SegmentedControl
      options={options}
      value={detailMode}
      onChange={onChange}
      variant={isCardButton ? "card" : "segment"}
      size={variant === "compact" || variant === "segment" ? "sm" : "md"}
      className={className}
      disabled={disabled}
      aria-label={t("toolbar.detail_mode_tooltip", { defaultValue: "폰트 표시 상세도" })}
    />
  );
}
