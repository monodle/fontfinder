import { z } from "zod";
import {
  STARTUP_LIBRARY_CATEGORIES,
  SETTINGS_BOUNDS,
  type StartupLibraryCategory,
} from "../config/constants";
import { sanitizeRawString } from "./commonSchemas";

/**
 * Vite 환경 변수(import.meta.env) 엄격 검증 및 기본값 정규화 스키마
 */
const appEnvSchema = z
  .object({
    VITE_APP_NAME: z
      .unknown()
      .optional()
      .transform((val) => sanitizeRawString(val, 100, "Font Finder") || "Font Finder"),
    VITE_APP_VERSION: z
      .unknown()
      .optional()
      .transform((val) => sanitizeRawString(val, 50, "v2.0") || "v2.0"),
    VITE_GITHUB_REPO_URL: z
      .unknown()
      .optional()
      .transform(
        (val) =>
          sanitizeRawString(val, 255, "https://github.com/monodle/fontfinder") ||
          "https://github.com/monodle/fontfinder"
      ),
    VITE_SPONSOR_URL: z
      .unknown()
      .optional()
      .transform(
        (val) =>
          sanitizeRawString(val, 255, "https://ko-fi.com/fontfinder/tip") ||
          "https://ko-fi.com/fontfinder/tip"
      ),
    VITE_DEFAULT_CATEGORY: z
      .unknown()
      .optional()
      .transform((val): StartupLibraryCategory => {
        if (typeof val === "string") {
          const lower = val.toLowerCase().trim() as StartupLibraryCategory;
          if ((STARTUP_LIBRARY_CATEGORIES as readonly string[]).includes(lower)) {
            return lower;
          }
        }
        return "user";
      }),
    VITE_DEFAULT_FONT_SIZE: z.coerce
      .number()
      .catch(SETTINGS_BOUNDS.fontSize.defaultSize),
    VITE_MIN_FONT_SIZE: z.coerce
      .number()
      .catch(SETTINGS_BOUNDS.fontSize.defaultMin),
    VITE_MAX_FONT_SIZE: z.coerce
      .number()
      .catch(SETTINGS_BOUNDS.fontSize.defaultMax),
    VITE_DEFAULT_VIEW_MODE: z
      .unknown()
      .optional()
      .transform((val): "list" | "grid" => (val === "grid" ? "grid" : "list")),
    VITE_DEFAULT_FONT_DETAIL_MODE: z
      .unknown()
      .optional()
      .transform((val): "detailed" | "simple" =>
        val === "simple" ? "simple" : "detailed"
      ),
    VITE_DEFAULT_GRID_COLUMNS: z.coerce
      .number()
      .catch(SETTINGS_BOUNDS.gridColumns.default)
      .transform((val) =>
        Math.min(
          SETTINGS_BOUNDS.gridColumns.max,
          Math.max(SETTINGS_BOUNDS.gridColumns.min, val)
        )
      ),
    VITE_DEFAULT_VARIABLE_WEIGHT: z.coerce
      .number()
      .catch(SETTINGS_BOUNDS.variableWeight.default),
    VITE_VIRTUAL_SCROLL_OVERSCAN: z.coerce.number().catch(5),
    VITE_TOAST_DURATION_MS: z.coerce
      .number()
      .catch(SETTINGS_BOUNDS.toastDurationMs.default),
  })
  .passthrough();

export type AppEnv = z.infer<typeof appEnvSchema>;

/**
 * 런타임 환경 변수 파싱 및 안전한 폴백 반환
 */
export function getParsedAppEnv(rawEnv: unknown): AppEnv {
  return appEnvSchema.parse(rawEnv ?? {});
}
