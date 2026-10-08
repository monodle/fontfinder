import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerColor = "accent" | "current" | "muted" | "white";

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
  className?: string;
  overlay?: boolean;
}

const SIZE_MAP: Record<SpinnerSize, string> = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-5 h-5",
  lg: "w-8 h-8",
  xl: "w-10 h-10",
};

const COLOR_MAP: Record<SpinnerColor, string> = {
  accent: "text-theme-accent",
  current: "text-current",
  muted: "text-theme-text-muted",
  white: "text-white",
};

export function Spinner({
  size = "md",
  color = "accent",
  label,
  className = "",
  overlay = false,
}: SpinnerProps) {
  const { t } = useTranslation();
  const content = (
    <div
      role="status"
      aria-label={label || t("common.loading")}
      className={cn(
        "inline-flex flex-col items-center justify-center gap-2",
        className
      )}
    >
      <Loader2
        className={cn(
          "animate-spin",
          SIZE_MAP[size],
          COLOR_MAP[color]
        )}
      />
      {label && (
        <span className="text-xs font-medium text-theme-text-muted select-none">
          {label}
        </span>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-theme-surface/70 backdrop-blur-xs rounded-inherit animate-in fade-in duration-150">
        {content}
      </div>
    );
  }

  return content;
}
