import { z } from "zod";

/**
 * 폰트 일괄 설치 IPC 응답 검증 스키마
 */
export const batchInstallResultSchema = z.object({
  installed: z.array(z.string()).catch([]),
  failed_count: z.number().int().nonnegative().catch(0),
  errors: z.array(z.string()).catch([]),
});

export type BatchInstallResult = z.infer<typeof batchInstallResultSchema>;

/**
 * 폰트 일괄 제거 IPC 응답 검증 스키마
 */
export const batchUninstallResultSchema = z.object({
  deleted_count: z.number().int().nonnegative().catch(0),
  failed_count: z.number().int().nonnegative().catch(0),
  errors: z.array(z.string()).catch([]),
});

export type BatchUninstallResult = z.infer<typeof batchUninstallResultSchema>;

/**
 * 폴더 존재 상태 확인 IPC 응답 스키마
 */
export const folderStatusSchema = z.object({
  id: z.number().int(),
  path: z.string(),
  name: z.string(),
  color: z.string(),
  exists: z.boolean(),
  sort_order: z.string().nullish().transform((v) => v ?? undefined),
});

export type FolderStatus = z.infer<typeof folderStatusSchema>;

export const folderStatusListSchema: z.ZodType<FolderStatus[]> = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.flatMap((item) => {
      const parsed = folderStatusSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  },
  z.array(folderStatusSchema)
).catch([]);

/**
 * 경로 타입(디렉터리/파일) 확인 IPC 응답 스키마
 */
export const pathTypeInfoSchema = z.object({
  path: z.string(),
  name: z.string(),
  is_dir: z.boolean(),
  exists: z.boolean(),
});

export type PathTypeInfo = z.infer<typeof pathTypeInfoSchema>;

export const pathTypeInfoListSchema: z.ZodType<PathTypeInfo[]> = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.flatMap((item) => {
      const parsed = pathTypeInfoSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  },
  z.array(pathTypeInfoSchema)
).catch([]);

/**
 * 서재 세트(FontSet) IPC 응답 스키마
 */
export const fontSetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string().catch("#d97706"),
  count: z.number().int().catch(0),
  parent_id: z.number().int().nullable().optional(),
  sort_order: z.string().nullish().transform((v) => v ?? undefined),
});

export type FontSet = z.infer<typeof fontSetSchema>;

export const fontSetListSchema: z.ZodType<FontSet[]> = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.flatMap((item) => {
      const parsed = fontSetSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  },
  z.array(fontSetSchema)
).catch([]);

/**
 * 감시 폴더(DbFolder) IPC 응답 스키마
 */
export const dbFolderSchema = z.object({
  id: z.number().int(),
  path: z.string(),
  name: z.string(),
  color: z.string().catch("#d97706"),
  sort_order: z.string().nullish().transform((v) => v ?? undefined),
});

export type DbFolder = z.infer<typeof dbFolderSchema>;

export const dbFolderListSchema: z.ZodType<DbFolder[]> = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.flatMap((item) => {
      const parsed = dbFolderSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  },
  z.array(dbFolderSchema)
).catch([]);

/**
 * 활성화 폰트 레코드 IPC 응답 스키마
 */
export const activatedFontRecordSchema = z.object({
  font_id: z.number().int(),
  file_path: z.string(),
});

export type ActivatedFontRecord = z.infer<typeof activatedFontRecordSchema>;

export const activatedFontRecordListSchema: z.ZodType<ActivatedFontRecord[]> = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.flatMap((item) => {
      const parsed = activatedFontRecordSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  },
  z.array(activatedFontRecordSchema)
).catch([]);

/**
 * 폰트 상세 정보 서브 레코드 스키마
 */
export const fontNameRecordSchema = z.object({
  name_id: z.number().int().catch(0),
  name_key: z.string().catch(""),
  value: z.string().catch(""),
  language_id: z.number().int().nullish().transform((v) => v ?? undefined),
  language_tag: z.string().nullish().transform((v) => v ?? undefined),
});

export const fontMetricsRecordSchema = z.object({
  units_per_em: z.number().catch(1000),
  ascender: z.number().catch(800),
  descender: z.number().catch(-200),
  line_gap: z.number().catch(0),
  win_ascent: z.number().nullable().optional(),
  win_descent: z.number().nullable().optional(),
  cap_height: z.number().nullable().optional(),
  x_height: z.number().nullable().optional(),
  italic_angle: z.number().catch(0),
  underline_position: z.number().catch(0),
  underline_thickness: z.number().catch(0),
  is_monospaced: z.boolean().catch(false),
  bbox_xmin: z.number().catch(0),
  bbox_ymin: z.number().catch(0),
  bbox_xmax: z.number().catch(0),
  bbox_ymax: z.number().catch(0),
});

export const fontOs2RecordSchema = z.object({
  version: z.number().catch(0),
  weight_class: z.number().catch(400),
  width_class: z.number().catch(5),
  fs_type: z.number().catch(0),
  fs_type_label: z.string().catch(""),
  fs_selection: z.number().catch(0),
  s_family_class: z.number().catch(0),
  family_class_name: z.string().catch(""),
  panose: z.array(z.number()).catch([]),
  vendor_id: z.string().catch(""),
});

