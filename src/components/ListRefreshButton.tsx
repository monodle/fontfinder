import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../utils/cn";

export interface ListRefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  isLoading?: boolean;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "button";
  showLabel?: boolean;
  label?: string;
  title?: string;
  disabled?: boolean;
}

export const ListRefreshButton: React.FC<ListRefreshButtonProps> = ({
  onRefresh,
  isLoading = false,
  className = "",
  iconClassName = "",
  size = "md",
  variant = "icon",
  showLabel = false,
  label,
  title,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [internalLoading, setInternalLoading] = useState(false);

  const effectiveLoading = isLoading || internalLoading;
  const buttonTitle = title ?? t("toolbar.refresh", "새로고침");
  const buttonLabel = label ?? t("toolbar.refresh", "새로고침");

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled || effectiveLoading) return;

    try {
      const result = onRefresh();
      if (result instanceof Promise) {
        setInternalLoading(true);
        await result;
      }
    } catch (err) {
      console.error("리스트 새로고침 실패:", err);
    } finally {
      setInternalLoading(false);
    }
  };

  const sizeClasses = {
    sm: "p-1 text-xs gap-1",
    md: "p-1.5 text-xs gap-1.5",
    lg: "p-2 text-sm gap-2",
  }[size];

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || effectiveLoading}
      title={buttonTitle}
      aria-label={buttonTitle}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-theme-border bg-theme-card hover:bg-theme-card-hover text-theme-text-secondary hover:text-theme-text transition-colors disabled:opacity-50 shadow-2xs cursor-pointer select-none",
        sizeClasses,
        className
      )}
    >
      <RefreshCw
        className={cn(iconSizes, effectiveLoading && "animate-spin", iconClassName)}
      />
      {(showLabel || variant === "button") && (
        <span className="font-medium whitespace-nowrap">{buttonLabel}</span>
      )}
    </button>
  );
};
