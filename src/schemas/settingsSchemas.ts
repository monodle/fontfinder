import { z } from "zod";
import {
  STARTUP_LIBRARY_CATEGORIES,
  StartupLibraryCategory,
  SETTINGS_BOUNDS,
  AppTheme,
  VALID_THEMES,
} from "../config/appConfig";
import {
  SUPPORTED_LANGUAGE_CODES,
  SupportedLanguageCode,
  detectInitialLanguage,
  supportedLanguageCodeSchema,
} from "../i18n";
import {
  TEXT_ALIGN_OPTIONS,
  TextAlignOption,
  TEXT_TRANSFORM_OPTIONS,
  TextTransformOption,
  VIEW_MODES,
  ViewMode,
  FONT_DETAIL_MODES,
  FontDetailMode,
  PreviewSettings,
} from "../types/font";
import {
  FONT_SORT_MODES,
  FONT_SORT_FIELDS,
  FONT_SORT_ORDERS,
  FONT_SORT_BLOCKS,
  DEFAULT_SORT_SETTINGS,
  DEFAULT_SORT_BLOCK_ORDER,
  FontSortSettings,
  FontSortBlock,
} from "../types/sort";
import type { CustomAppSettings } from "../types/settings";
import { defaultPreviewSettings } from "../config/appConfig";
import { createHexColorSchema, sanitizeRawString } from "./commonSchemas";

/**
 * 정렬 설정 관련 Zod 스키마
 */
const fontSortModeSchema = z
  .enum(FONT_SORT_MODES)
  .catch(DEFAULT_SORT_SETTINGS.mode);

const fontSortNameFieldSchema = z
  .enum(FONT_SORT_FIELDS)
  .catch(DEFAULT_SORT_SETTINGS.nameField);

const fontSortNameOrderSchema = z
  .enum(FONT_SORT_ORDERS)
  .catch(DEFAULT_SORT_SETTINGS.nameOrder);

const fontSortCustomFieldSchema = z
  .enum(FONT_SORT_FIELDS)
  .catch(DEFAULT_SORT_SETTINGS.customField);

const fontSortCustomOrderSchema = z
  .enum(FONT_SORT_ORDERS)
  .catch(DEFAULT_SORT_SETTINGS.customOrder);

/**
 * 전체 폰트 정렬 설정 검증 및 정제 스키마
 */
export const createFontSortSettingsSchema = (
  fallback: FontSortSettings = { ...DEFAULT_SORT_SETTINGS, customPriority: [...DEFAULT_SORT_BLOCK_ORDER] }
) =>
  z
    .object({
      mode: fontSortModeSchema,
      nameField: fontSortNameFieldSchema,
      nameOrder: fontSortNameOrderSchema,
      customField: fontSortCustomFieldSchema,
      customOrder: fontSortCustomOrderSchema,
      customPriority: z
        .unknown()
        .optional()
        .transform((val): FontSortBlock[] => {
          if (!Array.isArray(val)) return [...DEFAULT_SORT_BLOCK_ORDER];
          const filtered = val.filter((b): b is FontSortBlock =>
            (FONT_SORT_BLOCKS as readonly unknown[]).includes(b)
          );
          for (const b of FONT_SORT_BLOCKS) {
            if (!filtered.includes(b)) {
              filtered.push(b);
            }
          }
          return filtered;
        }),
    })
    .catch(fallback);

/**
 * 테마 검증 스키마
 */
export const createThemeSchema = (fallback: AppTheme) =>
  z.enum(VALID_THEMES as [AppTheme, ...AppTheme[]]).catch(fallback);

/**
 * 지원 언어 검증 스키마
 */
export const supportedLanguageSchema = supportedLanguageCodeSchema.catch(
  () => detectInitialLanguage()
);

/**
 * 앱 설정 개별 필드 스키마 생성 헬퍼
 */
const createLibraryCategorySchema = (fallback: StartupLibraryCategory) => {
  const safeFallback: StartupLibraryCategory =
    (STARTUP_LIBRARY_CATEGORIES as readonly string[]).includes(fallback)
      ? fallback
      : "user";
  return z.enum(STARTUP_LIBRARY_CATEGORIES).catch(safeFallback);
};

const createTextAlignSchema = (fallback: TextAlignOption) =>
  z.enum(TEXT_ALIGN_OPTIONS).catch(fallback);

const createViewModeSchema = (fallback: ViewMode) =>
  z.enum(VIEW_MODES).catch(fallback);

const createFontDetailModeSchema = (fallback: FontDetailMode) =>
  z.enum(FONT_DETAIL_MODES).catch(fallback);

const createLanguageSchema = (fallback: SupportedLanguageCode) =>
  z.enum(SUPPORTED_LANGUAGE_CODES).catch(fallback);

const createLineHeightSchema = (fallback: number) =>
  z
    .number()
    .min(SETTINGS_BOUNDS.lineHeight.min)
    .max(SETTINGS_BOUNDS.lineHeight.max)
    .catch(fallback);

const createLetterSpacingSchema = (fallback: number) =>
  z
    .number()
    .min(SETTINGS_BOUNDS.letterSpacing.min)
    .max(SETTINGS_BOUNDS.letterSpacing.max)
    .catch(fallback);

const createFontSizeSchema = (fallback: number) =>
  z
    .number()
    .min(SETTINGS_BOUNDS.fontSize.min)
    .max(SETTINGS_BOUNDS.fontSize.max)
    .catch(fallback);

