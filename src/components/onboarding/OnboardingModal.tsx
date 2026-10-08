import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Globe, Palette, ArrowRight, Laptop, RefreshCw, Cloud, Package, Check } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  AppTheme,
  getDefaultPreviewText,
} from "../../config/appConfig";
import { ModalDialog } from "../common";
import { ThemeSelector } from "../controls/ThemeSelector";
import { LanguageSelector } from "../controls/LanguageSelector";
import { changeLanguage, SupportedLanguageCode } from "../../i18n";
import {
  settingsService,
  CustomAppSettings,
  applyTheme,
  sanitizeLanguage,
} from "../../services/settingsService";

interface OnboardingModalProps {
  isOpen: boolean;
  initialSettings: CustomAppSettings;
  onComplete: (savedSettings: CustomAppSettings) => void;
  scanProgress?: { current: number; total: number } | null;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialSettings,
  onComplete,
  scanProgress,
}) => {
  const { t, i18n } = useTranslation();

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageCode>(() =>
    sanitizeLanguage(initialSettings.language || i18n.language)
  );
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(
    initialSettings.theme || "glass"
  );
  const [enableGoogleFonts, setEnableGoogleFonts] = useState<boolean>(() =>
    Boolean(initialSettings.enableGoogleFonts)
  );
  const [enableFontsource, setEnableFontsource] = useState<boolean>(() =>
    Boolean(initialSettings.enableFontsource)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLanguageSelect = (code: string) => {
    const validLang = sanitizeLanguage(code);
    setSelectedLanguage(validLang);
    changeLanguage(validLang);
  };

  const handleThemeSelect = (theme: AppTheme) => {
    setSelectedTheme(theme);
    applyTheme(theme);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const updatedSettings: CustomAppSettings = {
        ...initialSettings,
        language: selectedLanguage,
        theme: selectedTheme,
        enableGoogleFonts,
        enableFontsource,
        defaultPreviewText: getDefaultPreviewText(selectedLanguage),
      };

      await settingsService.saveSettings(updatedSettings);
      await settingsService.completeOnboarding();
      onComplete(updatedSettings);
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      // 에러가 발생해도 사용자가 멈추지 않도록 진행
      onComplete(initialSettings);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => { }}
      closeOnEsc={false}
      closeOnBackdropClick={false}
      showCloseButton={false}
      maxWidth="xl"
      icon={<Sparkles className="w-4 h-4" />}
      title={t("onboarding.welcome_title")}
      subtitle={t("onboarding.welcome_subtitle")}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-theme-card border border-theme-border text-[11px] font-medium text-theme-text-muted">
          <Laptop className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t("onboarding.os_detected_badge")}</span>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-theme-text-muted">
            {scanProgress && scanProgress.total > 0 ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-theme-hover/60 border border-theme-border/60 animate-in fade-in">
                <RefreshCw className="w-3 h-3 animate-spin text-theme-accent shrink-0" />
                <span className="font-medium text-theme-text-secondary">
                  {t("onboarding.scanning_status")}
                </span>
                <span className="font-mono text-theme-accent text-[10px]">
                  {Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100))}%
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-theme-accent text-theme-accent-text font-semibold text-xs hover:brightness-110 active:brightness-95 transition-all shadow-md cursor-pointer disabled:opacity-60"
          >
            <span>{t("onboarding.start_button")}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-theme-text">
        {/* 1. 언어 선택 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-theme-border-subtle">
            <Globe className="w-4 h-4 text-theme-accent" />
            <h3 className="font-semibold text-xs text-theme-text">
              {t("onboarding.language_label")}
            </h3>
          </div>
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onSelect={handleLanguageSelect}
            columns={4}
          />
        </section>

        {/* 2. 테마 선택 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-theme-border-subtle">
            <Palette className="w-4 h-4 text-theme-accent" />
            <h3 className="font-semibold text-xs text-theme-text">
              {t("onboarding.theme_label")}
            </h3>
          </div>
          <ThemeSelector
            selectedTheme={selectedTheme}
            onSelect={handleThemeSelect}
            columns={2}
          />
        </section>

        {/* 3. 온라인 폰트 라이브러리 연동 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-theme-border-subtle">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-theme-accent" />
              <h3 className="font-semibold text-xs text-theme-text">
                {t("onboarding.online_providers_label")}
              </h3>
            </div>
            <span className="text-[10px] text-theme-text-muted">
              {t("onboarding.online_providers_desc")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Google Fonts 카드 */}
            <div
              onClick={() => setEnableGoogleFonts((prev) => !prev)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer select-none",
                enableGoogleFonts
                  ? "border-theme-accent bg-theme-active/30 text-theme-text shadow-2xs ring-1 ring-theme-accent/40"
                  : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover"
              )}
            >
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500 shrink-0 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-theme-text">
                    {t("onboarding.google_fonts_label")}
                  </span>
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                      enableGoogleFonts
                        ? "bg-theme-accent border-theme-accent text-theme-accent-text"
                        : "border-theme-border bg-theme-surface"
                    )}
                  >
                    {enableGoogleFonts && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
                <p className="text-[11px] text-theme-text-muted mt-1 line-clamp-2 leading-relaxed">
                  {t("onboarding.google_fonts_desc")}
                </p>
              </div>
            </div>

            {/* Font Source 카드 */}
            <div
              onClick={() => setEnableFontsource((prev) => !prev)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer select-none",
                enableFontsource
                  ? "border-theme-accent bg-theme-active/30 text-theme-text shadow-2xs ring-1 ring-theme-accent/40"
                  : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover"
              )}
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
                <Package className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-theme-text">
                    {t("onboarding.fontsource_label")}
                  </span>
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                      enableFontsource
                        ? "bg-theme-accent border-theme-accent text-theme-accent-text"
                        : "border-theme-border bg-theme-surface"
                    )}
                  >
                    {enableFontsource && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
                <p className="text-[11px] text-theme-text-muted mt-1 line-clamp-2 leading-relaxed">
                  {t("onboarding.fontsource_desc")}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ModalDialog>
  );
};

