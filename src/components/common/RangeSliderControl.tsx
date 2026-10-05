import { type ReactNode, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { cn } from "../../utils/cn";

export interface RangeSliderControlProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: ReactNode;
  icon?: ReactNode;
  unit?: string;
  defaultValue?: number;
  onReset?: () => void;
  showNumberInput?: boolean;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  formatValue?: (val: number) => string;
}

export function RangeSliderControl({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  icon,
  unit = "",
  defaultValue,
  onReset,
  showNumberInput = true,
  compact = false,
  disabled = false,
  className = "",
  formatValue,
}: RangeSliderControlProps) {
  const { t } = useTranslation();
  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const num = Number.parseFloat(e.target.value);
    if (!Number.isNaN(num)) {
      onChange(Math.min(max, Math.max(min, num)));
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const num = Number.parseFloat(e.target.value);
    if (!Number.isNaN(num)) {
      onChange(Math.min(max, Math.max(min, num)));
    }
  };

  const handleResetClick = () => {
    if (onReset) {
      onReset();
    } else if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  const displayValue = formatValue ? formatValue(value) : value.toString();
  const canReset = (onReset !== undefined || defaultValue !== undefined) && (defaultValue === undefined || value !== defaultValue);

  return (
    <div
      className={cn(
        "space-y-1.5 select-none",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {(label || icon || showNumberInput || canReset) && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-theme-text-secondary">
            {icon && <div className="text-theme-accent shrink-0">{icon}</div>}
            {label && <span>{label}</span>}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-theme-text">
            {showNumberInput ? (
              <div className="flex items-center bg-theme-input-bg border border-theme-border rounded-md px-1.5 py-0.5 focus-within:border-theme-accent">
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  disabled={disabled}
                  onChange={handleInputChange}
                  className="w-10 bg-transparent text-right font-mono text-xs text-theme-text focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {unit && (
                  <span className="text-[10px] text-theme-text-muted ml-0.5">
                    {unit}
                  </span>
                )}
              </div>
            ) : (
              <span>
                {displayValue}
                {unit}
              </span>
            )}

            {canReset && (
              <button
                type="button"
                onClick={handleResetClick}
                className="p-1 rounded text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                title={t("common.reset_to_default")}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleSliderChange}
          className={cn(
            "w-full cursor-pointer accent-theme-accent",
            compact ? "h-1" : "h-1.5",
            "bg-theme-border rounded-lg"
          )}
        />
      </div>
    </div>
  );
}
