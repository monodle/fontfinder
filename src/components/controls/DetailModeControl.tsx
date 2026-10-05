import { useTranslation } from "react-i18next";
import { AlignLeft, LayoutList } from "lucide-react";
import { FontDetailMode } from "../font-card/types";
import { SegmentedControl, SegmentOption } from "../common/SegmentedControl";

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
        ? t("settings.font_detail_simple")
        : undefined,
      description: isCardButton
        ? t("settings.font_detail_simple_desc")
        : undefined,
      icon: <AlignLeft className={isCardButton ? "w-4 h-4 text-theme-accent" : "w-3.5 h-3.5"} />,
      title: t("toolbar.detail_mode_simple"),
    },
    {
      value: "detailed",
      label: isCardButton
        ? t("settings.font_detail_detailed")
        : undefined,
      description: isCardButton
        ? t("settings.font_detail_detailed_desc")
        : undefined,
      icon: <LayoutList className={isCardButton ? "w-4 h-4 text-theme-accent" : "w-3.5 h-3.5"} />,
      title: t("toolbar.detail_mode_detailed"),
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
      aria-label={t("toolbar.detail_mode_tooltip")}
    />
  );
}
