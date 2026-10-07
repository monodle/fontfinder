import type { AppTheme } from "../config/appConfig";
import { STORAGE_KEYS, DB_SETTINGS_KEYS } from "../config/storageKeys";
import { fontService } from "./fontService";
import type { SupportedLanguageCode } from "../i18n";
import { DEFAULT_SORT_SETTINGS, DEFAULT_SORT_BLOCK_ORDER } from "../types/sort";
import type { CustomAppSettings } from "../types/settings";
import { applyTheme, getInitialThemeByOS, sanitizeTheme } from "../utils/themeUtils";
import {
  defaultSettings,
  getDefaultSettings,
  sanitizeSettings,
  sanitizeLanguage,
  sanitizeFontSortSettings,
} from "../utils/settingsSanitizer";

import { storageBooleanSchema } from "../schemas";

// 하위 호환성을 위한 re-export
export type { CustomAppSettings } from "../types/settings";
export {
  defaultSettings,
  getDefaultSettings,
  sanitizeSettings,
  sanitizeLanguage,
  sanitizeFontSortSettings,
} from "../utils/settingsSanitizer";
export { applyTheme, isLightTheme, getInitialThemeByOS, sanitizeTheme } from "../utils/themeUtils";

const DB_SETTINGS_KEY = DB_SETTINGS_KEYS.USER_SETTINGS;
const DB_ONBOARDING_KEY = DB_SETTINGS_KEYS.ONBOARDING_COMPLETED;

export const settingsService = {
  getInitialSettings(): CustomAppSettings {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      if (cached) {
        const settings = sanitizeSettings(JSON.parse(cached));
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
        const merged = sanitizeSettings(JSON.parse(dbValue));
        applyTheme(merged.theme);
        localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      console.warn("Failed to load settings from DB, using cached/default:", e);
    }

    // 저장된 설정이 없는 최초 시작 시: OS 네이티브 테마(Windows 레지스트리/시스템 테마)를 정확히 판별하여 반영
    try {
      const osTheme = await fontService.getSystemTheme();
      const initialTheme: AppTheme = osTheme === "dark" ? "nord" : "glass";
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
    const validTheme = sanitizeTheme(settings.theme, defaultSettings.theme);
    const validSettings: CustomAppSettings = {
      ...settings,
      theme: validTheme,
      fontSortSettings: sanitizeFontSortSettings(settings.fontSortSettings),
    };
    applyTheme(validTheme);
    const jsonStr = JSON.stringify(validSettings);
    localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, jsonStr);
    try {
      await fontService.setSetting(DB_SETTINGS_KEY, jsonStr);
    } catch (e) {
      console.error("Failed to save settings to DB:", e);
    }
  },

  async resetSettings(preserve?: { language?: SupportedLanguageCode; theme?: AppTheme }): Promise<CustomAppSettings> {
    const current = this.getInitialSettings();
    const targetLang = preserve?.language ? sanitizeLanguage(preserve.language) : current.language;
    const targetTheme = sanitizeTheme(preserve?.theme ?? current.theme, current.theme);
    const defaults = getDefaultSettings(targetLang);

    const mergedSettings: CustomAppSettings = {
      ...defaults,
      language: targetLang,
      theme: targetTheme,
      fontSortSettings: { ...DEFAULT_SORT_SETTINGS, customPriority: [...DEFAULT_SORT_BLOCK_ORDER] },
    };

    await this.saveSettings(mergedSettings);
    return mergedSettings;
  },

  hasCompletedOnboarding(): boolean {
    try {
      if (localStorage.getItem(STORAGE_KEYS.USER_SETTINGS)) {
        return true;
      }
      return storageBooleanSchema.parse(localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED));
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
      if (storageBooleanSchema.parse(dbVal)) {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
        return true;
      }
      const dbSettings = await fontService.getSetting(DB_SETTINGS_KEY);
      if (dbSettings) {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
        return true;
      }
    } catch (e) {
      console.warn("Failed to check onboarding status from DB:", e);
    }
    return false;
  },

  async completeOnboarding(): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
      await fontService.setSetting(DB_ONBOARDING_KEY, "true");
    } catch (e) {
      console.error("Failed to complete onboarding:", e);
    }
  },
};
