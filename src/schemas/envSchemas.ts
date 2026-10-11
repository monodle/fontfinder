import { z } from "zod";
import {
  STARTUP_LIBRARY_CATEGORIES,
  SETTINGS_BOUNDS,
  type StartupLibraryCategory,
} from "../config/constants";
import { sanitizeRawString } from "./commonSchemas";

/**
 * 추천 폰트 저장소 URL 정규화
 * 1. GitHub 저장소 주소(https://github.com/owner/repo)가 전달되면
 *    raw.githubusercontent.com의 fonts/font.json 경로로 자동 변환합니다.
 * 2. .json 확장자로 끝나지 않고 디렉터리 경로만 지정된 경우 기본 파일명인 font.json을 자동으로 추가합니다.
 */
export function normalizeCuratedFontUrl(urlStr?: string | null): string {
  const DEFAULT_URL =
    "https://cdn.jsdelivr.net/gh/monodle/fontfinder-fonts@main/font.json";

  if (!urlStr || typeof urlStr !== "string") {
    return DEFAULT_URL;
  }

  const trimmed = urlStr.trim();
  if (!trimmed) {
    return DEFAULT_URL;
  }

  // 이미 .json 파일 직접 지정인 경우 그대로 반환 (쿼리/해시 분리 검사)
  const queryIndex = trimmed.search(/[?#]/);
  const baseWithoutQuery = queryIndex !== -1 ? trimmed.slice(0, queryIndex) : trimmed;
  if (baseWithoutQuery.endsWith(".json")) {
    return trimmed;
  }

  // GitHub 브랜치 URL 매칭: https://github.com/{owner}/{repo}/tree/{branch}
  const ghBranchRegex =
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)\/tree\/([^/]+)(?:\/)?$/i;
  const branchMatch = baseWithoutQuery.match(ghBranchRegex);
  if (branchMatch) {
    const [, owner, repo, branch] = branchMatch;
    const rest = queryIndex !== -1 ? trimmed.slice(queryIndex) : "";
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/fonts/font.json${rest}`;
  }

  // GitHub 저장소 URL 매칭: https://github.com/{owner}/{repo}
  const ghRepoRegex =
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/i;
  const match = baseWithoutQuery.match(ghRepoRegex);
  if (match) {
    const [, owner, repo] = match;
    const rest = queryIndex !== -1 ? trimmed.slice(queryIndex) : "";
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/fonts/font.json${rest}`;
  }

  // 경로만 전달된 경우(확장자가 .json이 아님) 자동으로 /font.json 추가
  const sanitizedBase = baseWithoutQuery.replace(/\/+$/, "");
  const rest = queryIndex !== -1 ? trimmed.slice(queryIndex) : "";
  return `${sanitizedBase}/font.json${rest}`;
}


/**
 * Vite 환경 변수(import.meta.env) 엄격 검증 및 기본값 정규화 스키마
 */
const appEnvSchema = z
  .object({
    VITE_CURATED_FONTS_URL: z
      .unknown()
      .optional()
      .transform((val) =>
        normalizeCuratedFontUrl(typeof val === "string" ? val : undefined)
      ),
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
