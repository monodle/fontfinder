import {
  appConfig,
  LibraryCategory,
  getDefaultPreviewText,
  AppTheme,
  VALID_THEMES,
} from "../config/appConfig";
import { fontService } from "./fontService";
import { detectInitialLanguage } from "../i18n";

export interface CustomAppSettings {
  defaultCategory: LibraryCategory;
  defaultPreviewText: string;
  defaultFontSize: number;
  minFontSize: number;
  maxFontSize: number;
  defaultViewMode: "list" | "grid";
  defaultGridColumns: number;
  defaultVariableWeight: number;
  defaultTextColor: string;
  defaultBackgroundColor: string;
  defaultTextAlign: "left" | "center" | "right";
  defaultLineHeight: number;
  defaultLetterSpacing: number;
  defaultIsBold?: boolean;
  defaultIsItalic?: boolean;
  defaultIsUnderline?: boolean;
  language: string;
  theme: AppTheme;
}

function getInitialThemeByOS(): AppTheme {
  if (typeof window !== "undefined" && window.matchMedia) {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDark ? "dark" : "light";
  }
  return "light";
}

function createDefaultSettings(lang?: string, theme?: AppTheme): CustomAppSettings {
  const resolvedLang = lang ?? detectInitialLanguage();
  const resolvedTheme = theme ?? getInitialThemeByOS();
  return {
    defaultCategory: appConfig.library.defaultCategory,
    defaultPreviewText: getDefaultPreviewText(resolvedLang),
    defaultFontSize: appConfig.preview.defaultFontSize,
    minFontSize: appConfig.preview.minFontSize,
    maxFontSize: appConfig.preview.maxFontSize,
    defaultViewMode: appConfig.preview.defaultViewMode,
    defaultGridColumns: appConfig.preview.defaultGridColumns,
    defaultVariableWeight: appConfig.variableFont.defaultWeight,
    defaultTextColor: "",
    defaultBackgroundColor: "",
    defaultTextAlign: "left",
    defaultLineHeight: 1.45,
    defaultLetterSpacing: 0,
    defaultIsBold: false,
    defaultIsItalic: false,
    defaultIsUnderline: false,
    language: resolvedLang,
    theme: resolvedTheme,
  };
}

export const defaultSettings: CustomAppSettings = createDefaultSettings();

export function getDefaultSettings(lang?: string): CustomAppSettings {
  const targetLang = lang ?? detectInitialLanguage();
  return {
    ...defaultSettings,
    language: targetLang,
    defaultPreviewText: getDefaultPreviewText(targetLang),
  };
}

function isLightTheme(theme: AppTheme): boolean {
  return theme === "light" || theme === "clean-white" || theme === "glass";
}

export function applyTheme(theme: AppTheme): void {
  const validTheme = VALID_THEMES.includes(theme) ? theme : "clean-white";
  document.documentElement.setAttribute("data-theme", validTheme);
  // data-theme-mode: dark계열과 light계열 구분용
  const isLight = isLightTheme(validTheme);
  if (isLight) {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }

  // OS 윈도우 창 프레임 및 타이틀바 테마 동기화
  void fontService.setWindowTheme(isLight ? "light" : "dark");
}

function sanitizeTheme(themeCandidate: unknown): AppTheme {
  if (typeof themeCandidate === "string" && VALID_THEMES.includes(themeCandidate as AppTheme)) {
    return themeCandidate as AppTheme;
  }
  return defaultSettings.theme;
}

const STORAGE_KEY = "fontfinder_user_settings";
const DB_SETTINGS_KEY = "user_app_settings";
const ONBOARDING_COMPLETED_KEY = "fontfinder_onboarding_completed";
const DB_ONBOARDING_KEY = "onboarding_completed";

