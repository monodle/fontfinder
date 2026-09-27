import { SUPPORTED_LANGUAGES } from "../i18n";

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
    return (
      <select
        value={selectedLanguage}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.value)}
        className={`bg-theme-input border border-theme-border rounded-lg px-3 py-1.5 text-xs text-theme-text font-medium focus:outline-none focus:border-theme-accent cursor-pointer shadow-2xs transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        } ${className}`}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label} ({lang.englishLabel})
          </option>
        ))}
      </select>
    );
  }

  const gridClass =
    columns === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid gap-2 ${gridClass} ${className}`}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isSelected = selectedLanguage === lang.code;

        return (
          <button
            key={lang.code}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(lang.code)}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer select-none ${
              isSelected
                ? "border-theme-accent bg-theme-active/30 text-theme-accent font-semibold shadow-2xs ring-1 ring-theme-accent/50"
                : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover hover:text-theme-text"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span className="text-xs">{lang.label}</span>
            <span className="text-[10px] text-theme-text-muted mt-0.5">
              {lang.englishLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
