import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export type ProgressBarSize = "xs" | "sm" | "md" | "lg";
export type ProgressBarVariant = "default" | "accent" | "success" | "warning";

export interface ProgressBarProps {
  value?: number;
  max?: number;
  size?: ProgressBarSize;
  variant?: ProgressBarVariant;
  indeterminate?: boolean;
  showLabel?: boolean;
  label?: ReactNode;
  subLabel?: ReactNode;
  className?: string;
  barClassName?: string;
}

const SIZE_CLASSES: Record<ProgressBarSize, { container: string; track: string }> = {
  xs: { container: "h-1", track: "p-0" },
  sm: { container: "h-1.5", track: "p-0" },
  md: { container: "h-2.5", track: "p-0.5" },
  lg: { container: "h-3.5", track: "p-0.5" },
};

const VARIANT_CLASSES: Record<ProgressBarVariant, string> = {
  default: "bg-theme-accent",
  accent: "bg-theme-accent",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
};

export function ProgressBar({
  value = 0,
  max = 100,
  size = "md",
  variant = "accent",
  indeterminate = false,
  showLabel = false,
  label,
  subLabel,
  className = "",
  barClassName = "",
}: ProgressBarProps) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.min(safeMax, Math.max(0, value));
  const percent = Math.min(100, Math.round((safeValue / safeMax) * 100));

  const sizeConfig = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.accent;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {(label || showLabel || subLabel) && (
        <div className="flex items-center justify-between text-[11px] font-mono select-none px-0.5">
          <div className="text-theme-text-secondary truncate mr-2">
            {label}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {subLabel && (
              <span className="text-theme-text-muted">{subLabel}</span>
            )}
            {showLabel && !indeterminate && (
              <span className="font-semibold text-theme-accent">{percent}%</span>
            )}
          </div>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : safeValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className={cn(
          "w-full rounded-full bg-theme-hover overflow-hidden border border-theme-border/70",
          sizeConfig.container,
          sizeConfig.track
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-200 ease-out shadow-xs",
            variantClass,
            indeterminate && "w-1/3 animate-pulse",
            barClassName
          )}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
