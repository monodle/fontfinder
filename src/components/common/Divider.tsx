import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export type DividerOrientation = "horizontal" | "vertical";
export type DividerSpacing = "none" | "xs" | "sm" | "md" | "lg";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  spacing?: DividerSpacing;
  label?: ReactNode;
  className?: string;
}

const HORIZONTAL_SPACING: Record<DividerSpacing, string> = {
  none: "my-0",
  xs: "my-1",
  sm: "my-2",
  md: "my-4",
  lg: "my-6",
};

const VERTICAL_SPACING: Record<DividerSpacing, string> = {
  none: "mx-0",
  xs: "mx-1",
  sm: "mx-1.5",
  md: "mx-2.5",
  lg: "mx-4",
};

export function Divider({
  orientation = "horizontal",
  spacing = "sm",
  label,
  className = "",
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "inline-block w-px self-stretch bg-theme-border shrink-0",
          VERTICAL_SPACING[spacing],
          className
        )}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={cn("flex items-center gap-3 select-none", HORIZONTAL_SPACING[spacing], className)}
      >
        <div className="flex-1 h-px bg-theme-border" />
        <span className="text-[11px] font-medium text-theme-text-muted shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px bg-theme-border" />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn("w-full h-px bg-theme-border", HORIZONTAL_SPACING[spacing], className)}
    />
  );
}
