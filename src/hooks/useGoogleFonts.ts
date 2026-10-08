import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GoogleFontFamily } from "../types/googleFont";
import { FontMetadata, FontInstallStatus } from "../types/font";
import { FontSortSettings } from "../types/sort";
import { googleFontService } from "../services/googleFontService";
import { networkManager } from "../services/networkManager";
import { getInitialSubsetForLanguage } from "../utils/onlineFontUtils";

export type GoogleFontCategoryFilter = "all" | "Sans Serif" | "Serif" | "Display" | "Handwriting" | "Monospace";
export type GoogleFontSortOption = "popularity" | "name" | "dateAdded";

export const GOOGLE_FONT_SUBSETS: { id: string; label: string }[] = [
  { id: "all", label: "모든 언어" },
  { id: "korean", label: "한국어 (Korean)" },
  { id: "japanese", label: "일본어 (Japanese)" },
  { id: "chinese-simplified", label: "중국어 간체" },
  { id: "chinese-traditional", label: "중국어 번체" },
  { id: "latin", label: "라틴 (Latin)" },
  { id: "cyrillic", label: "키릴 (Cyrillic)" },
  { id: "arabic", label: "아랍어 (Arabic)" },
];

/**
 * 폰트 이름 정규화 (공백, 하이픈, 언더스코어, CJK 접미사 제거 및 소문자 통일)
 */
function cleanFontName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[\s\-_]/g, "")
    .replace(/cjkkr$/, "kr")
    .replace(/cjk$/, "");
}

interface UseGoogleFontsOptions {
  enabled?: boolean;
  externalSearchQuery?: string;
  sortSettings?: FontSortSettings;
  installedFonts?: FontMetadata[];
}

