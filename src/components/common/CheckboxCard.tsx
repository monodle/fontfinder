import { type ReactNode } from "react";
import { Checkbox } from "./Checkbox";
import { cn } from "../../utils/cn";

export interface CheckboxCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

export function CheckboxCard({
  checked,
  onChange,
  title,
  description,
  icon,
  badge,
  disabled = false,
  className,
  children,
}: CheckboxCardProps) {
  return (
    <div
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      className={cn(
        "p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none",
        disabled
          ? "opacity-50 cursor-not-allowed bg-theme-card/30 border-theme-border/50"
          : checked
          ? "bg-theme-accent-subtle/40 border-theme-accent/40 cursor-pointer shadow-2xs"
          : "bg-theme-card/60 border-theme-border hover:border-theme-border-card-hover hover:bg-theme-card cursor-pointer",
        className
      )}
    >
      <div className="mt-0.5 shrink-0">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {icon && <div className="text-theme-accent shrink-0">{icon}</div>}
          <span
            className={cn(
              "text-xs font-semibold transition-colors",
              checked ? "text-theme-text" : "text-theme-text-secondary"
            )}
          >
            {title}
          </span>
          {badge}
        </div>

        {description && (
          <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">
            {description}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
