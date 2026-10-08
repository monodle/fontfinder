/**
 * Application Constants and System Bounds (SSOT)
 */

export const APP_THEMES = [
  { id: "clean-white", previewColors: ["#f6f7f9", "#ffffff", "#18181b"] },
  { id: "glass", previewColors: ["#e2e8f0", "#ffffff", "#0284c7"] },
  { id: "light", previewColors: ["#f8f4eb", "#ffffff", "#92400e"] },
  { id: "dark", previewColors: ["#1c1917", "#241f1c", "#d97706"] },
  { id: "nord", previewColors: ["#1e222a", "#252b36", "#7cb7eb"] },
  { id: "monochrome", previewColors: ["#121212", "#191919", "#e4e4e7"] },
  { id: "forest", previewColors: ["#141c18", "#1c2822", "#d4a373"] },
] as const;

export type AppTheme = typeof APP_THEMES[number]["id"];

export const VALID_THEMES: AppTheme[] = APP_THEMES.map((theme) => theme.id);

const LIBRARY_CATEGORIES = [
  "all",
  "system",
  "user",
  "activated",
  "favorites",
  "duplicates",
  "google_fonts",
  "fontsource",
] as const;

export type LibraryCategory = typeof LIBRARY_CATEGORIES[number];

/**
 * 환경 설정의 시작 라이브러리 카테고리 선택 옵션 (시스템 폰트 제외)
 */
export const STARTUP_LIBRARY_CATEGORIES = [
  "all",
  "user",
  "activated",
  "favorites",
  "duplicates",
] as const;

export type StartupLibraryCategory = typeof STARTUP_LIBRARY_CATEGORIES[number];


export const SETTINGS_BOUNDS = {
  fontSize: {
    min: 8,
    max: 200,
    defaultMin: 14,
    defaultMax: 72,
    defaultSize: 24,
    minInputLimit: 36,
    maxInputLimit: 144,
  },
  lineHeight: {
    min: 0.8,
    max: 3.0,
    sliderMin: 1.0,
    sliderMax: 2.5,
    default: 1.45,
    step: 0.05,
  },
  letterSpacing: {
    min: -20,
    max: 50,
    sliderMin: -2,
    sliderMax: 12,
    default: 0,
    step: 0.5,
  },
  gridColumns: {
    min: 2,
    max: 5,
    default: 2,
  },
  variableWeight: {
    min: 100,
    max: 900,
    default: 400,
  },
  toastDurationMs: {
    default: 2500,
  },
} as const;
