import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

const GRID_COLUMN_OPTIONS = [2, 3, 4, 5] as const;

export interface GridColumnsSelectorProps {
  columns: number;
  onChange: (cols: number) => void;
  variant?: "dropdown" | "buttons";
  className?: string;
  disabled?: boolean;
}

export function GridColumnsSelector({
  columns,
  onChange,
  variant = "buttons",
  className = "",
  disabled = false,
}: GridColumnsSelectorProps) {
  const { t } = useTranslation();

  if (variant === "dropdown") {
    return (
      <div
        className={cn(
          "h-8 flex items-center gap-1.5 bg-theme-card border border-theme-border rounded-lg px-2.5 shadow-2xs select-none",
          disabled && "opacity-50 pointer-events-none",
          className
        )}
      >
        <span className="text-[11px] text-theme-text-muted font-medium whitespace-nowrap">
          {t("toolbar.column")}
        </span>
        <select
          value={columns}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-full bg-transparent text-xs text-theme-text font-semibold focus:outline-none cursor-pointer pr-0.5"
          title={t("toolbar.column")}
          aria-label={t("toolbar.column")}
        >
          {GRID_COLUMN_OPTIONS.map((c) => (
            <option key={c} value={c} className="bg-theme-card text-theme-text">
              {t("toolbar.column_count", { count: c })}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-4 gap-1.5 select-none", className)}>
      {GRID_COLUMN_OPTIONS.map((c) => {
        const isSelected = columns === c;

        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onChange(c)}
            className={cn(
              "py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
              isSelected
                ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-2xs"
                : "border-theme-border text-theme-text-secondary hover:bg-theme-card-hover hover:text-theme-text",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {t("settings.grid_column_unit", { cols: c })}
          </button>
        );
      })}
    </div>
  );
}
