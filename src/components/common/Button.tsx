import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text border-transparent shadow-xs font-medium",
  secondary:
    "bg-theme-card hover:bg-theme-hover text-theme-text border-theme-border font-medium shadow-2xs",
  outline:
    "border-theme-border text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover font-medium",
  ghost:
    "text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border-transparent",
  danger:
    "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 dark:text-rose-400 font-medium",
};

const SIZE_CLASSES: Record<ButtonSize, { button: string; icon: string }> = {
  xs: {
    button: "px-2 py-1 text-xs rounded-md gap-1",
    icon: "[&>svg]:w-3 [&>svg]:h-3",
  },
  sm: {
    button: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
    icon: "[&>svg]:w-3.5 [&>svg]:h-3.5",
  },
  md: {
    button: "px-4 py-2 text-xs font-medium rounded-lg gap-2",
    icon: "[&>svg]:w-4 [&>svg]:h-4",
  },
  lg: {
    button: "px-5 py-2.5 text-sm font-medium rounded-xl gap-2.5",
    icon: "[&>svg]:w-4.5 [&>svg]:h-4.5",
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "secondary",
      size = "sm",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled = false,
      type = "button",
      className,
      ...restProps
    },
    ref
  ) => {
    const sizeConfig = SIZE_CLASSES[size];
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
          "inline-flex items-center justify-center border transition-all select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/50",
          sizeConfig.button,
          sizeConfig.icon,
          VARIANT_CLASSES[variant],
          fullWidth && "w-full",
          isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
        {...restProps}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {isLoading && loadingText ? (
          <span>{loadingText}</span>
        ) : (
          children && <span>{children}</span>
        )}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
