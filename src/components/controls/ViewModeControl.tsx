import { useTranslation } from "react-i18next";
import { List, Grid } from "lucide-react";
import { SegmentedControl, SegmentOption } from "../common/SegmentedControl";

export interface ViewModeControlProps {
  viewMode: "list" | "grid";
  onChange: (mode: "list" | "grid") => void;
  variant?: "icon" | "button";
  className?: string;
  disabled?: boolean;
}

export function ViewModeControl({
  viewMode,
  onChange,
  variant = "icon",
  className = "",
  disabled = false,
}: ViewModeControlProps) {
  const { t } = useTranslation();

  const options: SegmentOption<"list" | "grid">[] = [
    {
      value: "list",
      label: variant === "button" ? t("toolbar.view_list") : undefined,
      icon: <List className="w-3.5 h-3.5" />,
      title: t("toolbar.view_list"),
    },
    {
      value: "grid",
      label: variant === "button" ? t("toolbar.view_grid") : undefined,
      icon: <Grid className="w-3.5 h-3.5" />,
      title: t("toolbar.view_grid"),
    },
  ];

  return (
    <SegmentedControl
      options={options}
      value={viewMode}
      onChange={onChange}
      variant={variant === "button" ? "button" : "segment"}
      size="md"
      className={className}
      disabled={disabled}
      aria-label={t("toolbar.view_mode")}
    />
  );
}
