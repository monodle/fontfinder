import { FontMetadata } from "../types/font";

/**
 * i18n 언어 코드를 표준 키(예: 'ko-KR' -> 'ko')로 정규화
 */
function normalizeLangCode(lang?: string): string {
  if (!lang) return "ko";
  const lower = lang.toLowerCase();
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("zh-cn") || lower === "zh") return "zh-CN";
  if (lower.startsWith("zh-tw") || lower.startsWith("zh-hk")) return "zh-TW";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("es")) return "es";
  return lower.split("-")[0];
}

/**
 * 2바이트 CJK 문자열(EUC-KR, Big5, Shift-JIS 등)이 MacRoman이나 Latin-1로 잘못 디코딩되어
 * 발생하는 전형적인 모지바케(예: "¿©±â¾î¶§", "³ª´®½ºÄù¾î") 패턴을 감지
 */
function isCorruptedMojibake(text: string): boolean {
  if (!text) return false;
  // Latin-1 Supplement 특수/악센트 기호 범위 (0x00A1 ~ 0x00FF)
  const mojibakeCharPattern = /[\u00A1-\u00FF]/g;
  const matches = text.match(mojibakeCharPattern);
  if (!matches) return false;

  // 연속된 2개 이상의 Latin-1 특수 기호가 있거나 전체 길이 대비 비율이 높은 경우
  const consecutivePattern = /[\u00A1-\u00FF]{2,}/;
  if (consecutivePattern.test(text) && matches.length >= 2) {
    return true;
  }
  return matches.length / text.length > 0.4;
}

/**
 * 앱의 현재 설정 언어에 맞춘 최적의 글꼴 패밀리 이름을 반환
 * 우선순위:
 * 1. localized_names[현재 언어] (모지바케 깨짐 검증 통과)
 * 2. localized_names['en'] (모지바케 깨짐 검증 통과)
 * 3. font.family_name (모지바케 깨짐 검증 통과)
 * 4. font.file_name (확장자 제외)
 */
export function getFontFamilyName(font: FontMetadata, currentLang?: string): string {
  if (!font) return "";

  const normLang = normalizeLangCode(currentLang);
  const loc = font.localized_names;

  if (loc) {
    const candidate = loc[normLang]?.trim();
    if (candidate && !isCorruptedMojibake(candidate)) {
      return candidate;
    }
    // 영어 fallback
    if (normLang !== "en") {
      const enCandidate = loc["en"]?.trim();
      if (enCandidate && !isCorruptedMojibake(enCandidate)) {
        return enCandidate;
      }
    }
  }

  if (font.family_name && font.family_name.trim()) {
    const fam = font.family_name.trim();
    if (!isCorruptedMojibake(fam)) {
      return fam;
    }
  }

  if (font.file_name) {
    return font.file_name.replace(/\.[^/.]+$/, "");
  }

  return "";
}

/**
 * 검색 쿼리가 해당 폰트의 이름(기본명, 다국어명 전체, 파일명)과 일치하는지 검사
 */
export function matchesFontSearch(font: FontMetadata, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  if (font.family_name?.toLowerCase().includes(q)) return true;
  if (font.subfamily_name?.toLowerCase().includes(q)) return true;
  if (font.full_name?.toLowerCase().includes(q)) return true;
  if (font.postscript_name?.toLowerCase().includes(q)) return true;
  if (font.file_name?.toLowerCase().includes(q)) return true;

  if (font.localized_names) {
    for (const val of Object.values(font.localized_names)) {
      if (val && val.toLowerCase().includes(q)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * OS/2 fsType 비트 플래그를 i18n 번역 라벨로 변환
 */
export function formatFsType(
  fsType: number | undefined | null,
  t: (key: string, options?: any) => string,
  fallbackLabel?: string
): string {
  if (fsType === undefined || fsType === null || fsType === 0) {
    return t("font_info.fs_type.installable", "설치 가능 (제한 없음)");
  }
  const parts: string[] = [];
  if ((fsType & 0x0002) !== 0) {
    parts.push(t("font_info.fs_type.restricted", "임베딩 제한 (Restricted)"));
  }
  if ((fsType & 0x0004) !== 0) {
    parts.push(t("font_info.fs_type.preview_print", "미리보기/인쇄 허용 (Preview & Print)"));
  }
  if ((fsType & 0x0008) !== 0) {
    parts.push(t("font_info.fs_type.editable", "편집 허용 (Editable)"));
  }
  if ((fsType & 0x0100) !== 0) {
    parts.push(t("font_info.fs_type.no_subsetting", "서브셋팅 금지 (No Subsetting)"));
  }
  if ((fsType & 0x0200) !== 0) {
    parts.push(t("font_info.fs_type.bitmap_only", "비트맵 전용 (Bitmap Only)"));
  }
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return fallbackLabel || `0x${fsType.toString(16).padStart(4, "0")}`;
}

/**
 * OS/2 sFamilyClass (IBM Font Family Class) 값을 i18n 번역 라벨로 변환
 * classID는 상위 8비트 ((sFamilyClass >> 8) & 0xFF)
 */
export function formatFamilyClass(
  sFamilyClass: number | undefined | null,
  t: (key: string, options?: any) => string,
  fallbackLabel?: string
): string {
  if (sFamilyClass === undefined || sFamilyClass === null) {
    return fallbackLabel || t("font_info.family_class.none", "No Classification (미분류)");
  }
  const classId = (sFamilyClass >> 8) & 0xff;
  switch (classId) {
    case 1:
      return t("font_info.family_class.oldstyle_serifs", "Oldstyle Serifs (옛날 명조/세리프)");
    case 2:
      return t("font_info.family_class.transitional_serifs", "Transitional Serifs (과도기 세리프)");
    case 3:
      return t("font_info.family_class.modern_serifs", "Modern Serifs (모던 세리프)");
    case 4:
      return t("font_info.family_class.clarendon_serifs", "Clarendon Serifs (클라렌던 세리프)");
    case 5:
      return t("font_info.family_class.slab_serifs", "Slab Serifs (슬랩 세리프)");
    case 7:
      return t("font_info.family_class.freeform_serifs", "Freeform Serifs (자유형 세리프)");
    case 8:
      return t("font_info.family_class.sans_serif", "Sans-serif (고딕/산세리프)");
    case 9:
      return t("font_info.family_class.scripts", "Scripts (필기체/손글씨)");
    case 10:
      return t("font_info.family_class.decorative", "Decorative / Display (장식/디스플레이)");
    case 12:
      return t("font_info.family_class.symbolic", "Symbolic (기호/심볼)");
    default:
      return t("font_info.family_class.none", "No Classification (미분류)");
  }
}
