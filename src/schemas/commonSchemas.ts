import { z } from "zod";

export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g;

/**
 * 문자열에서 유효하지 않은 제어 문자를 제거하고 길이를 제한하는 고속 순수 헬퍼
 */
export const sanitizeRawString = (val: unknown, maxLen = 255, fallback = ""): string => {
  if (typeof val !== "string") return fallback;
  return val.replace(CONTROL_CHARS_REGEX, "").trim().slice(0, maxLen);
};

/**
 * 16진수 색상 코드 검증 및 정제 스키마 (CSS/HTML 주입 방어)
 * 유효하지 않거나 비어있는 경우 fallback 값 반환
 */
export const createHexColorSchema = (fallback: string) =>
  z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX)
    .catch(fallback);

/**
 * 안전한 텍스트 정제 스키마 (제어 문자 차단, trim, 최대 길이 제한)
 */
export const createSafeStringSchema = (maxLen = 255, fallback = "") =>
  z.unknown().optional().transform((val) => sanitizeRawString(val, maxLen, fallback));

/**
 * 양의 정수 검증 스키마 생성 헬퍼
 */
export const createPositiveIntegerSchema = (fallback?: number) =>
  z
    .number()
    .int()
    .positive()
    .catch(fallback as number);

/**
 * 양의 정수 검증 스키마 (기본)
 */
export const positiveIntegerSchema = createPositiveIntegerSchema(NaN);

/**
 * 안전한 웹 URL(http, https) 검증 및 정규화 스키마
 */
export const webUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (val) => {
      try {
        const parsed = new URL(val);
        return (
          (parsed.protocol === "http:" || parsed.protocol === "https:") &&
          parsed.hostname.trim().length > 0
        );
      } catch {
        return false;
      }
    },
    { message: "Only HTTP and HTTPS protocols with valid hostname are allowed" }
  )
  .transform((val) => new URL(val).href);

/**
 * 단일 파일/폴더 경로 검증 스키마
 */
export const singlePathSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .catch(null);

/**
 * 다중 파일/폴더 경로 목록 검증 스키마 (유효하지 않은 항목만 제외하고 유효한 경로 보존)
 */
export const pathListSchema = z
  .unknown()
  .transform((val): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((p) => p.length > 0);
  });

/**
 * LocalStorage 불리언 문자열 플래그 안전 파싱 스키마 ('true' -> true, 그 외 -> false)
 */
export const storageBooleanSchema = z
  .unknown()
  .transform((val) => val === "true" || val === true);

/**
 * Fractional indexing 키 안전 정제 스키마 (ASCII 가용 범위 외 차단 및 null 반환)
 */
export const fractionalIndexKeySchema = z
  .unknown()
  .transform((val) => {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    if (!trimmed || trimmed.length > 128) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
    return trimmed;
  });

/**
 * 폰트 메타데이터 비트마스크/정수 코드 안전 정제 스키마 (number | null 보장)
 */
export const fontBitmaskCodeSchema = z
  .number()
  .int()
  .nonnegative()
  .nullable()
  .optional()
  .catch(null)
  .transform((val) => (typeof val === "number" ? val : null));