export function useGoogleFonts(options?: UseGoogleFontsOptions) {
  const isEnabled = options?.enabled !== false;
  const { i18n } = useTranslation();
  const [fonts, setFonts] = useState<GoogleFontFamily[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(googleFontService.isOnline);
  const [error, setError] = useState<string | null>(null);

  // 내부 필터 및 정렬 상태
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<GoogleFontCategoryFilter>("all");
  const [selectedSubset, setSelectedSubset] = useState<string>(() =>
    getInitialSubsetForLanguage(i18n.language)
  );
  const [onlyVariable, setOnlyVariable] = useState<boolean>(false);
  const [onlyInstalled, setOnlyInstalled] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<GoogleFontSortOption>("popularity");

  // 앱 언어 설정 변경 시 기본 서브셋 자동 동기화
  useEffect(() => {
    setSelectedSubset(getInitialSubsetForLanguage(i18n.language));
  }, [i18n.language]);

  const effectiveSearchQuery = options?.externalSearchQuery !== undefined
    ? options.externalSearchQuery
    : internalSearchQuery;

  // 로컬 설치된 폰트 이름 -> 설치 상태 매핑 테이블 생성 (빠른 O(1) 조회)
  const installedFamilyMap = useMemo(() => {
    const map = new Map<string, FontInstallStatus>();
    if (!options?.installedFonts || options.installedFonts.length === 0) return map;

    for (const font of options.installedFonts) {
      const isInst =
        font.install_status === "installed_system" ||
        font.install_status === "installed_user" ||
        font.source === "system" ||
        font.source === "user";

      if (!isInst) continue;

      const status: FontInstallStatus =
        font.install_status === "installed_system" || font.source === "system"
          ? "installed_system"
          : "installed_user";

      if (font.family_name) {
        const clean = cleanFontName(font.family_name);
        if (clean) map.set(clean, status);
      }
      if (font.full_name) {
        const clean = cleanFontName(font.full_name);
        if (clean) map.set(clean, status);
      }
      if (font.localized_names) {
        for (const locName of Object.values(font.localized_names)) {
          const clean = cleanFontName(locName);
          if (clean) map.set(clean, status);
        }
      }
      if (font.postscript_name) {
        const psFamily = font.postscript_name.split("-")[0];
        const clean = cleanFontName(psFamily);
        if (clean) map.set(clean, status);
      }
    }
    return map;
  }, [options?.installedFonts]);

  // 온라인 상태 동기화 (SSOT: networkManager)
  useEffect(() => {
    return networkManager.subscribe((status) => {
      setIsOnline(status);
    });
  }, []);

  // 메타데이터 로드 함수
  const loadMetadata = useCallback(async () => {
    const isOnlineNow = await networkManager.checkNow();
    if (!isOnlineNow) {
      setIsOnline(false);
      return;
    }

    setIsOnline(true);
    setIsLoading(true);
    setError(null);
    try {
      const data = await googleFontService.getMetadata();
      setFonts(data);
      setIsOnline(true);
    } catch (err) {
      console.error("[GoogleFonts] 메타데이터 로드 실패:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 최초 로드 및 온라인 복구 시 자동 로드
  useEffect(() => {
    if (isEnabled && isOnline && fonts.length === 0) {
      loadMetadata();
    }
  }, [isEnabled, isOnline, fonts.length, loadMetadata]);

  // 구글 폰트 패밀리의 로컬 설치 여부 판별 헬퍼
  const getInstalledStatus = useCallback(
    (family: GoogleFontFamily): FontInstallStatus | null => {
      const normGfName = cleanFontName(family.family);
      if (installedFamilyMap.has(normGfName)) {
        return installedFamilyMap.get(normGfName)!;
      }
      // Noto 계열 또는 한글 폰트 서브셋 부분 매칭
      for (const [installedName, status] of installedFamilyMap.entries()) {
        if (
          normGfName.length >= 4 &&
          (installedName === normGfName ||
            installedName.startsWith(normGfName) ||
            normGfName.startsWith(installedName))
        ) {
          return status;
        }
      }
      return null;
    },
    [installedFamilyMap]
  );

  // 필터링 및 정렬된 폰트 목록
  const filteredFonts = useMemo(() => {
    let result = fonts;

    // 1. 카테고리(형태) 필터
    if (selectedCategory !== "all") {
      result = result.filter(
        (f) => f.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 2. 언어(문자셋) 필터 (예: korean, latin 등)
    if (selectedSubset !== "all") {
      result = result.filter(
        (f) => Array.isArray(f.subsets) && f.subsets.includes(selectedSubset)
      );
    }

    // 3. 가변 폰트만 보기 필터
    if (onlyVariable) {
      result = result.filter(
        (f) => Boolean(f.axes && f.axes.length > 0)
      );
    }

    // 4. 설치된 폰트만 보기 필터
    if (onlyInstalled) {
      result = result.filter((f) => Boolean(getInstalledStatus(f)));
    }

    // 5. 검색어 필터
    if (effectiveSearchQuery.trim().length > 0) {
      const q = effectiveSearchQuery.trim().toLowerCase();
      result = result.filter(
        (f) =>
          f.family.toLowerCase().includes(q) ||
          f.designers.some((d) => d.toLowerCase().includes(q))
      );
    }

    // 6. 정렬 (LocationBar의 sortSettings가 전달되면 최우선 연동)
    const mode = options?.sortSettings?.mode;
    const nameOrder = options?.sortSettings?.nameOrder || "asc";

    return [...result].sort((a, b) => {
      if (mode === "smart") {
        // ✨ 스마트/추천: 구글 폰트 인기순 (Trending / Popularity)
        return (a.popularity || 9999) - (b.popularity || 9999);
      }
      if (mode === "name") {
        // ↓A-Z / ↑Z-A: 이름순 (오름차순 / 내림차순)
        const cmp = a.family.localeCompare(b.family);
        return nameOrder === "desc" ? -cmp : cmp;
      }
      if (mode === "custom") {
        // 🎛️ 커스텀: 최신 추가순 (Date Added)
        return (b.dateAdded || "").localeCompare(a.dateAdded || "");
      }

      // fallback
      if (sortBy === "popularity") {
        return (a.popularity || 9999) - (b.popularity || 9999);
      }
      if (sortBy === "name") {
        return a.family.localeCompare(b.family);
      }
      if (sortBy === "dateAdded") {
        return (b.dateAdded || "").localeCompare(a.dateAdded || "");
      }
      return 0;
    });
  }, [
    fonts,
    selectedCategory,
    selectedSubset,
    onlyVariable,
    onlyInstalled,
    effectiveSearchQuery,
    options?.sortSettings,
    sortBy,
    getInstalledStatus,
  ]);

  // VirtualFontList 호환용 FontMetadata 배열 변환 (설치 상태 정확히 매핑)
  const filteredMetadataFonts = useMemo<FontMetadata[]>(() => {
    return filteredFonts.map((family, idx) => {
      const installedStatus = getInstalledStatus(family);

      return {
        id: -100000 - idx, // 고유 음수 ID로 로컬 폰트와 충돌 없이 식별
        file_path: `google:${family.family}`,
        file_name: `${family.family}.ttf`,
        file_size: family.size || 0,
        font_index: 0,
        family_name: family.family,
        subfamily_name: "Regular",
        full_name: family.family,
        postscript_name: family.family.replace(/\s+/g, ""),
        format: "TrueType",
        source: installedStatus === "installed_system" ? "system" : installedStatus === "installed_user" ? "user" : "external",
        glyph_count: 0,
        weight: 400,
        is_italic: false,
        is_monospace: family.category === "Monospace",
        is_variable: Boolean(family.axes && family.axes.length > 0),
        designer: family.designers?.join(", ") || "",
        license: "SIL Open Font License",
        install_status: installedStatus || "uninstalled",
      };
    });
  }, [filteredFonts, getInstalledStatus]);

  return {
    fonts,
    totalCount: fonts.length,
    filteredFonts,
    filteredMetadataFonts,
    isLoading,
    isOnline,
    error,
    searchQuery: effectiveSearchQuery,
    setSearchQuery: setInternalSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSubset,
    setSelectedSubset,
    onlyVariable,
    setOnlyVariable,
    onlyInstalled,
    setOnlyInstalled,
    sortBy,
    setSortBy,
    reload: async () => {
      await networkManager.checkNow();
      await loadMetadata();
    },
  };
}
