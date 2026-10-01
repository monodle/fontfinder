import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className = "",
  "aria-label": ariaLabel,
}: ToggleSwitchProps) {
  const isSm = size === "sm";

  const switchElement = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-theme-accent focus-visible:ring-offset-2",
        isSm ? "h-4 w-7" : "h-5 w-9",
        checked ? "bg-theme-accent" : "bg-theme-border hover:bg-theme-border-subtle",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
          isSm ? "h-3 w-3" : "h-4 w-4",
          checked
            ? isSm
              ? "translate-x-3.5"
              : "translate-x-4.5"
            : "translate-x-0.5",
          "mt-0.5"
        )}
      />
    </button>
  );

  if (!label && !description) {
    return <div className={className}>{switchElement}</div>;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 select-none",
        disabled && "opacity-50",
        className
      )}
    >
      <div className="space-y-0.5 text-left">
        {label && (
          <label
            onClick={() => !disabled && onChange(!checked)}
            className="text-xs font-medium text-theme-text block cursor-pointer"
          >
            {label}
          </label>
        )}
        {description && (
          <p className="text-[11px] text-theme-text-muted leading-tight">
            {description}
          </p>
        )}
      </div>
      {switchElement}
    </div>
  );
}
