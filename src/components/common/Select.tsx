import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export interface SelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  disabled?: boolean;
}

export type SelectSize = "sm" | "md";

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  options: SelectOption[];
  value?: string | number;
  onChange?: (value: string) => void;
  icon?: ReactNode;
  size?: SelectSize;
  error?: boolean;
}

const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: "text-xs py-1.5 pl-3 pr-8 rounded-lg",
  md: "text-sm py-2 pl-3.5 pr-9 rounded-xl",
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      icon,
      size = "sm",
      error = false,
      disabled = false,
      className,
      ...restProps
    },
    ref
  ) => {
    return (
      <div className={cn("relative inline-flex items-center w-full", className)}>
        {icon && (
          <div className="absolute left-2.5 z-10 pointer-events-none text-theme-text-muted flex items-center">
            {icon}
          </div>
        )}
        <select
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "w-full appearance-none bg-theme-input border border-theme-border text-theme-text font-medium transition-colors cursor-pointer shadow-2xs focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent/50",
            SIZE_CLASSES[size],
            icon && "pl-8",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/50",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none",
            className
          )}
          {...restProps}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              className="bg-theme-card text-theme-text"
            >
              {opt.label} {opt.subLabel ? `(${opt.subLabel})` : ""}
            </option>
          ))}
        </select>
        <div className="absolute right-2.5 pointer-events-none text-theme-text-muted flex items-center">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";
