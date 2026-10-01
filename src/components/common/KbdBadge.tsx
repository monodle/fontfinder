import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface KbdBadgeProps {
  shortcut: ReactNode;
  className?: string;
  size?: "xs" | "sm" | "md";
}

export function KbdBadge({
  shortcut,
  className = "",
  size = "xs",
}: KbdBadgeProps) {
  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center font-mono font-medium text-theme-text-muted bg-theme-badge/80 border border-theme-border rounded shadow-2xs select-none",
        sizeClasses[size],
        className
      )}
    >
      {shortcut}
    </kbd>
  );
}
