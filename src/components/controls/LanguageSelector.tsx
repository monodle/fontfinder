import { SUPPORTED_LANGUAGES } from "../../i18n";
import { Select, OptionCard, OptionCardGrid } from "../common";

export interface LanguageSelectorProps {
  selectedLanguage: string;
  onSelect: (code: string) => void;
  variant?: "grid" | "dropdown";
  columns?: 2 | 4;
  className?: string;
  disabled?: boolean;
}

export function LanguageSelector({
  selectedLanguage,
  onSelect,
  variant = "grid",
  columns = 4,
  className = "",
  disabled = false,
}: LanguageSelectorProps) {
  if (variant === "dropdown") {
    const selectOptions = SUPPORTED_LANGUAGES.map((lang) => ({
      value: lang.code,
      label: lang.label,
      subLabel: lang.englishLabel,
    }));

    return (
      <Select
        value={selectedLanguage}
        options={selectOptions}
        disabled={disabled}
        onChange={onSelect}
        className={className}
      />
    );
  }

  return (
    <OptionCardGrid columns={columns} gap="sm" className={className}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isSelected = selectedLanguage === lang.code;

        return (
          <OptionCard
            key={lang.code}
            title={lang.label}
            description={lang.englishLabel}
            selected={isSelected}
            disabled={disabled}
            onClick={() => onSelect(lang.code)}
            showCheckmark={false}
            variant="centered"
          />
        );
      })}
    </OptionCardGrid>
  );
}
