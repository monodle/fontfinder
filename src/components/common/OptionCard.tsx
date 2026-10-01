import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn";

export interface OptionCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "default" | "compact" | "horizontal";
  showCheckmark?: boolean;
  className?: string;
  children?: ReactNode;
}

export function OptionCard({
  title,
  description,
  icon,
  badge,
  selected = false,
  disabled = false,
  onClick,
  variant = "default",
  showCheckmark = true,
  className,
  children,
}: OptionCardProps) {
  const isCompact = variant === "compact";
  const isHorizontal = variant === "horizontal";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative flex rounded-xl border text-left transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/50",
        isCompact
          ? "p-2.5 items-center gap-2.5"
          : isHorizontal
          ? "p-3 items-center"
          : "p-3.5 flex-col items-start gap-2.5",
        selected
          ? "border-theme-accent bg-theme-active/30 text-theme-text shadow-2xs ring-1 ring-theme-accent/50"
          : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover hover:text-theme-text",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      <div className="flex w-full items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && (
            <div
              className={cn(
                "shrink-0 transition-colors",
                selected ? "text-theme-accent" : "text-theme-text-muted group-hover:text-theme-text"
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "font-semibold text-xs leading-snug line-clamp-2 break-keep [word-break:keep-all] transition-colors",
                  selected ? "text-theme-accent" : "text-theme-text"
                )}
              >
                {title}
              </span>
              {badge}
            </div>
          </div>
        </div>

        {showCheckmark && selected && (
          <Check className="w-4 h-4 text-theme-accent shrink-0 ml-1.5 self-center" />
        )}
      </div>

      {description && (
        <p className="text-[11px] text-theme-text-muted leading-relaxed line-clamp-2 w-full break-keep [word-break:keep-all] mt-1">
          {description}
        </p>
      )}

      {children}
    </button>
  );
}

export interface OptionCardGridProps {
  columns?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}

const COLUMN_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

const GAP_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "gap-1.5",
  md: "gap-2.5",
  lg: "gap-4",
};

export function OptionCardGrid({
  columns = 2,
  gap = "md",
  className,
  children,
}: OptionCardGridProps) {
  return (
    <div className={cn("grid", COLUMN_CLASSES[columns] || COLUMN_CLASSES[2], GAP_CLASSES[gap], className)}>
      {children}
    </div>
  );
}
