import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className = "",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center select-none",
        compact ? "p-4 space-y-2" : "p-8 sm:p-12 space-y-3",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "rounded-2xl bg-theme-surface/60 border border-theme-border flex items-center justify-center text-theme-text-muted shadow-xs",
            compact ? "w-10 h-10 mb-1" : "w-14 h-14 mb-2"
          )}
        >
          {icon}
        </div>
      )}

      <div className="space-y-1 max-w-sm">
        <h4 className="font-semibold text-xs sm:text-sm text-theme-text">
          {title}
        </h4>
        {description && (
          <p className="text-[11px] sm:text-xs text-theme-text-muted leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action ? (
        <div className="pt-2">{action}</div>
      ) : actionLabel && onAction ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <span>{actionLabel}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
