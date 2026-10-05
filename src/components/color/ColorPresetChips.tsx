import { Check } from "lucide-react";
import { ColorPreset, isLightColor } from "../../config/colorPresets";
import { cn } from "../../utils/cn";

export interface ColorPresetChipsProps {
  presets: ColorPreset[];
  selectedColor: string;
  onSelect: (color: string) => void;
  layout?: "grid" | "scroll";
  columns?: number;
  size?: "sm" | "md";
  className?: string;
}

export function ColorPresetChips({
  presets,
  selectedColor,
  onSelect,
  layout = "grid",
  columns = 5,
  size = "md",
  className = "",
}: ColorPresetChipsProps) {
  const isScroll = layout === "scroll";
  const heightClass = size === "sm" ? "h-5 w-5" : "h-7";

  return (
    <div
      className={cn(
        isScroll
          ? "flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar"
          : "grid gap-1.5",
        className
      )}
      style={!isScroll ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {presets.map((preset) => {
        const isSelected = selectedColor.toLowerCase() === preset.color.toLowerCase();
        const light = isLightColor(preset.color);

        return (
          <button
            key={preset.color}
            type="button"
            onClick={() => onSelect(preset.color)}
            title={`${preset.label} (${preset.color})`}
            style={{ backgroundColor: preset.color }}
            className={`${heightClass} rounded-md border transition-all flex items-center justify-center cursor-pointer shadow-2xs relative shrink-0 hover:scale-105 ${
              isSelected
                ? "border-theme-accent ring-2 ring-theme-accent/60 scale-105 z-10"
                : "border-black/15 dark:border-white/20"
            }`}
          >
            {isSelected && (
              <Check className={`w-3.5 h-3.5 ${light ? "text-black" : "text-white"}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
