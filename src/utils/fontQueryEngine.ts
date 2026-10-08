import { FontMetadata, FontSet } from "../types/font";
import { isPathInFolder } from "./pathUtils";
import { deduplicateFonts, getFontUniqueKey } from "./fontDeduplication";
import {
  isAllCategoryFont,
  isSystemCategoryFont,
  isUserCategoryFont,
  isActivatedCategoryFont,
  isFavoriteCategoryFont,
  isDuplicateCategoryFont,
} from "./fontFilterUtils";

export interface FontQueryContext {
  processedFonts: FontMetadata[];
  unpluggedFonts?: FontMetadata[];
  setMap?: Map<number, Set<number>>;
  sets?: FontSet[];
  duplicateFontIds?: Set<number>;
  duplicateGroupCount?: number;
  nonSystemDupCounts?: Map<string, number>;
  activatedFontIds?: Set<number>;
  favoriteIds?: Set<number>;
}

/**
 * 특정 폴더에 속한 폰트 목록을 반환하는 SSOT 함수
 * (중복 파일 포함 실제 해당 폴더 경로에 존재하는 모든 폰트)
 */
function getFolderFonts(fonts: FontMetadata[], folderPath: string): FontMetadata[] {
  if (!folderPath || !fonts || fonts.length === 0) return [];
  return fonts.filter((f) => isPathInFolder(f.file_path, folderPath));
}
/**
 * 특정 폴더의 폰트 개수를 반환하는 SSOT 함수
 */
export function getFolderFontCount(fonts: FontMetadata[], folderPath: string): number {
  return getFolderFonts(fonts, folderPath).length;
}

/**
 * 특정 서재(Set)에 속한 폰트 목록을 반환하는 SSOT 함수
 */
export function getSetFonts(
  setId: number,
  context: Pick<FontQueryContext, "processedFonts" | "unpluggedFonts" | "setMap">
): FontMetadata[] {
  const { processedFonts, unpluggedFonts = [], setMap } = context;
  if (!setMap) return [];

  const fontIds = setMap.get(setId);
  if (!fontIds || fontIds.size === 0) return [];

  const matchesSet = (font: FontMetadata) => fontIds.has(font.id);
  const activeInSet = processedFonts.filter(matchesSet);
  const unpluggedInSet = unpluggedFonts.filter(matchesSet);

  return [...activeInSet, ...unpluggedInSet];
}

/**
 * 카테고리/폴더/서재에 표시될 폰트 목록을 도출하는 SSOT 엔진 함수
 * 본문 리스트(VirtualFontList)와 상단 바, 좌측 메뉴가 동일한 기준을 공유합니다.
 */
export function queryCategoryFonts(
  category: string,
  context: FontQueryContext
): FontMetadata[] {
  const {
    processedFonts,
    unpluggedFonts = [],
    duplicateFontIds = new Set<number>(),
    nonSystemDupCounts = new Map<string, number>(),
    activatedFontIds = new Set<number>(),
    favoriteIds = new Set<number>(),
  } = context;

  // 1. 폴더 카테고리 (folder:/path/to/folder)
  if (category.startsWith("folder:")) {
    const folderPath = category.replace("folder:", "");
    return getFolderFonts(processedFonts, folderPath);
  }

  // 2. 단일 서재 카테고리 (set:123)
  if (category.startsWith("set:")) {
    const setId = Number(category.replace("set:", ""));
    return getSetFonts(setId, context);
  }

  // 3. 중복 폰트 카테고리 (duplicates)
  if (category === "duplicates") {
    const nonSystemDuplicates = processedFonts.filter((f) =>
      isDuplicateCategoryFont(f, duplicateFontIds)
    );
    return deduplicateFonts(nonSystemDuplicates, activatedFontIds).map((font) => ({
      ...font,
      duplicate_count: nonSystemDupCounts.get(getFontUniqueKey(font)) || 1,
    }));
  }

  // 4. 즐겨찾기 카테고리 (favorites)
  if (category === "favorites") {
    const activeFavs = processedFonts.filter((f) => isFavoriteCategoryFont(f, favoriteIds));
    const unpluggedFavs = unpluggedFonts.filter((f) => isFavoriteCategoryFont(f, favoriteIds));
    return [...activeFavs, ...unpluggedFavs];
  }

  // 5. 활성화 폰트 (activated)
  if (category === "activated") {
    return processedFonts.filter((f) => isActivatedCategoryFont(f, activatedFontIds));
  }

  // 6. 사용자 설치 폰트 (user)
  if (category === "user") {
    return processedFonts.filter(isUserCategoryFont);
  }

  // 7. 시스템 폰트 (system)
  if (category === "system") {
    return processedFonts.filter(isSystemCategoryFont);
  }

  // 8. 전체 폰트 (all)
  if (category === "all") {
    return processedFonts.filter(isAllCategoryFont);
  }

  return [];
}

