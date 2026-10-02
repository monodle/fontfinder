import { FontMetadata, FontLibraryTag } from "../types/font";

/**
 * 폰트 고유 식별 키 생성
 * 1순위: postscript_name (대소문자 무시)
 * 2순위: full_name (대소문자 무시)
 * 3순위: family_name + subfamily_name (대소문자 무시)
 */
export function getFontUniqueKey(font: FontMetadata): string {
  const ps = font.postscript_name?.trim();
  if (ps) return ps.toLowerCase();

  const full = font.full_name?.trim();
  if (full) return full.toLowerCase();

  const family = font.family_name?.trim() || "";
  const subfamily = font.subfamily_name?.trim() || "";
  return `${family}_${subfamily}`.toLowerCase();
}

/**
 * 대표 폰트(Primary Font) 선정을 위한 우선순위 점수 산출
 * - OS 시스템/사용자 설치 폰트: 100점
 * - 현재 임시 활성화 폰트: 80점
 * - 외부 정상 보관 폰트: 50점 + 버전 가산점
 * - 언플러그드/유실/삭제 폰트: 10점
 */
function getRepresentativeScore(
  font: FontMetadata,
  activatedFontIds: Set<number>
): number {
  let score = 0;

  if (font.source === "system" || font.source === "user") {
    score = 100;
  } else if (activatedFontIds.has(font.id)) {
    score = 80;
  } else if (!font.isMissing && font.install_status !== "deleted" && font.install_status !== "unplugged") {
    score = 50;
  } else if (font.install_status === "unplugged") {
    // 연결 끊김(외장 드라이브 분리 등)은 출처 폴더 완전 제거(deleted)보다 우선 채택
    score = 20;
  } else {
    // 출처 폴더 제거(deleted) 또는 알 수 없는 부재 상태
    score = 10;
  }

  // 최신 버전 가산점
  if (font.version_num) {
    score += Math.min(font.version_num / 100000, 10);
  }

  return score;
}

/**
 * 폰트 목록에서 중복 폰트를 1개로 집약(Deduplication)하고 소속 서재(libraries) 정보를 병합
 */
export function deduplicateFonts(
  fonts: FontMetadata[],
  activatedFontIds: Set<number> = new Set()
): FontMetadata[] {
  if (!fonts || fonts.length <= 1) {
    return fonts;
  }

  const groupMap = new Map<string, FontMetadata[]>();

  for (const font of fonts) {
    const key = getFontUniqueKey(font);
    const existing = groupMap.get(key);
    if (!existing) {
      groupMap.set(key, [font]);
    } else {
      existing.push(font);
    }
  }

  const result: FontMetadata[] = [];

  for (const group of groupMap.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // 1. 대표 폰트(Primary) 선정
    let primary = group[0];
    let bestScore = getRepresentativeScore(primary, activatedFontIds);

    for (let i = 1; i < group.length; i++) {
      const candidate = group[i];
      const score = getRepresentativeScore(candidate, activatedFontIds);
      if (score > bestScore) {
        primary = candidate;
        bestScore = score;
      }
    }

    // 2. 모든 중복 파일의 소속 서재/폴더(libraries) 태그 병합
    const mergedLibraries: FontLibraryTag[] = [];
    const seenLibKeys = new Set<string>();

    for (const item of group) {
      if (item.libraries) {
        for (const lib of item.libraries) {
          const libKey = `${lib.type}:${lib.id}`;
          if (!seenLibKeys.has(libKey)) {
            seenLibKeys.add(libKey);
            mergedLibraries.push(lib);
          }
        }
      }
    }

    result.push({
      ...primary,
      libraries: mergedLibraries,
    });
  }

  return result;
}
