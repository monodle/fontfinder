/**
 * Application Configuration
 * Loads settings from Vite environment variables with safe defaults and Zod validation.
 */

import i18n, { SUPPORTED_LANGUAGES } from "../i18n";
import { getParsedAppEnv } from "../schemas/envSchemas";
import { SETTINGS_BOUNDS } from "./constants";
import type { PreviewSettings } from "../types/font";

export * from "./constants";

export function getDefaultPreviewText(lang = "ko"): string {
  const text = i18n.t("preview.default_text", { lng: lang });
  if (text && text !== "preview.default_text") {
    return text;
  }
  return i18n.t("preview.default_text", { lng: "ko" });
}

export function isDefaultPreviewText(text: string): boolean {
  if (!text || text.trim() === "") return true;
  const trimmed = text.trim();
  return SUPPORTED_LANGUAGES.some(
    ({ code }) => i18n.t("preview.default_text", { lng: code }).trim() === trimmed
  );
}

const defaultPreviewText = getDefaultPreviewText("ko");

// 런타임 환경 변수 파싱 (Zod 검증 적용)
const parsedEnv = getParsedAppEnv(import.meta.env);

export const appConfig = {
  app: {
    name: parsedEnv.VITE_APP_NAME,
    version: parsedEnv.VITE_APP_VERSION,
  },
  links: {
    githubRepo: parsedEnv.VITE_GITHUB_REPO_URL,
    sponsorUrl: parsedEnv.VITE_SPONSOR_URL,
  },
  library: {
    defaultCategory: parsedEnv.VITE_DEFAULT_CATEGORY,
  },
  preview: {
    defaultText: defaultPreviewText,
    defaultFontSize: parsedEnv.VITE_DEFAULT_FONT_SIZE,
    minFontSize: parsedEnv.VITE_MIN_FONT_SIZE,
    maxFontSize: parsedEnv.VITE_MAX_FONT_SIZE,
    defaultViewMode: parsedEnv.VITE_DEFAULT_VIEW_MODE,
    defaultFontDetailMode: parsedEnv.VITE_DEFAULT_FONT_DETAIL_MODE,
    defaultGridColumns: parsedEnv.VITE_DEFAULT_GRID_COLUMNS,
  },
  variableFont: {
    defaultWeight: parsedEnv.VITE_DEFAULT_VARIABLE_WEIGHT,
  },
  performance: {
    virtualScrollOverscan: parsedEnv.VITE_VIRTUAL_SCROLL_OVERSCAN,
  },
  ui: {
    toastDurationMs: parsedEnv.VITE_TOAST_DURATION_MS,
  },
} as const;

export const defaultPreviewSettings: PreviewSettings = {
  text: defaultPreviewText,
  fontSize: appConfig.preview.defaultFontSize,
  fontWeight: 0,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  letterSpacing: SETTINGS_BOUNDS.letterSpacing.default,
  lineHeight: SETTINGS_BOUNDS.lineHeight.default,
  textAlign: "left",
  textTransform: "none",
  textColor: "",
  backgroundColor: "",
};
