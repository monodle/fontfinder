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
  variant?: "default" | "compact" | "horizontal" | "centered";
  align?: "left" | "center";
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
  align,
  showCheckmark = true,
  className,
  children,
}: OptionCardProps) {
  const isCentered = align === "center" || variant === "centered";
  const isCompact = variant === "compact";
  const isHorizontal = variant === "horizontal";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative flex rounded-xl border transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/50",
        isCentered
          ? "p-2.5 flex-col items-center justify-center text-center gap-0.5"
          : isCompact
          ? "p-2.5 items-center gap-2.5 text-left"
          : isHorizontal
          ? "p-3 items-center text-left"
          : "p-3.5 flex-col items-start gap-2.5 text-left",
        selected
          ? "border-theme-accent bg-theme-active/30 text-theme-text shadow-2xs ring-1 ring-theme-accent/50"
          : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover hover:text-theme-text",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      <div
        className={cn(
          "flex w-full min-w-0",
          isCentered
            ? "flex-col items-center justify-center"
            : "items-center justify-between gap-2"
        )}
      >
        <div
          className={cn(
            "flex min-w-0",
            isCentered
              ? "flex-col items-center justify-center gap-1"
              : "items-center gap-2.5 flex-1"
          )}
        >
          {icon && (
            <div
              className={cn(
                "shrink-0 transition-colors",
                selected
                  ? "text-theme-accent"
                  : "text-theme-text-muted group-hover:text-theme-text"
              )}
            >
              {icon}
            </div>
          )}
          <div className={cn("min-w-0", isCentered && "flex flex-col items-center text-center")}>
            <div
              className={cn(
                "flex items-center gap-1.5 flex-wrap",
                isCentered && "justify-center"
              )}
            >
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
          <Check
            className={cn(
              "w-4 h-4 text-theme-accent shrink-0",
              isCentered ? "absolute top-2 right-2" : "ml-1.5 self-center"
            )}
          />
        )}
      </div>

      {description && (
        <p
          className={cn(
            "text-[10px] sm:text-[11px] text-theme-text-muted leading-tight line-clamp-2 w-full break-keep [word-break:keep-all]",
            isCentered ? "mt-0.5 text-center" : "mt-1 text-left"
          )}
        >
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
