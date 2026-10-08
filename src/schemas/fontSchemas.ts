import { z } from "zod";
import type { FontMetadata } from "../types/font";

const fontFormatSchema = z.enum([
  "TrueType",
  "OpenType",
  "TrueTypeCollection",
  "Unknown",
] as const).catch("Unknown");

const fontSourceSchema = z.enum(["system", "user", "external"] as const).catch("external");

const fontInstallStatusSchema = z.enum([
  "installed_system",
  "installed_user",
  "activated",
  "uninstalled",
  "unplugged",
  "deleted",
] as const);

const fontVersionStatusSchema = z.enum([
  "up_to_date",
  "update_available",
  "outdated",
  "none",
] as const);

const fontLibraryTagSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  type: z.enum(["set", "folder"]),
  color: z.string(),
});

/**
 * 단일 폰트 메타데이터 검증 스키마
 */
const fontMetadataSchema: z.ZodType<FontMetadata> = z.object({
  id: z.number().int(),
  file_path: z.string().min(1),
  file_name: z.string().min(1),
  file_size: z.number().nonnegative().catch(0),
  file_hash: z.string().nullish().transform((v) => v ?? undefined),
  fast_hash: z.string().nullish().transform((v) => v ?? undefined),
  deep_hash: z.string().nullish().transform((v) => v ?? undefined),
  duplicate_count: z.number().int().nullish().transform((v) => v ?? undefined),
  is_duplicate: z.boolean().nullish().transform((v) => v ?? undefined),
  font_index: z.number().int().nonnegative().catch(0),
  family_name: z.string().nullish().transform((v) => v ?? "").catch(""),
  subfamily_name: z.string().nullish().transform((v) => v ?? "").catch(""),
  full_name: z.string().nullish().transform((v) => v ?? "").catch(""),
  postscript_name: z.string().nullish().transform((v) => v ?? "").catch(""),
  localized_names: z.record(z.string(), z.string()).nullish().transform((v) => v ?? undefined),
  format: fontFormatSchema,
  source: fontSourceSchema,
  glyph_count: z.number().int().nonnegative().catch(0),
  weight: z.number().int().nonnegative().catch(400),
  is_italic: z.boolean().catch(false),
  is_monospace: z.boolean().catch(false),
  is_variable: z.boolean().catch(false),
  version: z.string().nullish().transform((v) => v ?? undefined),
  version_num: z.number().nullish().transform((v) => v ?? undefined),
  designer: z.string().nullish().transform((v) => v ?? undefined),
  copyright: z.string().nullish().transform((v) => v ?? undefined),
  license: z.string().nullish().transform((v) => v ?? undefined),
  // 동적 상태 속성
  install_status: fontInstallStatusSchema.nullish().transform((v) => v ?? undefined),
  version_status: fontVersionStatusSchema.nullish().transform((v) => v ?? undefined),
  installed_path: z.string().nullish().transform((v) => v ?? undefined),
  installed_version: z.string().nullish().transform((v) => v ?? undefined),
  libraries: z.array(fontLibraryTagSchema).nullish().transform((v) => v ?? undefined),
  isMissing: z.boolean().nullish().transform((v) => v ?? undefined),
  alt_paths: z.array(z.string()).nullish().transform((v) => v ?? undefined),
});

/**
 * 폰트 메타데이터 목록 IPC 응답 검증 스키마
 * 개별 폰트 검증 실패 시 전체 목록이 빈 배열이 되지 않고 정상 폰트들만 보존하도록 전처리
 */
export const fontMetadataListSchema: z.ZodType<FontMetadata[]> = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.flatMap((item) => {
      const parsed = fontMetadataSchema.safeParse(item);
      if (parsed.success) {
        return [parsed.data];
      }
      return [];
    });
  },
  z.array(fontMetadataSchema)
).catch([]);

