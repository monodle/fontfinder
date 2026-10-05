import { useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../../utils/cn";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
  duration?: number;
  className?: string;
}

const VARIANT_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_STYLES: Record<
  ToastVariant,
  { iconColor: string; borderColor?: string }
> = {
  success: {
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  error: {
    iconColor: "text-rose-500 dark:text-rose-400",
    borderColor: "border-rose-500/30",
  },
  warning: {
    iconColor: "text-amber-500 dark:text-amber-400",
    borderColor: "border-amber-500/30",
  },
  info: {
    iconColor: "text-sky-500 dark:text-sky-400",
  },
};

export function Toast({
  message,
  variant = "success",
  onClose,
  duration,
  className = "",
}: ToastProps) {
  useEffect(() => {
    if (!duration || !onClose) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = VARIANT_ICONS[variant] || CheckCircle2;
  const config = VARIANT_STYLES[variant] || VARIANT_STYLES.success;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl",
        "bg-theme-surface/95 text-theme-text border border-theme-border shadow-xl backdrop-blur-md",
        "text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 select-none",
        config.borderColor,
        className
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", config.iconColor)} />
      <span className="leading-snug">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-1 p-0.5 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
          aria-label="닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