export const fontLanguageCoverageSchema = z.object({
  total_glyph_count: z.number().catch(0),
  encoded_char_count: z.number().catch(0),
  has_latin_basic: z.boolean().catch(false),
  latin_basic_count: z.number().nullish().transform((v) => v ?? undefined),
  has_latin_extended: z.boolean().catch(false),
  latin_extended_count: z.number().nullish().transform((v) => v ?? undefined),
  hangul_syllable_count: z.number().catch(0),
  hangul_type: z.enum(["none", "basic_ks_2350", "full_11172", "partial"]).catch("none"),
  has_hangul_jamo: z.boolean().catch(false),
  cjk_ideograph_count: z.number().catch(0),
  has_japanese_kana: z.boolean().catch(false),
  japanese_kana_count: z.number().nullish().transform((v) => v ?? undefined),
  has_cyrillic: z.boolean().catch(false),
  has_greek: z.boolean().catch(false),
  has_arabic: z.boolean().catch(false),
  supported_scripts: z.array(z.string()).catch([]),
});

export const fontVariableAxisSchema = z.object({
  tag: z.string().catch(""),
  name: z.string().catch(""),
  min_value: z.number().catch(0),
  default_value: z.number().catch(0),
  max_value: z.number().catch(0),
});

export const fontVariableInfoSchema = z.object({
  is_variable: z.boolean().catch(false),
  axes: z.array(fontVariableAxisSchema).catch([]),
});

/**
 * 폰트 상세 정보(FontDetailedInfo) IPC 응답 방어 스키마
 */
export const fontDetailedInfoSchema = z.object({
  id: z.number().int(),
  file_path: z.string(),
  file_name: z.string(),
  file_size: z.number().catch(0),
  font_index: z.number().catch(0),
  format: z.enum(["TrueType", "OpenType", "TrueTypeCollection", "Woff", "Woff2", "Unknown"]).catch("Unknown"),
  style_classification: z.string().catch(""),
  created_timestamp: z.number().nullable().optional(),
  modified_timestamp: z.number().nullable().optional(),
  names: z.array(fontNameRecordSchema).catch([]),
  metrics: fontMetricsRecordSchema,
  os2: fontOs2RecordSchema.nullable().optional(),
  coverage: fontLanguageCoverageSchema,
  opentype_features: z.array(z.string()).catch([]),
  variable: fontVariableInfoSchema.nullable().optional(),
});

export type FontDetailedInfo = z.infer<typeof fontDetailedInfoSchema>;

/**
 * 폰트 스캔 진행률 비동기 이벤트 페이로드 스키마
 */
export const fontScanProgressPayloadSchema = z.object({
  current: z.number().int().nonnegative().catch(0),
  total: z.number().int().nonnegative().catch(0),
});

export type FontScanProgressPayload = z.infer<typeof fontScanProgressPayloadSchema>;

/**
 * 개별 폴더 스캔 진행률 비동기 이벤트 페이로드 스키마
 */
export const folderScanProgressPayloadSchema = z.object({
  path: z.string().min(1),
  current: z.number().int().nonnegative().catch(0),
  total: z.number().int().nonnegative().catch(0),
});

export type FolderScanProgressPayload = z.infer<typeof folderScanProgressPayloadSchema>;

/**
 * 폴더 변경/누락 비동기 이벤트 페이로드 스키마 (folder-font-changed, folder-missing)
 */
export const folderPathEventPayloadSchema = z.string().trim().min(1);

/**
 * 레거시 로컬스토리지 커스텀 폴더 마이그레이션 스키마
 */
export const legacyCustomFolderSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  color: z.string().optional(),
});

export const legacyCustomFolderListSchema: z.ZodType<LegacyCustomFolder[]> = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.flatMap((item) => {
      const parsed = legacyCustomFolderSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  },
  z.array(legacyCustomFolderSchema)
).catch([]);

export type LegacyCustomFolder = z.infer<typeof legacyCustomFolderSchema>;

/**
 * 폰트 ID 목록 IPC 응답 스키마 (즐겨찾기, 세트 소속 폰트 등)
 */
export const fontIdListSchema = z.array(z.number().int()).catch([]);

/**
 * 전체 세트별 폰트 ID 매핑 테이블 IPC 응답 스키마
 */
export const allSetFontIdsSchema = z
  .record(z.coerce.number(), z.array(z.number().int()))
  .catch({});

/**
 * 전체 세트별 폰트 ID Map IPC 응답 스키마 (O(1) 타입 세이프 룩업을 위한 Map 정규화)
 */
export const allSetFontsMapSchema = z
  .record(z.string(), z.array(z.number().int()))
  .catch({})
  .transform((data): Map<number, number[]> => {
    const map = new Map<number, number[]>();
    for (const [key, ids] of Object.entries(data)) {
      const numKey = Number(key);
      if (Number.isInteger(numKey)) {
        map.set(numKey, ids);
      }
    }
    return map;
  });

export type AllSetFontsMap = z.infer<typeof allSetFontsMapSchema>;

/**
 * OS 시스템 테마 IPC 응답 스키마
 */
export const systemThemeSchema = z.enum(["dark", "light"]).catch("light");

export type SystemTheme = z.infer<typeof systemThemeSchema>;

/**
 * Tauri WebView 드래그 앤 드롭 이벤트 페이로드 스키마
 */
export const tauriDragDropEventPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("enter"),
    paths: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("over"),
  }),
  z.object({
    type: z.literal("drop"),
    paths: z
      .unknown()
      .transform((val): string[] => {
        if (!Array.isArray(val)) return [];
        return val
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter((s) => s.length > 0);
      }),
  }),
  z.object({
    type: z.literal("leave"),
  }),
]);

export type TauriDragDropEventPayload = z.infer<typeof tauriDragDropEventPayloadSchema>;

/**
 * 네이티브 파일/폴더 선택 다이얼로그(open) 반환값 검증 스키마
 */
export const nativeDialogSinglePathSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .catch(null);

export const nativeDialogMultiplePathsSchema = z
  .unknown()
  .transform((val): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((p) => p.length > 0);
  });

