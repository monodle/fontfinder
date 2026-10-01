import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export type IconButtonVariant = "ghost" | "solid" | "outline" | "accent" | "danger";
export type IconButtonSize = "xs" | "sm" | "md" | "lg";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost:
    "text-theme-text-muted hover:text-theme-text hover:bg-theme-card-hover border-transparent",
  solid:
    "bg-theme-card text-theme-text hover:bg-theme-card-hover border-theme-border shadow-2xs",
  outline:
    "border-theme-border text-theme-text-secondary hover:text-theme-text hover:bg-theme-card-hover hover:border-theme-border-card-hover",
  accent:
    "bg-theme-accent text-theme-accent-text hover:bg-theme-accent-hover shadow-2xs border-transparent",
  danger:
    "text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-transparent dark:text-rose-400 dark:hover:bg-rose-500/20",
};

const ACTIVE_VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: "bg-theme-active/30 text-theme-accent border-theme-accent/30 font-semibold",
  solid: "border-theme-accent bg-theme-active/30 text-theme-accent shadow-xs",
  outline: "border-theme-accent bg-theme-active/30 text-theme-accent shadow-xs",
  accent: "bg-theme-accent-hover text-theme-accent-text ring-2 ring-theme-accent/40",
  danger: "bg-rose-500/20 text-rose-600 border-rose-500/40",
};

const SIZE_CLASSES: Record<IconButtonSize, { button: string; icon: string }> = {
  xs: {
    button: "w-6 h-6 p-0.5 rounded-md text-xs",
    icon: "[&>svg]:w-3.5 [&>svg]:h-3.5",
  },
  sm: {
    button: "w-7 h-7 p-1 rounded-lg text-xs",
    icon: "[&>svg]:w-4 [&>svg]:h-4",
  },
  md: {
    button: "w-8 h-8 p-1.5 rounded-lg text-sm",
    icon: "[&>svg]:w-4.5 [&>svg]:h-4.5",
  },
  lg: {
    button: "w-9 h-9 p-2 rounded-xl text-base",
    icon: "[&>svg]:w-5 [&>svg]:h-5",
  },
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = "ghost",
      size = "md",
      active = false,
      disabled = false,
      className,
      type = "button",
      ...restProps
    },
    ref
  ) => {
    const sizeConfig = SIZE_CLASSES[size];
    const variantClass = active
      ? ACTIVE_VARIANT_CLASSES[variant]
      : VARIANT_CLASSES[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center border transition-all select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/50",
          sizeConfig.button,
          sizeConfig.icon,
          variantClass,
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
        {...restProps}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
