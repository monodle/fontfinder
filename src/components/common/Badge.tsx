import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

export type BadgeVariant =
  | "default"
  | "accent"
  | "muted"
  | "outline"
  | "success"
  | "warning"
  | "danger";

export type BadgeSize = "xs" | "sm" | "md";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  onClick?: () => void;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-theme-active/40 text-theme-text border-theme-border/60",
  accent: "bg-theme-accent/15 text-theme-accent border-theme-accent/30 font-medium",
  muted: "bg-theme-input text-theme-text-muted border-theme-border/40",
  outline: "bg-transparent text-theme-text-secondary border-theme-border",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: "text-[10px] px-1.5 py-0.2 rounded-md gap-1",
  sm: "text-xs px-2 py-0.5 rounded-lg gap-1.5",
  md: "text-xs px-2.5 py-1 rounded-lg gap-2",
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  icon,
  onRemove,
  removeLabel = "Remove",
  className,
  onClick,
}: BadgeProps) {
  const isClickable = Boolean(onClick);

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center font-medium border transition-colors select-none",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        isClickable && "cursor-pointer hover:opacity-80 active:scale-95",
        className
      )}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={removeLabel}
          className="shrink-0 ml-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-inherit transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
