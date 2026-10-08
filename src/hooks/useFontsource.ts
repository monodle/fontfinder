import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FontsourceItem } from "../types/fontsource";
import { FontMetadata, FontInstallStatus } from "../types/font";
import { FontSortSettings } from "../types/sort";
import { fontsourceService } from "../services/fontsourceService";
import { networkManager } from "../services/networkManager";
import { getInitialSubsetForLanguage } from "../utils/onlineFontUtils";

export type FontsourceCategoryFilter =
  | "all"
  | "sans-serif"
  | "serif"
  | "display"
  | "handwriting"
  | "monospace"
  | "other";

export type FontsourceSortOption = "default" | "name" | "lastModified";

export const FONTSOURCE_SUBSETS: { id: string; label: string }[] = [
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

interface UseFontsourceOptions {
  enabled?: boolean;
  externalSearchQuery?: string;
  sortSettings?: FontSortSettings;
  installedFonts?: FontMetadata[];
}

export function useFontsource(options?: UseFontsourceOptions) {
  const isEnabled = options?.enabled !== false;
  const { i18n } = useTranslation();
  const [fonts, setFonts] = useState<FontsourceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(fontsourceService.isOnline);
  const [error, setError] = useState<string | null>(null);

  // 내부 필터 및 정렬 상태
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<FontsourceCategoryFilter>("all");
  const [selectedSubset, setSelectedSubset] = useState<string>(() =>
    getInitialSubsetForLanguage(i18n.language)
  );
  const [onlyVariable, setOnlyVariable] = useState<boolean>(false);
  const [onlyInstalled, setOnlyInstalled] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<FontsourceSortOption>("default");

  // 앱 언어 설정 변경 시 기본 서브셋 자동 동기화
  useEffect(() => {
    setSelectedSubset(getInitialSubsetForLanguage(i18n.language));
  }, [i18n.language]);

  const effectiveSearchQuery =
    options?.externalSearchQuery !== undefined
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
      const data = await fontsourceService.getMetadata();
      setFonts(data);
      setIsOnline(true);
    } catch (err) {
      console.error("[Fontsource] 메타데이터 로드 실패:", err);
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

  // 로컬 설치 여부 판별 헬퍼
  const getInstalledStatus = useCallback(
    (item: FontsourceItem): FontInstallStatus | null => {
      const normName = cleanFontName(item.family);
      if (installedFamilyMap.has(normName)) {
        return installedFamilyMap.get(normName)!;
      }
      for (const [installedName, status] of installedFamilyMap.entries()) {
        if (
          normName.length >= 4 &&
          (installedName === normName ||
            installedName.startsWith(normName) ||
            normName.startsWith(installedName))
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

    // 1. 카테고리 필터
    if (selectedCategory !== "all") {
      result = result.filter(
        (f) => f.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 2. 언어(문자셋) 필터
    if (selectedSubset !== "all") {
      result = result.filter(
        (f) => Array.isArray(f.subsets) && f.subsets.includes(selectedSubset)
      );
    }

    // 3. 가변 폰트 필터
    if (onlyVariable) {
      result = result.filter((f) => Boolean(f.variable));
    }

    // 4. 로컬 설치된 폰트 필터
    if (onlyInstalled) {
      result = result.filter((f) => Boolean(getInstalledStatus(f)));
    }

    // 5. 검색어 필터
    if (effectiveSearchQuery.trim().length > 0) {
      const q = effectiveSearchQuery.trim().toLowerCase();
      result = result.filter(
        (f) =>
          f.family.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q) ||
          f.license.toLowerCase().includes(q)
      );
    }

    // 6. 정렬 (LocationBar의 sortSettings가 전달되면 최우선 연동)
    const mode = options?.sortSettings?.mode;
    const nameOrder = options?.sortSettings?.nameOrder || "asc";

    return [...result].sort((a, b) => {
      if (mode === "name") {
        const cmp = a.family.localeCompare(b.family);
        return nameOrder === "desc" ? -cmp : cmp;
      }
      if (mode === "custom") {
        return (b.lastModified || "").localeCompare(a.lastModified || "");
      }

      // fallback
      if (sortBy === "name") {
        return a.family.localeCompare(b.family);
      }
      if (sortBy === "lastModified") {
        return (b.lastModified || "").localeCompare(a.lastModified || "");
      }
      return 0; // default (기본 제공 순서 유지)
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

  // VirtualFontList 호환용 FontMetadata 배열 변환
  const filteredMetadataFonts = useMemo<FontMetadata[]>(() => {
    return filteredFonts.map((item, idx) => {
      const installedStatus = getInstalledStatus(item);

      return {
        id: -200000 - idx, // Fontsource 전용 음수 ID (-200,000부터 부여)
        file_path: `fontsource:${item.id}`,
        file_name: `${item.id}.woff2`,
        file_size: 0,
        font_index: 0,
        family_name: item.family,
        subfamily_name: item.styles?.join(", ") || "Regular",
        full_name: item.family,
        postscript_name: item.id,
        format: "TrueType",
        source:
          installedStatus === "installed_system"
            ? "system"
            : installedStatus === "installed_user"
            ? "user"
            : "external",
        glyph_count: 0,
        weight: item.weights?.[0] || 400,
        is_italic: item.styles?.includes("italic") || false,
        is_monospace: item.category === "monospace",
        is_variable: Boolean(item.variable),
        designer: item.type === "google" ? "Google Fonts / Open Source" : "Fontsource Open Source",
        license: item.license || "Open Source",
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
