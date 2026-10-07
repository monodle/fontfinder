import i18n from "../../i18n";
import { sanitizeSettings as sanitizeAppSettings } from "../../utils/settingsSanitizer";
import {
  HEX_COLOR_REGEX,
  createHexColorSchema,
  createSafeStringSchema,
  backupFolderItemSchema,
  backupSetItemSchema,
  backupFontHashRefSchema,
  rawBackupRootSchema,
} from "../../schemas";
import type { CustomAppSettings } from "../../types/settings";
import type {
  AppBackupData,
  BackupFolder,
  BackupFontHashRef,
  BackupSet,
  BackupSummary,
} from "../../types/backup";

export const MAX_JSON_STRING_LENGTH = 10 * 1024 * 1024; // 10MB 최대 크기 제한
export const MAX_COLLECTION_ITEMS = 99999; // 폴더 및 서재 세트 최대 개수 제한
export const MAX_FONTS_PER_SET = 99999; // 세트당 최대 폰트 ID 개수 제한

export { HEX_COLOR_REGEX };

/**
 * 16진수 색상 코드 검증 및 정제 (CSS/HTML 주입 방어)
 */
export function sanitizeColor(val: unknown, fallback: string): string {
  return createHexColorSchema(fallback).parse(typeof val === "string" ? val : "");
}

/**
 * 안전한 텍스트 정제 (길이 제한 및 제어 문자 차단)
 */
export function sanitizeString(val: unknown, maxLen = 255): string {
  return createSafeStringSchema(maxLen).parse(val);
}

/**
 * Prototype Pollution 방어 기능을 포함한 안전한 JSON 파서
 */
export function safeJsonParse(content: string): unknown {
  if (content.length > MAX_JSON_STRING_LENGTH) {
    throw new Error(i18n.t("backup.size_limit"));
  }

  return JSON.parse(content, (key, value) => {
    // __proto__, constructor, prototype 키를 차단하여 Object 오염 방지
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return undefined;
    }
    return value;
  });
}

/**
 * 외부 입력 설정값(settings) 엄격 검증 및 화이트리스트 정제 (SSOT: settingsService.sanitizeSettings)
 */
export function sanitizeSettings(raw: unknown): CustomAppSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return sanitizeAppSettings(raw);
}

/**
 * 외부 입력 폴더(folders) 엄격 검증 및 정제 (하이브리드: 아이템별 Zod safeParse)
 */
export function sanitizeFolders(raw: unknown): BackupFolder[] {
  if (!Array.isArray(raw)) return [];
  const validFolders: BackupFolder[] = [];

  for (const item of raw.slice(0, MAX_COLLECTION_ITEMS)) {
    if (!item || typeof item !== "object") continue;
    const parsed = backupFolderItemSchema.safeParse(item);
    if (parsed.success && parsed.data) {
      validFolders.push(parsed.data);
    }
  }

  return validFolders;
}

/**
 * 외부 입력 서재 세트(sets) 엄격 검증 및 정제 (하이브리드: 메타데이터 Zod + 대용량 폰트 배열 고속 수동 루프)
 */
export function sanitizeSets(raw: unknown): BackupSet[] {
  if (!Array.isArray(raw)) return [];
  const validSets: BackupSet[] = [];

  for (const item of raw.slice(0, MAX_COLLECTION_ITEMS)) {
    if (!item || typeof item !== "object") continue;

    const parsed = backupSetItemSchema.safeParse(item);
    if (!parsed.success || !parsed.data.name) continue;

    const { id, name, color, parentId, parentName, sortOrder, fontHashes: rawHashes, fontIds: rawIds } = parsed.data;

    // 대용량 fontHashes (최대 99,999건) 초고속 루프
    const fontHashes: BackupFontHashRef[] = [];
    if (Array.isArray(rawHashes)) {
      for (const fref of rawHashes.slice(0, MAX_FONTS_PER_SET)) {
        if (!fref || typeof fref !== "object") continue;
        const hashParsed = backupFontHashRefSchema.safeParse(fref);
        if (hashParsed.success && hashParsed.data) {
          fontHashes.push(hashParsed.data);
        }
      }
    }

    // 대용량 fontIds (최대 99,999건) 초고속 수동 루프 유지
    const fontIds: number[] = [];
    if (Array.isArray(rawIds)) {
      for (const fid of rawIds.slice(0, MAX_FONTS_PER_SET)) {
        const num = Number(fid);
        if (Number.isInteger(num) && num > 0) fontIds.push(num);
      }
    }

    validSets.push({
      id,
      name,
      color,
      parentId,
      parentName,
      sortOrder,
      fontHashes,
      fontIds,
    });
  }

  return validSets;
}

/**
 * 파싱된 JSON을 안전하고 검증된 AppBackupData 객체로 정제 (Defensive Normalization)
 */
export function validateAndNormalizeBackupData(raw: unknown): AppBackupData {
  const rootParsed = rawBackupRootSchema.safeParse(raw);
  if (!rootParsed.success) {
    throw new Error(i18n.t("backup.invalid_data"));
  }

  const source = rootParsed.data;
  const settings = sanitizeSettings(source.settings);
  const folders = sanitizeFolders(source.folders);
  const sets = sanitizeSets(source.sets);

  const hasAnyData = Boolean(settings || folders.length > 0 || sets.length > 0);
  if (!hasAnyData) {
    throw new Error(i18n.t("backup.empty_data"));
  }

  return {
    settings,
    folders: folders.length > 0 ? folders : undefined,
    sets: sets.length > 0 ? sets : undefined,
  };
}

/**
 * 백업 데이터 요약 정보 추출
 */
export function summarizeBackupData(data: AppBackupData): BackupSummary {
  return {
    hasSettings: Boolean(data.settings && Object.keys(data.settings).length > 0),
    foldersCount: Array.isArray(data.folders) ? data.folders.length : 0,
    setsCount: Array.isArray(data.sets) ? data.sets.length : 0,
  };
}