export const settingsService = {
  getInitialSettings(): CustomAppSettings {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const settings: CustomAppSettings = {
          ...defaultSettings,
          ...parsed,
          theme: sanitizeTheme(parsed.theme),
          minFontSize: Math.max(8, Number(parsed.minFontSize) || defaultSettings.minFontSize),
          maxFontSize: Math.max(20, Number(parsed.maxFontSize) || defaultSettings.maxFontSize),
          defaultFontSize: Math.max(8, Number(parsed.defaultFontSize) || defaultSettings.defaultFontSize),
          defaultGridColumns: Math.min(5, Math.max(2, Number(parsed.defaultGridColumns) || defaultSettings.defaultGridColumns)),
          defaultVariableWeight: Math.min(900, Math.max(100, Number(parsed.defaultVariableWeight) || defaultSettings.defaultVariableWeight)),
          defaultTextColor: typeof parsed.defaultTextColor === "string" ? parsed.defaultTextColor : "",
          defaultBackgroundColor: typeof parsed.defaultBackgroundColor === "string" ? parsed.defaultBackgroundColor : "",
          defaultTextAlign: ["left", "center", "right"].includes(parsed.defaultTextAlign) ? parsed.defaultTextAlign : "left",
          defaultLineHeight: typeof parsed.defaultLineHeight === "number" ? Math.min(2.5, Math.max(1.0, parsed.defaultLineHeight)) : 1.45,
          defaultLetterSpacing: typeof parsed.defaultLetterSpacing === "number" ? Math.min(12, Math.max(-2, parsed.defaultLetterSpacing)) : 0,
          defaultIsBold: Boolean(parsed.defaultIsBold),
          defaultIsItalic: Boolean(parsed.defaultIsItalic),
          defaultIsUnderline: Boolean(parsed.defaultIsUnderline),
        };
        applyTheme(settings.theme);
        return settings;
      }
    } catch (e) {
      console.error("Failed to parse cached settings:", e);
    }
    const initialTheme = getInitialThemeByOS();
    applyTheme(initialTheme);
    return {
      ...defaultSettings,
      theme: initialTheme,
    };
  },

  async loadSettings(): Promise<CustomAppSettings> {
    try {
      const dbValue = await fontService.getSetting(DB_SETTINGS_KEY);
      if (dbValue) {
        const parsed = JSON.parse(dbValue);
        const merged: CustomAppSettings = {
          ...defaultSettings,
          ...parsed,
          theme: sanitizeTheme(parsed.theme),
          minFontSize: Math.max(8, Number(parsed.minFontSize) || defaultSettings.minFontSize),
          maxFontSize: Math.max(20, Number(parsed.maxFontSize) || defaultSettings.maxFontSize),
          defaultFontSize: Math.max(8, Number(parsed.defaultFontSize) || defaultSettings.defaultFontSize),
          defaultGridColumns: Math.min(5, Math.max(2, Number(parsed.defaultGridColumns) || defaultSettings.defaultGridColumns)),
          defaultVariableWeight: Math.min(900, Math.max(100, Number(parsed.defaultVariableWeight) || defaultSettings.defaultVariableWeight)),
          defaultTextColor: typeof parsed.defaultTextColor === "string" ? parsed.defaultTextColor : "",
          defaultBackgroundColor: typeof parsed.defaultBackgroundColor === "string" ? parsed.defaultBackgroundColor : "",
          defaultTextAlign: ["left", "center", "right"].includes(parsed.defaultTextAlign) ? parsed.defaultTextAlign : "left",
          defaultLineHeight: typeof parsed.defaultLineHeight === "number" ? Math.min(2.5, Math.max(1.0, parsed.defaultLineHeight)) : 1.45,
          defaultLetterSpacing: typeof parsed.defaultLetterSpacing === "number" ? Math.min(12, Math.max(-2, parsed.defaultLetterSpacing)) : 0,
          defaultIsBold: Boolean(parsed.defaultIsBold),
          defaultIsItalic: Boolean(parsed.defaultIsItalic),
          defaultIsUnderline: Boolean(parsed.defaultIsUnderline),
        };
        applyTheme(merged.theme);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      console.warn("Failed to load settings from DB, using cached/default:", e);
    }

    // 저장된 설정이 없는 최초 시작 시: OS 네이티브 테마(Windows 레지스트리/시스템 테마)를 정확히 판별하여 반영
    try {
      const osTheme = await fontService.getSystemTheme();
      const initialTheme: AppTheme = osTheme === "dark" ? "dark" : "light";
      const initialSettings: CustomAppSettings = {
        ...defaultSettings,
        theme: initialTheme,
      };
      applyTheme(initialTheme);
      return initialSettings;
    } catch {
      return this.getInitialSettings();
    }
  },

  async saveSettings(settings: CustomAppSettings): Promise<void> {
    const validTheme = sanitizeTheme(settings.theme);
    const validSettings: CustomAppSettings = {
      ...settings,
      theme: validTheme,
    };
    applyTheme(validTheme);
    const jsonStr = JSON.stringify(validSettings);
    localStorage.setItem(STORAGE_KEY, jsonStr);
    try {
      await fontService.setSetting(DB_SETTINGS_KEY, jsonStr);
    } catch (e) {
      console.error("Failed to save settings to DB:", e);
    }
  },

  async resetSettings(preserve?: { language?: string; theme?: AppTheme }): Promise<CustomAppSettings> {
    const current = this.getInitialSettings();
    const targetLang = preserve?.language ?? current.language;
    const targetTheme = sanitizeTheme(preserve?.theme ?? current.theme);
    const defaults = getDefaultSettings(targetLang);

    const mergedSettings: CustomAppSettings = {
      ...defaults,
      language: targetLang,
      theme: targetTheme,
    };

    await this.saveSettings(mergedSettings);
    return mergedSettings;
  },

  hasCompletedOnboarding(): boolean {
    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        return true;
      }
      return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
    } catch {
      return false;
    }
  },

  async checkOnboardingStatus(): Promise<boolean> {
    if (this.hasCompletedOnboarding()) {
      return true;
    }
    try {
      const dbVal = await fontService.getSetting(DB_ONBOARDING_KEY);
      if (dbVal === "true") {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
        return true;
      }
      const dbSettings = await fontService.getSetting(DB_SETTINGS_KEY);
      if (dbSettings) {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
        return true;
      }
    } catch (e) {
      console.warn("Failed to check onboarding status from DB:", e);
    }
    return false;
  },

  async completeOnboarding(): Promise<void> {
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
      await fontService.setSetting(DB_ONBOARDING_KEY, "true");
    } catch (e) {
      console.error("Failed to complete onboarding:", e);
    }
  },
};
