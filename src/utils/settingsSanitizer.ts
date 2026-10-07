import {
  appConfig,
  getDefaultPreviewText,
  defaultPreviewSettings,
  AppTheme,
  SETTINGS_BOUNDS,
} from "../config/appConfig";
import { detectInitialLanguage, SupportedLanguageCode } from "../i18n";
import {
  FontSortSettings,
  DEFAULT_SORT_SETTINGS,
  DEFAULT_SORT_BLOCK_ORDER,
} from "../types/sort";
import type { PreviewSettings } from "../types/font";
import type { CustomAppSettings } from "../types/settings";
import { getInitialThemeByOS } from "./themeUtils";

import {
  supportedLanguageSchema,
  createFontSortSettingsSchema,
  createAppSettingsSchema,
  createPreviewSettingsSchema,
} from "../schemas";

export function sanitizeFontSortSettings(raw: unknown): FontSortSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SORT_SETTINGS, customPriority: [...DEFAULT_SORT_BLOCK_ORDER] };
  }
  return createFontSortSettingsSchema().parse(raw);
}

export function sanitizeLanguage(candidate: unknown): SupportedLanguageCode {
  return supportedLanguageSchema.parse(candidate);
}

export function sanitizePreviewSettings(
  raw: unknown,
  fallback: PreviewSettings = defaultPreviewSettings
): PreviewSettings {
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  return createPreviewSettingsSchema(fallback).parse(raw);
}

export function createDefaultSettings(lang?: SupportedLanguageCode, theme?: AppTheme): CustomAppSettings {
  const resolvedLang = lang ?? detectInitialLanguage();
  const resolvedTheme = theme ?? getInitialThemeByOS();
  return {
    defaultCategory: appConfig.library.defaultCategory,
    defaultPreviewText: getDefaultPreviewText(resolvedLang),
    defaultFontSize: appConfig.preview.defaultFontSize,
    minFontSize: appConfig.preview.minFontSize,
    maxFontSize: appConfig.preview.maxFontSize,
    defaultViewMode: appConfig.preview.defaultViewMode,
    defaultFontDetailMode: appConfig.preview.defaultFontDetailMode,
    defaultGridColumns: appConfig.preview.defaultGridColumns,
    defaultVariableWeight: appConfig.variableFont.defaultWeight,
    defaultTextColor: "",
    defaultBackgroundColor: "",
    defaultTextAlign: "left",
    defaultLineHeight: SETTINGS_BOUNDS.lineHeight.default,
    defaultLetterSpacing: SETTINGS_BOUNDS.letterSpacing.default,
    defaultIsBold: false,
    defaultIsItalic: false,
    defaultIsUnderline: false,
    fontSortSettings: { ...DEFAULT_SORT_SETTINGS, customPriority: [...DEFAULT_SORT_BLOCK_ORDER] },
    language: resolvedLang,
    theme: resolvedTheme,
  };
}

export const defaultSettings: CustomAppSettings = createDefaultSettings();

export function getDefaultSettings(lang?: SupportedLanguageCode): CustomAppSettings {
  const targetLang = lang ?? detectInitialLanguage();
  return {
    ...defaultSettings,
    language: targetLang,
    defaultPreviewText: getDefaultPreviewText(targetLang),
  };
}

export function sanitizeSettings(raw: unknown, fallback: CustomAppSettings = defaultSettings): CustomAppSettings {
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  return createAppSettingsSchema(fallback).parse(raw);
}

