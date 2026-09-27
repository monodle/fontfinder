import { useTranslation } from "react-i18next";
import { List, Grid } from "lucide-react";
import { cn } from "../utils/cn";

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

  if (variant === "button") {
    return (
      <div className={cn("grid grid-cols-2 gap-2 select-none", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("list")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
            viewMode === "list"
              ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-2xs"
              : "border-theme-border text-theme-text-secondary hover:bg-theme-card-hover hover:text-theme-text",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <List className="w-3.5 h-3.5" />
          <span>{t("toolbar.view_list")}</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("grid")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
            viewMode === "grid"
              ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-2xs"
              : "border-theme-border text-theme-text-secondary hover:bg-theme-card-hover hover:text-theme-text",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>{t("toolbar.view_grid")}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-8 flex items-center bg-theme-active/30 border border-theme-border rounded-lg p-0.5 select-none",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("list")}
        className={`w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
          viewMode === "list"
            ? "bg-theme-card text-theme-accent shadow-2xs font-medium"
            : "text-theme-text-secondary hover:text-theme-text"
        }`}
        title={t("toolbar.view_list")}
        aria-label={t("toolbar.view_list")}
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("grid")}
        className={`w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
          viewMode === "grid"
            ? "bg-theme-card text-theme-accent shadow-2xs font-medium"
            : "text-theme-text-secondary hover:text-theme-text"
        }`}
        title={t("toolbar.view_grid")}
        aria-label={t("toolbar.view_grid")}
      >
        <Grid className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
