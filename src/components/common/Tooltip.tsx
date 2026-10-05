import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { KbdBadge } from "./KbdBadge";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  shortcut?: ReactNode;
  position?: TooltipPosition;
  delayMs?: number;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  tooltipClassName?: string;
}

const POSITION_CLASSES: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

export function Tooltip({
  content,
  shortcut,
  position = "top",
  delayMs = 200,
  disabled = false,
  children,
  className = "",
  tooltipClassName = "",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (delayMs > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delayMs);
    } else {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 flex items-center gap-1.5 px-2 py-1",
            "text-[11px] font-medium text-theme-text bg-theme-surface/95 border border-theme-border",
            "rounded-md shadow-lg backdrop-blur-xs whitespace-nowrap select-none",
            "animate-in fade-in zoom-in-95 duration-100",
            POSITION_CLASSES[position],
            tooltipClassName
          )}
        >
          <span>{content}</span>
          {shortcut && <KbdBadge shortcut={shortcut} size="xs" />}
        </div>
      )}
    </div>
  );
}
