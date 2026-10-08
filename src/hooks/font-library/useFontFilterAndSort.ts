import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata, FontSet, FontSection } from "../../types/font";
import { FontSortSettings, DEFAULT_SORT_SETTINGS } from "../../types/sort";
import { sortFonts } from "../../utils/fontSortUtils";
import { matchesFontSearch } from "../../utils/fontLocalization";
import { queryCategoryFonts, getSetFonts } from "../../utils/fontQueryEngine";
import {
  isAllCategoryFont,
  isSystemCategoryFont,
  isUserCategoryFont,
  isActivatedCategoryFont,
} from "../../utils/fontFilterUtils";

interface UseFontFilterAndSortProps {
  processedFonts: FontMetadata[];
  unpluggedFonts: FontMetadata[];
  duplicateFontIds: Set<number>;
  duplicateGroupCount: number;
  nonSystemDupCounts: Map<string, number>;
  activeCategory: string;
  searchQuery: string;
  sets: FontSet[];
  setMap: Map<number, Set<number>>;
  favoriteIds: Set<number>;
  activatedFontIds: Set<number>;
  sortSettings?: FontSortSettings;
}

export function useFontFilterAndSort({
  processedFonts,
  unpluggedFonts,
  duplicateFontIds,
  duplicateGroupCount,
  nonSystemDupCounts,
  activeCategory,
  searchQuery,
  sets,
  setMap,
  favoriteIds,
  activatedFontIds,
  sortSettings = DEFAULT_SORT_SETTINGS,
}: UseFontFilterAndSortProps) {
  const { i18n } = useTranslation();

  // 카테고리별 실시간 파일/그룹 카운트 (SSOT: fontFilterUtils)
  const categoryCounts = useMemo(() => {
    const activeNonSystemFonts = processedFonts.filter(isAllCategoryFont);
    const systemFonts = processedFonts.filter(isSystemCategoryFont);
    const userFonts = processedFonts.filter(isUserCategoryFont);
    const activatedFonts = processedFonts.filter((f) => isActivatedCategoryFont(f, activatedFontIds));

    return {
      total: activeNonSystemFonts.length,
      system: systemFonts.length,
      user: userFonts.length,
      activated: activatedFonts.length,
      favorites: favoriteIds.size,
      duplicates: duplicateGroupCount,
      duplicateGroups: duplicateGroupCount,
    };
  }, [processedFonts, activatedFontIds, favoriteIds, duplicateGroupCount]);

  // 필터링된 폰트 목록 및 서재 1depth 섹션 정보
  const { filteredFonts, fontSections } = useMemo(() => {
    let result: FontMetadata[] = [];
    let sections: FontSection[] | undefined = undefined;

    const sortGroup = (fontsToSort: FontMetadata[]) => {
      return sortFonts(
        fontsToSort,
        {
          favoriteIds,
          activatedFontIds,
        },
        sortSettings,
        i18n.language
      );
    };

    const queryContext = {
      processedFonts,
      unpluggedFonts,
      duplicateFontIds,
      duplicateGroupCount,
      nonSystemDupCounts,
      activatedFontIds,
      favoriteIds,
      setMap,
      sets,
    };

    if (activeCategory.startsWith("set:")) {
      const setId = Number(activeCategory.replace("set:", ""));
      const targetSet = sets.find((s) => s.id === setId);
      const isParent = targetSet ? targetSet.parent_id == null : false;
      const childSets = isParent ? sets.filter((c) => c.parent_id === setId) : [];

      if (isParent && childSets.length > 0 && targetSet) {
        const getGroupedSetFonts = (sId: number) => {
          const matched = getSetFonts(sId, queryContext);
          const filtered = searchQuery.trim()
            ? matched.filter((f) => matchesFontSearch(f, searchQuery))
            : matched;
          return sortGroup(filtered);
        };

        const secList: FontSection[] = [];

        // 1) 1depth 서재 자신
        const ownFonts = getGroupedSetFonts(targetSet.id);
        secList.push({
          id: `set-${targetSet.id}`,
          setId: targetSet.id,
          title: targetSet.name,
          color: targetSet.color,
          isParent: true,
          count: ownFonts.length,
          fonts: ownFonts,
        });

        // 2) 2depth 자식 세트들
        for (const child of childSets) {
          const childFonts = getGroupedSetFonts(child.id);
          secList.push({
            id: `set-${child.id}`,
            setId: child.id,
            title: child.name,
            color: child.color,
            isParent: false,
            count: childFonts.length,
            fonts: childFonts,
          });
        }

        const visibleSections = searchQuery.trim()
          ? secList.filter((s) => s.fonts.length > 0)
          : secList;

        sections = visibleSections;
        result = visibleSections.flatMap((s) => s.fonts);

        return {
          filteredFonts: result,
          fontSections: sections,
        };
      } else {
        result = queryCategoryFonts(activeCategory, queryContext);
      }
    } else {
      result = queryCategoryFonts(activeCategory, queryContext);
    }

    if (searchQuery.trim()) {
      result = result.filter((f) => matchesFontSearch(f, searchQuery));
    }

    return {
      filteredFonts: sortGroup(result),
      fontSections: undefined,
    };
  }, [
    processedFonts,
    activeCategory,
    searchQuery,
    favoriteIds,
    setMap,
    sets,
    unpluggedFonts,
    duplicateFontIds,
    nonSystemDupCounts,
    activatedFontIds,
    sortSettings,
    i18n.language,
  ]);

  return {
    filteredFonts,
    fontSections,
    categoryCounts,
  };
}
