import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { APP_THEMES, AppTheme } from "../config/appConfig";

export interface ThemeSelectorProps {
  selectedTheme: AppTheme;
  onSelect: (theme: AppTheme) => void;
  columns?: 2 | 3;
  className?: string;
}

export function ThemeSelector({
  selectedTheme,
  onSelect,
  columns = 2,
  className = "",
}: ThemeSelectorProps) {
  const { t } = useTranslation();

  const gridClass =
    columns === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid gap-2.5 ${gridClass} ${className}`}>
      {APP_THEMES.map((th) => {
        const isSelected = selectedTheme === th.id;

        return (
          <button
            key={th.id}
            type="button"
            onClick={() => onSelect(th.id)}
            className={`group flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
              isSelected
                ? "border-theme-accent bg-theme-active/30 text-theme-text shadow-xs ring-1 ring-theme-accent/50"
                : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover"
            }`}
          >
            {/* 팔레트 색상 칩 (3색 프리뷰 도트) */}
            <div className="flex -space-x-1.5 pt-0.5 shrink-0">
              {th.previewColors.map((color, idx) => (
                <span
                  key={idx}
                  className="w-4 h-4 rounded-full border border-black/15 shadow-2xs inline-block"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* 테마 정보 */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`font-semibold text-xs truncate ${
                    isSelected ? "text-theme-accent" : "text-theme-text"
                  }`}
                >
                  {t(`settings.theme_${th.id}`)}
                </span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-theme-text-muted leading-tight line-clamp-2">
                {t(`settings.theme_${th.id}_desc`)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
