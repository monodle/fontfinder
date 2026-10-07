import { FontMetadata } from "../types/font";
import { getFontFamilyName } from "./fontLocalization";
import { isFavoriteCategoryFont } from "./fontFilterUtils";
import {
  FontSortBlock,
  FontSortField,
  FontSortOrder,
  FontSortSettings,
  DEFAULT_SORT_SETTINGS,
  DEFAULT_SORT_BLOCK_ORDER,
} from "../types/sort";

export interface FontSortContext {
  favoriteIds: Set<number>;
  activatedFontIds: Set<number>;
}

export { isFavoriteCategoryFont as isFontFavorite };

/**
 * 폰트의 상태 그룹(블록) 판별
 * - unplugged: 접근 불가 (언플러그드 / 바로가기 유실 / 삭제 보존)
 * - favorites: 즐겨찾기 보관 폰트 (정상 접근 가능한 경우)
 * - activated: 시스템 등록 또는 임시 활성화 폰트
 * - deactivated: 비활성화 (대기 상태의 외부 폰트 등)
 */
function getFontSortBlock(font: FontMetadata, ctx: FontSortContext): FontSortBlock {
  // 1. 접근 불가 (언플러그드, 파일 유실, 삭제 상태)
  if (
    font.install_status === "unplugged" ||
    font.install_status === "deleted" ||
    font.isMissing
  ) {
    return "unplugged";
  }

  // 2. 즐겨찾기 폰트
  if (isFavoriteCategoryFont(font, ctx.favoriteIds)) {
    return "favorites";
  }

  // 3. 활성화 (임시 활성화, OS 시스템 설치, 사용자 설치)
  if (
    ctx.activatedFontIds.has(font.id) ||
    font.install_status === "activated" ||
    font.install_status === "installed_system" ||
    font.install_status === "installed_user" ||
    font.source === "system" ||
    font.source === "user"
  ) {
    return "activated";
  }

  // 4. 비활성화 (대기 상태)
  return "deactivated";
}

/**
 * 특정 필드(폰트 이름 / 파일 이름) 및 정렬 방향(오름차순 / 내림차순)에 따른 두 폰트 간 비교
 */
function compareFontsByField(
  a: FontMetadata,
  b: FontMetadata,
  field: FontSortField = "fontName",
  order: FontSortOrder = "asc",
  currentLang?: string
): number {
  let diff = 0;

  if (field === "fileName") {
    const nameA = a.file_name || "";
    const nameB = b.file_name || "";
    diff = nameA.localeCompare(nameB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  } else {
    // fontName 기준 (getFontFamilyName -> full_name -> postscript_name -> subfamily_name)
    const nameA = getFontFamilyName(a, currentLang) || a.full_name || a.postscript_name || "";
    const nameB = getFontFamilyName(b, currentLang) || b.full_name || b.postscript_name || "";
    diff = nameA.localeCompare(nameB, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (diff === 0) {
      const subA = a.subfamily_name || "";
      const subB = b.subfamily_name || "";
      diff = subA.localeCompare(subB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }
  }

  return order === "desc" ? -diff : diff;
}

/**
 * 정렬 설정(스마트 / 이름순 / 사용자 정의)에 따른 폰트 목록 정렬
 */
export function sortFonts(
  fonts: FontMetadata[],
  ctx: FontSortContext,
  sortSettings: FontSortSettings = DEFAULT_SORT_SETTINGS,
  currentLang?: string
): FontMetadata[] {
  if (!fonts || fonts.length <= 1) {
    return fonts;
  }

  // 1. 이름순 정렬 모드: 상태와 무관하게 모든 폰트를 설정된 필드 및 방향으로 정렬
  if (sortSettings.mode === "name") {
    return [...fonts].sort((a, b) =>
      compareFontsByField(a, b, sortSettings.nameField, sortSettings.nameOrder, currentLang)
    );
  }

  // 2. 스마트 정렬 또는 사용자 정의 정렬
  // 스마트 정렬 우선순위: 즐겨찾기(1) -> 활성화(2) -> 비활성화(3) -> 접근불가(4)
  const priorityOrder: readonly FontSortBlock[] =
    sortSettings.mode === "smart"
      ? DEFAULT_SORT_BLOCK_ORDER
      : sortSettings.customPriority;

  const field: FontSortField =
    sortSettings.mode === "smart" ? "fontName" : sortSettings.customField;
  const order: FontSortOrder =
    sortSettings.mode === "smart" ? "asc" : sortSettings.customOrder;

  return [...fonts].sort((a, b) => {
    const blockA = getFontSortBlock(a, ctx);
    const blockB = getFontSortBlock(b, ctx);

    if (blockA !== blockB) {
      const rankA = priorityOrder.indexOf(blockA);
      const rankB = priorityOrder.indexOf(blockB);
      const safeRankA = rankA === -1 ? 999 : rankA;
      const safeRankB = rankB === -1 ? 999 : rankB;

      if (safeRankA !== safeRankB) {
        return safeRankA - safeRankB;
      }
    }

    return compareFontsByField(a, b, field, order, currentLang);
  });
}
