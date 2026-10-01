import { useTranslation } from "react-i18next";
import { APP_THEMES, AppTheme } from "../config/appConfig";
import { OptionCard, OptionCardGrid } from "./common";

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

  return (
    <OptionCardGrid columns={columns} gap="md" className={className}>
      {APP_THEMES.map((th) => {
        const isSelected = selectedTheme === th.id;

        const colorDots = (
          <div className="flex -space-x-1.5 pt-0.5 shrink-0">
            {th.previewColors.map((color, idx) => (
              <span
                key={idx}
                className="w-4 h-4 rounded-full border border-black/15 shadow-2xs inline-block"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        );

        return (
          <OptionCard
            key={th.id}
            title={t(`settings.theme_${th.id}`)}
            icon={colorDots}
            selected={isSelected}
            onClick={() => onSelect(th.id)}
            variant="horizontal"
          />
        );
      })}
    </OptionCardGrid>
  );
}
