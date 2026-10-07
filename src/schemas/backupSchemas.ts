import { z } from "zod";
import { DEFAULT_FOLDER_COLOR, DEFAULT_SET_COLOR } from "../config/colorPresets";
import {
  createHexColorSchema,
  createSafeStringSchema,
  sanitizeRawString,
} from "./commonSchemas";
import type { BackupFolder, BackupFontHashRef } from "../types/backup";

/**
 * 단일 백업 폴더 메타데이터 검증 스키마
 */
export const backupFolderItemSchema = z
  .object({
    path: createSafeStringSchema(1024),
    name: createSafeStringSchema(100),
    color: createHexColorSchema(DEFAULT_FOLDER_COLOR),
    sortOrder: z
      .unknown()
      .optional()
      .transform((v) => (typeof v === "string" ? sanitizeRawString(v, 64) || undefined : undefined)),
  })
  .transform((data): BackupFolder | null => {
    if (!data.path) return null;
    const name = data.name || data.path.split(/[/\\]/).pop() || "Folder";
    return {
      path: data.path,
      name,
      color: data.color,
      sortOrder: data.sortOrder,
    };
  });

/**
 * 단일 서재 세트 메타데이터 검증 스키마
 */
export const backupSetMetaSchema = z.object({
  id: z.number().int().positive().optional().catch(undefined),
  name: createSafeStringSchema(100),
  color: createHexColorSchema(DEFAULT_SET_COLOR),
  parentId: z.number().int().positive().nullable().optional().catch(null),
  parentName: createSafeStringSchema(100).transform((v) => v || null),
  sortOrder: z
    .unknown()
    .optional()
    .transform((v) => (typeof v === "string" ? sanitizeRawString(v, 64) || undefined : undefined)),
});

/**
 * 백업 폰트 해시 레퍼런스 검증 스키마
 */
export const backupFontHashRefSchema = z
  .object({
    fastHash: createSafeStringSchema(64),
    deepHash: createSafeStringSchema(128).transform((v) => v || null),
  })
  .transform((data): BackupFontHashRef | null => {
    if (!data.fastHash) return null;
    return {
      fastHash: data.fastHash,
      deepHash: data.deepHash,
    };
  });

export type BackupFolderItem = z.infer<typeof backupFolderItemSchema>;
export type BackupSetMeta = z.infer<typeof backupSetMetaSchema>;
export type BackupFontHashRefItem = z.infer<typeof backupFontHashRefSchema>;

/**
 * 백업 카테고리 선택(설정, 폴더, 서재 세트) 검증 스키마
 */
export const backupCategorySelectionSchema = z.object({
  settings: z.boolean(),
  folders: z.boolean(),
  sets: z.boolean(),
});

export type BackupCategorySelectionInput = z.infer<typeof backupCategorySelectionSchema>;

/**
 * 단일 서재 세트 전체(메타데이터 + fontHashes/fontIds 원시 필드 포함) 검증 스키마
 */
export const backupSetItemSchema = backupSetMetaSchema.extend({
  fontHashes: z.unknown().optional(),
  fontIds: z.unknown().optional(),
});

export type BackupSetItem = z.infer<typeof backupSetItemSchema>;

/**
 * 백업 JSON 최상위 루트 객체(레거시 data 래핑 투명 언래핑 포함) 검증 스키마
 */
export const rawBackupRootSchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
        return obj.data;
      }
    }
    return val;
  },
  z.object({
    settings: z.unknown().optional(),
    folders: z.unknown().optional(),
    sets: z.unknown().optional(),
  })
);

export type RawBackupRoot = z.infer<typeof rawBackupRootSchema>;

