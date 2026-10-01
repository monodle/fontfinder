import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  size?: "sm" | "md";
}

const SIZE_CLASSES = {
  sm: "w-3.5 h-3.5 rounded",
  md: "w-4 h-4 rounded",
};

const ICON_SIZE_CLASSES = {
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked = false, disabled = false, onChange, size = "md", className, id, ...restProps }, ref) => {
    return (
      <div className="relative inline-flex items-center justify-center shrink-0">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...restProps}
        />
        <div
          onClick={(e) => {
            if (disabled) return;
            // Allow clicking the custom box directly if not linked to a label
            if (!id && onChange) {
              e.stopPropagation();
              const syntheticEvent = {
                target: { checked: !checked },
                currentTarget: { checked: !checked },
              } as React.ChangeEvent<HTMLInputElement>;
              onChange(syntheticEvent);
            }
          }}
          className={cn(
            "flex items-center justify-center border transition-all duration-150 select-none",
            SIZE_CLASSES[size],
            checked
              ? "bg-theme-accent border-theme-accent text-theme-accent-text shadow-2xs"
              : "border-theme-border bg-theme-surface hover:border-theme-border-card-hover",
            disabled && "opacity-50 cursor-not-allowed bg-theme-card/50",
            !disabled && "cursor-pointer",
            className
          )}
        >
          {checked && (
            <Check className={cn("stroke-[3]", ICON_SIZE_CLASSES[size])} />
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
