import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  orientation?: "horizontal" | "vertical";
  variant?: "pill" | "underline" | "sidebar";
  className?: string;
  tabClassName?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  orientation = "horizontal",
  variant = "pill",
  className,
  tabClassName,
}: TabsProps<T>) {
  const isVertical = orientation === "vertical";

  return (
    <nav
      role="tablist"
      aria-orientation={orientation}
      className={cn(
        "flex select-none",
        isVertical ? "flex-col space-y-1" : "flex-row items-center gap-1.5 overflow-x-auto no-scrollbar",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl text-xs font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/50",
              // Layout specifics
              isVertical ? "w-full px-3 py-2.5 text-left justify-start" : "px-3 py-1.5 shrink-0 justify-center",
              // Variant styles
              variant === "sidebar" && [
                isActive
                  ? "bg-theme-active/40 text-theme-accent font-semibold shadow-2xs"
                  : "text-theme-text-muted hover:text-theme-text hover:bg-theme-card-hover",
              ],
              variant === "pill" && [
                isActive
                  ? "bg-theme-accent text-theme-accent-text shadow-2xs font-semibold"
                  : "bg-theme-card text-theme-text-secondary hover:bg-theme-card-hover hover:text-theme-text border border-theme-border",
              ],
              variant === "underline" && [
                "rounded-none border-b-2 px-2 py-2",
                isActive
                  ? "border-theme-accent text-theme-accent font-semibold"
                  : "border-transparent text-theme-text-muted hover:text-theme-text hover:border-theme-border",
              ],
              tab.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
              tabClassName
            )}
          >
            {tab.icon && (
              <span
                className={cn(
                  "shrink-0 flex items-center transition-colors",
                  isActive
                    ? variant === "pill"
                      ? "text-inherit"
                      : "text-theme-accent"
                    : "text-theme-text-muted"
                )}
              >
                {tab.icon}
              </span>
            )}
            <span className="truncate">{tab.label}</span>
            {tab.badge && <span className="ml-auto shrink-0">{tab.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
