import { FontMetadata } from "../types/font";

/**
 * 카테고리별 폰트 필터링 판별 술어 함수 (Single Source of Truth)
 * categoryCounts 및 filteredFonts 계산 시 동일한 기준을 보장합니다.
 */

/**
 * 전체 라이브러리(All) 대상 폰트 판별:
 * 시스템 폰트를 제외하고, 삭제 또는 연결 해제(unplugged)되지 않은 폰트
 */
export function isAllCategoryFont(font: FontMetadata): boolean {
  return (
    font.install_status !== "deleted" &&
    font.install_status !== "unplugged" &&
    font.source !== "system"
  );
}

/**
 * 시스템 폰트 판별
 */
export function isSystemCategoryFont(font: FontMetadata): boolean {
  return font.source === "system";
}

/**
 * 사용자 설치(User) 폰트 판별
 */
export function isUserCategoryFont(font: FontMetadata): boolean {
  return font.source === "user";
}

/**
 * 활성화(Activated) 폰트 판별:
 * 활성화 ID 목록에 포함되어 있으며, 시스템 및 사용자 직접 설치 폰트가 아닌 폰트
 */
export function isActivatedCategoryFont(font: FontMetadata, activatedFontIds: Set<number>): boolean {
  return (
    activatedFontIds.has(font.id) &&
    font.source !== "system" &&
    font.source !== "user"
  );
}

/**
 * 즐겨찾기(Favorites) 폰트 판별
 */
export function isFavoriteCategoryFont(font: FontMetadata, favoriteIds: Set<number>): boolean {
  return favoriteIds.has(font.id);
}

/**
 * 중복(Duplicates) 카테고리 대상 폰트 판별:
 * 중복 ID 목록에 포함되어 있으며 시스템 폰트가 아닌 폰트
 */
export function isDuplicateCategoryFont(font: FontMetadata, duplicateFontIds: Set<number>): boolean {
  return duplicateFontIds.has(font.id) && font.source !== "system";
}
