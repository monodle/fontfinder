import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "../../utils/cn";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
  variant?: AlertVariant;
  title?: ReactNode;
  message?: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const VARIANT_CONFIG: Record<
  AlertVariant,
  { container: string; text: string; defaultIcon: typeof Info }
> = {
  info: {
    container: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    text: "text-blue-700 dark:text-blue-300",
    defaultIcon: Info,
  },
  success: {
    container: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    defaultIcon: CheckCircle2,
  },
  warning: {
    container: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    text: "text-amber-700 dark:text-amber-300",
    defaultIcon: AlertTriangle,
  },
  error: {
    container: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
    text: "text-rose-700 dark:text-rose-300",
    defaultIcon: AlertCircle,
  },
};

export function Alert({
  variant = "info",
  title,
  message,
  icon,
  onClose,
  action,
  className,
  children,
}: AlertProps) {
  const { t } = useTranslation();
  const config = VARIANT_CONFIG[variant];
  const IconComponent = config.defaultIcon;

  return (
    <div
      role="alert"
      className={cn(
        "p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all",
        config.container,
        className
      )}
    >
      <div className="shrink-0 mt-0.5">
        {icon ?? <IconComponent className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        {message && <div className={cn("leading-relaxed", config.text)}>{message}</div>}
        {children}
      </div>

      {action && <div className="shrink-0">{action}</div>}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
          aria-label={t("common.close", "닫기")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
