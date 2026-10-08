import { z } from "zod";
import i18n from "i18next";
import { HEX_COLOR_REGEX, sanitizeRawString } from "./commonSchemas";

export type FormTranslateFn = (key: string, options?: any) => string;

/**
 * 서재 세트 생성 및 수정 모달 폼 검증 스키마 생성기 (i18n 지원)
 */
export const createLibrarySetFormSchema = (t?: FormTranslateFn) => {
  const translate: FormTranslateFn = t ?? ((key, options) => String(i18n.t(key, options)));
  const nameRequired = translate("library_modal.name_required");
  const nameMaxLength = translate("library_modal.name_max_length");
  const invalidColor = translate("library_modal.invalid_color");

  return z.object({
    name: z
      .string()
      .trim()
      .min(1, nameRequired)
      .max(100, nameMaxLength)
      .transform((val) => sanitizeRawString(val, 100)),
    color: z
      .string()
      .trim()
      .regex(HEX_COLOR_REGEX, invalidColor),
    parentId: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .catch(null),
  });
};

/**
 * 폴더 색상 수정 폼 검증 스키마 생성기 (i18n 지원)
 */
export const createLibraryFolderColorFormSchema = (t?: FormTranslateFn) => {
  const translate: FormTranslateFn = t ?? ((key, options) => String(i18n.t(key, options)));
  const invalidColor = translate("library_modal.invalid_color");

  return z.object({
    color: z
      .string()
      .trim()
      .regex(HEX_COLOR_REGEX, invalidColor),
  });
};

/**
 * About 모달 오픈소스 라이선스 카테고리 필터 스키마
 */
const LICENSE_CATEGORIES = ["all", "frontend", "backend"] as const;
export type LicenseCategory = typeof LICENSE_CATEGORIES[number];
export const licenseCategoryFilterSchema = z.enum(LICENSE_CATEGORIES).catch("all");

/**
 * 트리 뷰 드롭 인디케이터 포지션 스키마
 */
const TREE_DROP_POSITIONS = ["before", "after"] as const;
export type TreeDropPosition = typeof TREE_DROP_POSITIONS[number];
export const treeDropPositionSchema = z.enum(TREE_DROP_POSITIONS);

/**
 * 환경 설정 모달 탭 스키마
 */
const SETTINGS_TABS = [
  "all",
  "appearance",
  "library",
  "layout",
  "advanced",
  "sponsor",
  "about",
] as const;
export type SettingsTab = typeof SETTINGS_TABS[number];
export const settingsTabSchema = z.enum(SETTINGS_TABS).catch("all");
