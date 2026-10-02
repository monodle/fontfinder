import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface SegmentOption<T extends string | number> {
  value: T;
  label?: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  title?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "segment" | "button" | "compact" | "card";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  variant = "segment",
  size = "md",
  className = "",
  disabled = false,
  fullWidth = false,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  // 1. 카드/버튼 그리드 형태 (예: 환경설정 모달 내 2열 카드 버튼)
  if (variant === "card" || variant === "button") {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn(
          "grid gap-2 select-none",
          options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
          disabled && "opacity-50 pointer-events-none",
          className
        )}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          const isOptDisabled = disabled || opt.disabled;

          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isOptDisabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex transition-all cursor-pointer text-left border rounded-xl",
                variant === "card"
                  ? "flex-col items-start gap-1 p-3 text-xs"
                  : "items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium",
                isSelected
                  ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-2xs"
                  : "border-theme-border text-theme-text-secondary hover:bg-theme-card-hover hover:text-theme-text",
                isOptDisabled && "opacity-50 cursor-not-allowed"
              )}
              title={opt.title}
            >
              {variant === "card" ? (
                <>
                  <div className="flex items-center gap-1.5 font-semibold text-theme-text">
                    {opt.icon}
                    <span>{opt.label}</span>
                  </div>
                  {opt.description && (
                    <span className="text-[10px] text-theme-text-muted leading-tight">
                      {opt.description}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {opt.icon}
                  {opt.label && <span>{opt.label}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // 2. 컴팩트 / 인라인 세그먼트 형태 (아이콘/라벨 탭 바)
  const sizeClasses = {
    sm: "h-6 p-0.5 text-xs",
    md: "h-7 sm:h-8 p-0.5 text-xs",
    lg: "h-9 p-1 text-sm",
  };

  const itemSizeClasses = {
    sm: "h-5 px-1.5 text-xs",
    md: "h-6 sm:h-7 px-2 text-xs",
    lg: "h-7 px-3 text-sm",
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center bg-theme-badge/60 hover:bg-theme-badge border border-theme-border rounded-lg select-none transition-colors",
        sizeClasses[size],
        fullWidth && "w-full",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        const isOptDisabled = disabled || opt.disabled;

        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={opt.title || (typeof opt.label === "string" ? opt.label : undefined)}
            disabled={isOptDisabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md transition-all cursor-pointer font-medium",
              itemSizeClasses[size],
              fullWidth && "flex-1",
              isSelected
                ? "bg-theme-card text-theme-accent shadow-2xs font-semibold"
                : "text-theme-text-secondary hover:text-theme-text",
              isOptDisabled && "opacity-50 cursor-not-allowed"
            )}
            title={opt.title || (typeof opt.label === "string" ? opt.label : undefined)}
          >
            {opt.icon}
            {opt.label && <span className="truncate">{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
