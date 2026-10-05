import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

export interface ColorPickerInputProps {
  value: string;
  onChange: (color: string) => void;
  fallbackColor?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function ColorPickerInput({
  value,
  onChange,
  fallbackColor = "#2c2825",
  placeholder,
  disabled = false,
  className = "",
  compact = false,
}: ColorPickerInputProps) {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t("style_modal.weight_default_short");

  const displayColor = value || fallbackColor;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 bg-theme-input border border-theme-border rounded-lg p-1 transition-colors focus-within:border-theme-accent",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {/* Native Color Picker Swatch */}
      <label className="relative flex items-center justify-center w-6 h-6 rounded-md border border-theme-border cursor-pointer overflow-hidden shadow-2xs shrink-0 hover:border-theme-accent transition-colors">
        <input
          type="color"
          value={displayColor}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
        />
        <span
          className="w-full h-full transition-colors"
          style={{ backgroundColor: displayColor }}
        />
      </label>

      {/* Hex Text Input */}
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={effectivePlaceholder}
        onChange={(e) => {
          let val = e.target.value.trim();
          if (val && !val.startsWith("#")) {
            val = `#${val}`;
          }
          onChange(val);
        }}
        className={`flex-1 min-w-0 bg-transparent text-theme-text font-mono uppercase focus:outline-none placeholder-theme-text-muted truncate ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      />

      {/* Clear/Reset Button */}
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-theme-text-muted hover:text-rose-500 p-0.5 rounded cursor-pointer transition-colors shrink-0"
          title={t("style_modal.reset_color")}
          aria-label={t("style_modal.reset_color")}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
