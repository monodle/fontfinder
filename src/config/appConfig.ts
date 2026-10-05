/**
 * Application Configuration
 * Loads settings from Vite environment variables with safe defaults.
 */

function getEnvString(key: string, defaultValue: string): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .replace(/^["']|["']$/g, "")
      .replace(/\\n/g, "\n");
  }
  return defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env[key];
  if (value !== undefined && value !== null) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

const LOCALE_DEFAULT_PREVIEW_TEXTS: Record<string, string> = {
  ko: "다람쥐 헌 쳇바퀴에 타고파\nThe quick brown fox jumps over the lazy dog\n1234567890",
  en: "The quick brown fox jumps over the lazy dog\nPack my box with five dozen liquor jugs\n1234567890",
  es: "El veloz murciélago hindú comía feliz cardillo y kiwi\nThe quick brown fox jumps over the lazy dog\n1234567890",
  ja: "色は匂へど 散りぬるを 我が世誰ぞ 常ならむ\nThe quick brown fox jumps over the lazy dog\n1234567890",
  "zh-CN": "天地玄黄 宇宙洪荒 日月盈昃 辰宿列张\nThe quick brown fox jumps over the lazy dog\n1234567890",
  "zh-TW": "天地玄黃 宇宙洪荒 日月盈昃 辰宿列張\nThe quick brown fox jumps over the lazy dog\n1234567890",
  de: "Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich\nThe quick brown fox jumps over the lazy dog\n1234567890",
  fr: "Portez ce vieux whisky au juge blond qui fume\nThe quick brown fox jumps over the lazy dog\n1234567890",
};

export function getDefaultPreviewText(lang = "ko"): string {
  return LOCALE_DEFAULT_PREVIEW_TEXTS[lang] || LOCALE_DEFAULT_PREVIEW_TEXTS.ko;
}

const LEGACY_DEFAULT_PREVIEW_TEXTS = [
  "다람쥐 헌 쳇바퀴에 타고파\nThe quick brown fox jumps over the lazy dog\n1234567890",
  "다람쥐 헌 쳇바퀴에 타고파. The quick brown fox jumps over the lazy dog. 1234567890 !@#$%^&*",
];

export function isDefaultPreviewText(text: string): boolean {
  if (!text || text.trim() === "") return true;
  const trimmed = text.trim();
  if (Object.values(LOCALE_DEFAULT_PREVIEW_TEXTS).some((t) => t.trim() === trimmed)) {
    return true;
  }
  return LEGACY_DEFAULT_PREVIEW_TEXTS.some((t) => t.trim() === trimmed);
}

export type AppTheme =
  | "clean-white"
  | "glass"
  | "light"
  | "dark"
  | "nord"
  | "monochrome"
  | "forest";

export interface ThemeOption {
  id: AppTheme;
  previewColors: [string, string, string]; // [bg, surface, accent]
}

export const APP_THEMES: ThemeOption[] = [
  { id: "clean-white", previewColors: ["#f6f7f9", "#ffffff", "#18181b"] },
  { id: "glass", previewColors: ["#e2e8f0", "#ffffff", "#0284c7"] },
  { id: "light", previewColors: ["#f8f4eb", "#ffffff", "#92400e"] },
  { id: "dark", previewColors: ["#1c1917", "#241f1c", "#d97706"] },
  { id: "nord", previewColors: ["#1e222a", "#252b36", "#7cb7eb"] },
  { id: "monochrome", previewColors: ["#121212", "#191919", "#e4e4e7"] },
  { id: "forest", previewColors: ["#141c18", "#1c2822", "#d4a373"] },
];

export const VALID_THEMES: AppTheme[] = [
  "clean-white",
  "glass",
  "light",
  "dark",
  "nord",
  "monochrome",
  "forest",
];

const defaultPreviewText = getDefaultPreviewText("ko");

export type LibraryCategory =
  | "all"
  | "user"
  | "system"
  | "activated"
  | "favorites"
  | "duplicates";

const VALID_CATEGORIES: LibraryCategory[] = [
  "all",
  "user",
  "system",
  "activated",
  "favorites",
  "duplicates",
];

function getEnvCategory(key: string, defaultValue: LibraryCategory): LibraryCategory {
  const val = getEnvString(key, defaultValue).toLowerCase();
  return (VALID_CATEGORIES.includes(val as LibraryCategory)
    ? val
    : defaultValue) as LibraryCategory;
}

export const appConfig = {
  app: {
    name: getEnvString("VITE_APP_NAME", "Font Finder"),
    version: getEnvString("VITE_APP_VERSION", "v2.0"),
  },
  links: {
    githubRepo: getEnvString("VITE_GITHUB_REPO_URL", "https://github.com/monodle/fontfinder"),
    sponsorUrl: getEnvString("VITE_SPONSOR_URL", "https://ko-fi.com/fontfinder/tip"),
  },
  library: {
    defaultCategory: getEnvCategory("VITE_DEFAULT_CATEGORY", "user"),
  },
  preview: {
    defaultText: defaultPreviewText,
    defaultFontSize: getEnvNumber("VITE_DEFAULT_FONT_SIZE", 24),
    minFontSize: getEnvNumber("VITE_MIN_FONT_SIZE", 14),
    maxFontSize: getEnvNumber("VITE_MAX_FONT_SIZE", 72),
    defaultViewMode: (getEnvString("VITE_DEFAULT_VIEW_MODE", "list") === "grid"
      ? "grid"
      : "list") as "list" | "grid",
    defaultFontDetailMode: (getEnvString("VITE_DEFAULT_FONT_DETAIL_MODE", "detailed") === "simple"
      ? "simple"
      : "detailed") as "detailed" | "simple",
    defaultGridColumns: Math.min(
      Math.max(getEnvNumber("VITE_DEFAULT_GRID_COLUMNS", 2), 2),
      5
    ),
  },
  variableFont: {
    defaultWeight: getEnvNumber("VITE_DEFAULT_VARIABLE_WEIGHT", 400),
  },
  performance: {
    virtualScrollOverscan: getEnvNumber("VITE_VIRTUAL_SCROLL_OVERSCAN", 5),
  },
  ui: {
    toastDurationMs: getEnvNumber("VITE_TOAST_DURATION_MS", 2500),
  },
} as const;

export const defaultPreviewSettings = {
  text: defaultPreviewText,
  fontSize: appConfig.preview.defaultFontSize,
  fontWeight: 0,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  letterSpacing: 0,
  lineHeight: 1.45,
  textAlign: "left" as const,
  textTransform: "none" as const,
  textColor: "",
  backgroundColor: "",
};

