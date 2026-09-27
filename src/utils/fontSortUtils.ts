import { FontMetadata } from "../types/font";

export interface FontSortContext {
  favoriteIds: Set<string>;
  activatedFontIds: Set<string>;
}

/**
 * 폰트 ID 및 파일 해시를 고려한 즐겨찾기 소속 판별
 */
export function isFontFavorite(font: FontMetadata, favoriteIds: Set<string>): boolean {
  if (favoriteIds.has(font.id)) return true;
  const hashKey = font.file_hash ? `${font.file_hash}:${font.font_index}` : font.id;
  if (favoriteIds.has(hashKey)) return true;
  if (font.file_hash && favoriteIds.has(font.file_hash)) return true;
  return false;
}

/**
 * 폰트 상태에 따른 우선순위 가중치 산출 (낮은 번호일수록 상단 배치)
 * 1순위: 정상 즐겨찾기 (10)
 * 2순위: 임시 활성화 (20)
 * 3순위: OS 사용자 설치 폰트 (30)
 * 4순위: 서재/폴더 일반 보관 폰트 (40)
 * 5순위: OS 시스템 폰트 (50)
 * 6순위: 언플러그드 즐겨찾기 (60)
 * 7순위: 언플러그드 일반 (65)
 * 8순위: 폴더 제거됨 즐겨찾기 (70)
 * 9순위: 폴더 제거됨 일반 (75)
 */
function getFontPriorityWeight(font: FontMetadata, ctx: FontSortContext): number {
  const isFav = isFontFavorite(font, ctx.favoriteIds);

  // 폴더 제거된 보존 폰트 (최하단 영역)
  if (font.install_status === "deleted") {
    return isFav ? 70 : 75;
  }

  // 언플러그드 및 유실 폰트 (하단 영역)
  if (font.install_status === "unplugged" || font.isMissing) {
    return isFav ? 60 : 65;
  }

  // 1순위: 정상 폰트 즐겨찾기
  if (isFav) {
    return 10;
  }

  // 2순위: 임시 활성화
  if (ctx.activatedFontIds.has(font.id)) {
    return 20;
  }

  // 3순위: OS 사용자 설치 폰트
  if (font.source === "user") {
    return 30;
  }

  // 4순위: 서재/폴더 일반 보관 폰트 (외부 미설치 파일)
  if (font.source === "external") {
    return 40;
  }

  // 5순위: OS 시스템 기본 폰트
  return 50;
}

/**
 * 다국어(한글/영문/숫자) 패밀리명 오름차순 비교
 */
function compareFontNames(a: FontMetadata, b: FontMetadata): number {
  const nameA = a.family_name || a.full_name || a.postscript_name || "";
  const nameB = b.family_name || b.full_name || b.postscript_name || "";

  const comparison = nameA.localeCompare(nameB, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  if (comparison !== 0) {
    return comparison;
  }

  // 서브패밀리(굵기/스타일) 2차 비교
  const subA = a.subfamily_name || "";
  const subB = b.subfamily_name || "";
  return subA.localeCompare(subB, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * 우선순위 및 이름순 결합 폰트 목록 정렬
 */
export function sortFontsByPriority(
  fonts: FontMetadata[],
  ctx: FontSortContext
): FontMetadata[] {
  if (!fonts || fonts.length <= 1) {
    return fonts;
  }

  return [...fonts].sort((a, b) => {
    const weightA = getFontPriorityWeight(a, ctx);
    const weightB = getFontPriorityWeight(b, ctx);

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    return compareFontNames(a, b);
  });
}
