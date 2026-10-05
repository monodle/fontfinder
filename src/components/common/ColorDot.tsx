import { Check } from "lucide-react";
import { cn } from "../../utils/cn";

export type ColorDotSize = "xs" | "sm" | "md" | "lg";

export interface ColorDotProps {
  color: string;
  size?: ColorDotSize;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

const SIZE_CLASSES: Record<ColorDotSize, { dot: string; icon: string }> = {
  xs: { dot: "w-2.5 h-2.5", icon: "w-2 h-2" },
  sm: { dot: "w-3.5 h-3.5", icon: "w-2.5 h-2.5" },
  md: { dot: "w-5 h-5", icon: "w-3.5 h-3.5" },
  lg: { dot: "w-7 h-7", icon: "w-4 h-4" },
};

export function ColorDot({
  color,
  size = "sm",
  selected = false,
  interactive = false,
  onClick,
  title,
  className = "",
}: ColorDotProps) {
  const sizeConfig = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

  const content = (
    <span
      style={{ backgroundColor: color }}
      className={cn(
        "rounded-full inline-flex items-center justify-center shrink-0 border border-black/15 shadow-2xs transition-transform",
        sizeConfig.dot,
        selected && "ring-2 ring-theme-accent ring-offset-1 ring-offset-theme-surface",
        interactive && "cursor-pointer hover:scale-110 active:scale-95",
        className
      )}
      title={title}
    >
      {selected && (
        <Check className={cn("text-white drop-shadow-xs stroke-[2.5]", sizeConfig.icon)} />
      )}
    </span>
  );

  if (interactive || onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="inline-flex items-center justify-center p-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent"
      >
        {content}
      </button>
    );
  }

  return content;
}
