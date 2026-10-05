import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Tooltip, TooltipPosition } from "./Tooltip";

export type IconButtonVariant = "ghost" | "secondary" | "primary" | "danger";
export type IconButtonSize = "xs" | "sm" | "md" | "lg";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  /** 버튼 크기 (기본값: 'sm') */
  size?: IconButtonSize;
  /** 버튼 스타일 변형 (기본값: 'ghost') */
  variant?: IconButtonVariant;
  /** 활성화(선택됨/토글 온) 상태 */
  active?: boolean;
  /** 툴팁 내용 (설정 시 Tooltip 컴포넌트로 자동 래핑) */
  tooltip?: ReactNode;
  /** 툴팁 위치 */
  tooltipPosition?: TooltipPosition;
  /** 툴팁 단축키 표시 */
  tooltipShortcut?: ReactNode;
  /** 렌더링할 아이콘 (또는 children으로 전달 가능) */
  icon?: ReactNode;
}

const SIZE_CLASSES: Record<IconButtonSize, { button: string; icon: string }> = {
  xs: {
    button: "w-6 h-6 rounded-md",
    icon: "[&>svg]:w-3.5 [&>svg]:h-3.5",
  },
  sm: {
    button: "w-7 h-7 rounded-lg",
    icon: "[&>svg]:w-4 [&>svg]:h-4",
  },
  md: {
    button: "w-8 h-8 rounded-lg",
    icon: "[&>svg]:w-4.5 [&>svg]:h-4.5",
  },
  lg: {
    button: "w-9 h-9 rounded-xl",
    icon: "[&>svg]:w-5 [&>svg]:h-5",
  },
};

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost:
    "text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border border-transparent",
  secondary:
    "border border-theme-border bg-theme-card hover:bg-theme-hover text-theme-text shadow-2xs",
  primary:
    "bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text border border-transparent shadow-xs",
  danger:
    "text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-transparent",
};

const ACTIVE_VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost:
    "bg-theme-active text-theme-accent border-theme-border font-medium shadow-2xs",
  secondary:
    "bg-theme-active text-theme-accent border-theme-accent shadow-xs font-medium",
  primary:
    "bg-theme-accent-hover text-theme-accent-text border-theme-accent-hover ring-2 ring-theme-accent/30",
  danger:
    "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      children,
      size = "sm",
      variant = "ghost",
      active = false,
      tooltip,
      tooltipPosition = "top",
      tooltipShortcut,
      disabled = false,
      type = "button",
      className,
      "aria-label": ariaLabel,
      ...restProps
    },
    ref
  ) => {
    const sizeConfig = SIZE_CLASSES[size];
    const computedAriaLabel =
      ariaLabel ||
      (typeof tooltip === "string" ? tooltip : undefined);

    const buttonElement = (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-label={computedAriaLabel}
        aria-pressed={active ? "true" : undefined}
        className={cn(
          "inline-flex items-center justify-center shrink-0 transition-all select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/50",
          sizeConfig.button,
          sizeConfig.icon,
          active ? ACTIVE_VARIANT_CLASSES[variant] : VARIANT_CLASSES[variant],
          disabled && "opacity-40 cursor-not-allowed pointer-events-none",
          className
        )}
        {...restProps}
      >
        {icon || children}
      </button>
    );

    if (tooltip && !disabled) {
      return (
        <Tooltip
          content={tooltip}
          shortcut={tooltipShortcut}
          position={tooltipPosition}
        >
          {buttonElement}
        </Tooltip>
      );
    }

    return buttonElement;
  }
);

IconButton.displayName = "IconButton";
