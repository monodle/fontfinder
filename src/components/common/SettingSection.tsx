import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface SettingSectionProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SettingSection({
  icon,
  title,
  subtitle,
  children,
  action,
  className = "",
}: SettingSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between pb-1.5 border-b border-theme-border-subtle">
        <div className="flex items-center gap-2">
          {icon && <div className="text-theme-accent shrink-0">{icon}</div>}
          <div className="flex flex-col">
            <h3 className="font-semibold text-xs text-theme-text">{title}</h3>
            {subtitle && (
              <p className="text-[10px] text-theme-text-muted">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function SettingRow({
  icon,
  title,
  description,
  badge,
  children,
  className = "",
  onClick,
}: SettingRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 bg-theme-card rounded-xl border border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
        onClick && "cursor-pointer hover:bg-theme-card-hover",
        className
      )}
    >
      {(title || description || icon) && (
        <div className="flex items-start gap-2.5 min-w-0">
          {icon && (
            <div className="mt-0.5 text-theme-accent shrink-0">{icon}</div>
          )}
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {title && (
                <span className="font-medium text-theme-text text-xs block">
                  {title}
                </span>
              )}
              {badge}
            </div>
            {description && (
              <span className="text-[11px] text-theme-text-muted block leading-tight">
                {description}
              </span>
            )}
          </div>
        </div>
      )}
      {children && (
        <div className="shrink-0 flex items-center justify-end gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
