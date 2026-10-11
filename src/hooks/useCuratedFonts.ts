import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CuratedFontItem } from "../types/curatedFont";
import { FontMetadata, FontInstallStatus } from "../types/font";
import { FontSortSettings } from "../types/sort";
import { curatedFontService } from "../services/curatedFontService";
import { networkManager } from "../services/networkManager";

export type CuratedFontCategoryFilter =
  | "all"
  | "sans-serif"
  | "serif"
  | "display"
  | "handwriting"
  | "monospace";

const WEIGHT_LABEL_MAP: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

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

interface UseCuratedFontsOptions {
  enabled?: boolean;
  externalSearchQuery?: string;
  sortSettings?: FontSortSettings;
  installedFonts?: FontMetadata[];
}

export function useCuratedFonts(options?: UseCuratedFontsOptions) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const isEnabled = options?.enabled !== false;
  const [fonts, setFonts] = useState<CuratedFontItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(curatedFontService.isOnline);
  const [error, setError] = useState<string | null>(null);


  // 내부 필터 및 상태
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] =
    useState<CuratedFontCategoryFilter>("all");
  const [onlyVariable, setOnlyVariable] = useState<boolean>(false);
  const [onlyInstalled, setOnlyInstalled] = useState<boolean>(false);

  const effectiveSearchQuery =
    options?.externalSearchQuery !== undefined
      ? options.externalSearchQuery
      : internalSearchQuery;

  // 로컬 설치된 폰트 매핑 테이블 (O(1) 판별)
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

  // 네트워크 상태 구독
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
      const data = await curatedFontService.getMetadata();
      setFonts(data);
      setIsOnline(true);
    } catch (err) {
      console.error("[CuratedFonts] 메타데이터 로드 실패:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 최초 로드 및 활성화 시 자동 로드
  useEffect(() => {
    if (isEnabled && isOnline && fonts.length === 0) {
      loadMetadata();
    }
  }, [isEnabled, isOnline, fonts.length, loadMetadata]);

  // 설치 여부 판별 헬퍼
  const getInstalledStatus = useCallback(
    (item: CuratedFontItem): FontInstallStatus | null => {
      const candidates = [
        cleanFontName(item.family),
        cleanFontName(item.name),
        cleanFontName(item.id),
      ];

      // 다국어 metadata에 등록된 다양한 언어의 이름도 후보군에 추가
      if (item.metadata) {
        for (const metaKey of ["Font Family", "Full Font Name"]) {
          const rec = item.metadata[metaKey];
          if (rec && typeof rec === "object") {
            for (const val of Object.values(rec)) {
              const cleaned = cleanFontName(val);
              if (cleaned) candidates.push(cleaned);
            }
          }
        }
      }

      for (const normName of candidates) {
        if (!normName) continue;
        if (installedFamilyMap.has(normName)) {
          return installedFamilyMap.get(normName)!;
        }
        for (const [installedName, status] of installedFamilyMap.entries()) {
          if (
            normName.length >= 3 &&
            (installedName === normName ||
              installedName.startsWith(normName) ||
              normName.startsWith(installedName))
          ) {
            return status;
          }
        }
      }
      return null;
    },
    [installedFamilyMap]
  );


  // 필터링 및 정렬된 폰트 목록
  const filteredFonts = useMemo(() => {
    let result = fonts;

    // 1. 카테고리 필터 (신규 categories 배열 및 레거시 category 복합 대응)
    if (selectedCategory !== "all") {
      const targetCat = selectedCategory.toLowerCase();
      result = result.filter((f) => {
        if (Array.isArray(f.categories) && f.categories.length > 0) {
          return f.categories.some((c) => c.toLowerCase() === targetCat);
        }
        return f.category?.toLowerCase() === targetCat;
      });
    }

    // 2. 가변 폰트 필터
    if (onlyVariable) {
      result = result.filter((f) => Boolean(f.isVariable));
    }

    // 3. 설치된 폰트 필터
    if (onlyInstalled) {
      result = result.filter((f) => Boolean(getInstalledStatus(f)));
    }

    // 4. 검색어 필터 (이름, 영문 family, id, author, license, metadata 전체 탐색)
    if (effectiveSearchQuery.trim().length > 0) {
      const q = effectiveSearchQuery.trim().toLowerCase();
      result = result.filter((f) => {
        const dynName = curatedFontService.getDisplayName(f, currentLang);
        const dynAuthor = curatedFontService.getDisplayAuthor(f, currentLang);

        if (dynName && dynName.toLowerCase().includes(q)) return true;
        if (f.name && f.name.toLowerCase().includes(q)) return true;
        if (f.family && f.family.toLowerCase().includes(q)) return true;
        if (f.id && f.id.toLowerCase().includes(q)) return true;
        if (dynAuthor && dynAuthor.toLowerCase().includes(q)) return true;
        if (f.author && f.author.toLowerCase().includes(q)) return true;
        if (f.license && f.license.toLowerCase().includes(q)) return true;
        if (f.description && f.description.toLowerCase().includes(q)) return true;
        if (f.languages && f.languages.some((l) => l.toLowerCase().includes(q))) return true;

        // metadata 내부 다국어 필드 전체 검색
        if (f.metadata) {
          for (const rec of Object.values(f.metadata)) {
            if (rec && typeof rec === "object") {
              for (const val of Object.values(rec)) {
                if (typeof val === "string" && val.toLowerCase().includes(q)) {
                  return true;
                }
              }
            }
          }
        }

        return false;
      });
    }

    // 5. 정렬 (LocationBar 연동 - 현재 언어 기준 폰트 이름 정렬)
    const mode = options?.sortSettings?.mode;
    const nameOrder = options?.sortSettings?.nameOrder || "asc";

    return [...result].sort((a, b) => {
      const nameA = curatedFontService.getDisplayName(a, currentLang);
      const nameB = curatedFontService.getDisplayName(b, currentLang);
      if (mode === "name") {
        const cmp = nameA.localeCompare(nameB, currentLang || "ko");
        return nameOrder === "desc" ? -cmp : cmp;
      }
      return nameA.localeCompare(nameB, currentLang || "ko");
    });
  }, [
    fonts,
    selectedCategory,
    onlyVariable,
    onlyInstalled,
    effectiveSearchQuery,
    options?.sortSettings,
    getInstalledStatus,
    currentLang,
  ]);

  // VirtualFontList 호환용 FontMetadata 배열 변환 (각 굵기별 개별 카드로 전개)
  const filteredMetadataFonts = useMemo<FontMetadata[]>(() => {
    return filteredFonts.flatMap((item, fontIdx) => {
      const installedStatus = getInstalledStatus(item);
      const weights =
        Array.isArray(item.weights) && item.weights.length > 0
          ? item.weights
          : [400];

      const displayName = curatedFontService.getDisplayName(item, currentLang);
      const displayAuthor = curatedFontService.getDisplayAuthor(item, currentLang);

      const localizedNames: Record<string, string> = {
        ko:
          item.metadata?.["Full Font Name"]?.ko ||
          item.metadata?.["Font Family"]?.ko ||
          item.name ||
          item.family,
        en:
          item.metadata?.["Full Font Name"]?.en ||
          item.metadata?.["Font Family"]?.en ||
          item.name ||
          item.family,
      };
      if (currentLang && !localizedNames[currentLang]) {
        localizedNames[currentLang] = displayName;
      }

      return weights.map((w, wIdx) => {
        const subName = WEIGHT_LABEL_MAP[w] || `${w}`;
        const uniqueId = -300000 - (fontIdx * 100 + wIdx);

        return {
          id: uniqueId,
          file_path: `curated:${item.id}|${item.cssUrl}`,
          file_name: `${displayName}-${subName}.woff2`,
          file_size: 0,
          font_index: 0,
          family_name: displayName,
          subfamily_name: subName,
          full_name: `${displayName} ${subName}`,
          localized_names: localizedNames,
          postscript_name: item.family,
          format: "TrueType" as const,
          source:
            installedStatus === "installed_system"
              ? ("system" as const)
              : installedStatus === "installed_user"
              ? ("user" as const)
              : ("external" as const),
          glyph_count: 0,
          weight: w,
          is_italic: false,
          is_monospace:
            item.category === "monospace" ||
            Boolean(item.categories?.includes("monospace")),
          is_variable: Boolean(item.isVariable),
          designer: displayAuthor,
          license: item.license || "Open Source",
          install_status: installedStatus || "uninstalled",
        };
      });
    });
  }, [filteredFonts, getInstalledStatus, currentLang]);

  // 전체 굵기 카드의 총 개수
  const totalMetadataCount = useMemo(() => {
    return fonts.reduce((acc, f) => acc + (f.weights?.length || 1), 0);
  }, [fonts]);


  return {
    fonts,
    familyCount: fonts.length,
    totalCount: totalMetadataCount,
    filteredFonts,
    filteredMetadataFonts,
    isLoading,
    isOnline,
    error,
    searchQuery: effectiveSearchQuery,
    setSearchQuery: setInternalSearchQuery,
    selectedCategory,
    setSelectedCategory,
    onlyVariable,
    setOnlyVariable,
    onlyInstalled,
    setOnlyInstalled,
    reload: async () => {
      await networkManager.checkNow();
      await loadMetadata();
    },
  };
}