export const createGridColumnsSchema = (fallback: number = SETTINGS_BOUNDS.gridColumns.default) =>
  z.coerce
    .number()
    .catch(fallback)
    .transform((val) =>
      Math.min(
        SETTINGS_BOUNDS.gridColumns.max,
        Math.max(SETTINGS_BOUNDS.gridColumns.min, val)
      )
    );

/**
 * 전체 앱 설정(CustomAppSettings) 통합 검증 및 상호 의존성 정제 스키마
 */
export const createAppSettingsSchema = (fallback: CustomAppSettings) =>
  z
    .object({
      defaultCategory: createLibraryCategorySchema(fallback.defaultCategory),
      defaultPreviewText: z
        .unknown()
        .optional()
        .transform((v) =>
          typeof v === "string" ? sanitizeRawString(v, 5000, fallback.defaultPreviewText) : fallback.defaultPreviewText
        ),
      minFontSize: z.coerce
        .number()
        .catch(fallback.minFontSize)
        .transform((val) =>
          Math.min(
            SETTINGS_BOUNDS.fontSize.defaultMax,
            Math.max(SETTINGS_BOUNDS.fontSize.min, val)
          )
        ),
      maxFontSize: z.coerce.number().catch(fallback.maxFontSize),
      defaultFontSize: z.coerce.number().catch(fallback.defaultFontSize),
      defaultViewMode: createViewModeSchema(fallback.defaultViewMode),
      defaultFontDetailMode: createFontDetailModeSchema(fallback.defaultFontDetailMode),
      defaultGridColumns: createGridColumnsSchema(fallback.defaultGridColumns),
      defaultVariableWeight: z.coerce
        .number()
        .catch(fallback.defaultVariableWeight)
        .transform((val) =>
          Math.min(
            SETTINGS_BOUNDS.variableWeight.max,
            Math.max(SETTINGS_BOUNDS.variableWeight.min, val)
          )
        ),
      defaultTextColor: z
        .unknown()
        .optional()
        .transform((v) => (typeof v === "string" ? v : "")),
      defaultBackgroundColor: z
        .unknown()
        .optional()
        .transform((v) => (typeof v === "string" ? v : "")),
      defaultTextAlign: createTextAlignSchema(fallback.defaultTextAlign),
      defaultLineHeight: createLineHeightSchema(fallback.defaultLineHeight),
      defaultLetterSpacing: createLetterSpacingSchema(fallback.defaultLetterSpacing),
      defaultIsBold: z.coerce.boolean().catch(Boolean(fallback.defaultIsBold)),
      defaultIsItalic: z.coerce.boolean().catch(Boolean(fallback.defaultIsItalic)),
      defaultIsUnderline: z.coerce.boolean().catch(Boolean(fallback.defaultIsUnderline)),
      fontSortSettings: createFontSortSettingsSchema(fallback.fontSortSettings),
      language: createLanguageSchema(fallback.language),
      theme: createThemeSchema(fallback.theme),
      enableGoogleFonts: z.coerce.boolean().catch(fallback.enableGoogleFonts ?? false),
      enableFontsource: z.coerce.boolean().catch(fallback.enableFontsource ?? false),
    })
    .transform((data): CustomAppSettings => {
      const minFontSize = data.minFontSize;
      const maxFontSize = Math.min(
        SETTINGS_BOUNDS.fontSize.max,
        Math.max(minFontSize + 4, data.maxFontSize || fallback.maxFontSize)
      );
      const defaultFontSize = Math.min(
        maxFontSize,
        Math.max(minFontSize, data.defaultFontSize || fallback.defaultFontSize)
      );

      return {
        ...data,
        minFontSize,
        maxFontSize,
        defaultFontSize,
      };
    })
    .catch(fallback);

/**
 * 텍스트 변환 옵션 검증 스키마
 */
const createTextTransformSchema = (fallback: TextTransformOption = "none") =>
  z.enum(TEXT_TRANSFORM_OPTIONS).catch(fallback);

/**
 * 프리뷰 전체 설정 유효성 검증 및 Forgiving Normalization 스키마
 */
export const createPreviewSettingsSchema = (
  fallback: PreviewSettings = defaultPreviewSettings
): z.ZodType<PreviewSettings> =>
  z
    .object({
      text: z
        .unknown()
        .transform((v) => (typeof v === "string" ? sanitizeRawString(v, 500) : fallback.text))
        .catch(fallback.text),
      fontSize: createFontSizeSchema(fallback.fontSize),
      fontWeight: z.coerce.number().int().min(0).max(900).catch(fallback.fontWeight),
      isBold: z.coerce.boolean().catch(fallback.isBold),
      isItalic: z.coerce.boolean().catch(fallback.isItalic),
      isUnderline: z.coerce.boolean().catch(fallback.isUnderline),
      letterSpacing: createLetterSpacingSchema(fallback.letterSpacing),
      lineHeight: createLineHeightSchema(fallback.lineHeight),
      textAlign: createTextAlignSchema(fallback.textAlign),
      textTransform: createTextTransformSchema(fallback.textTransform),
      textColor: z
        .unknown()
        .transform((v) => {
          if (typeof v !== "string" || !v.trim()) return "";
          return createHexColorSchema("").parse(v);
        })
        .catch(fallback.textColor),
      backgroundColor: z
        .unknown()
        .transform((v) => {
          if (typeof v !== "string" || !v.trim()) return "";
          return createHexColorSchema("").parse(v);
        })
        .catch(fallback.backgroundColor),
    })
    .catch(fallback);



