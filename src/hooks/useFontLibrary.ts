import { useState, useRef, useEffect } from "react";
import { FontMetadata, CustomFolder } from "../types/font";
import type { ToastVariant } from "../components/common/Toast";
import { FontSortSettings, DEFAULT_SORT_SETTINGS } from "../types/sort";

import { useSetLibrary } from "./font-library/useSetLibrary";
import { useFolderLibrary } from "./font-library/useFolderLibrary";
import { useFontProcessing } from "./font-library/useFontProcessing";
import { useFontFilterAndSort } from "./font-library/useFontFilterAndSort";
import { useFontSyncEvents } from "./font-library/useFontSyncEvents";

import { FontLibraryResult } from "../types/fontLibrary";

interface UseFontLibraryProps {
  defaultCategory?: string;
  sortSettings?: FontSortSettings;
  onToast?: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFontLibrary({
  defaultCategory = "all",
  sortSettings = DEFAULT_SORT_SETTINGS,
  onToast,
}: UseFontLibraryProps = {}): FontLibraryResult {
  const [fonts, setFonts] = useState<FontMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory);
  const activeCategoryRef = useRef<string>(activeCategory);
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [activatedFontIds, setActivatedFontIds] = useState<Set<number>>(new Set());

  // 1. 서재 세트 도메인 서브 훅
  const setLibrary = useSetLibrary({
    activeCategoryRef,
    setActiveCategory,
  });

  // 2. 폰트 가공 및 상태 판정 서브 훅 (선행 임시 customFolders 참조 방지를 위해 지연 폴더 목록 전달)
  const [tempCustomFolders, setTempCustomFolders] = useState<CustomFolder[]>([]);

  // 3. 폰트 메타데이터 가공 및 폴더 카운트 계산 서브 훅
  const processing = useFontProcessing({
    fonts,
    customFolders: tempCustomFolders,
    sets: setLibrary.sets,
    setMap: setLibrary.setMap,
    favoriteIds,
    activatedFontIds,
  });

  // 4. 감시 폴더 도메인 서브 훅
  const folderLibrary = useFolderLibrary({
    activeCategory,
    setActiveCategory,
    folderCounts: processing.folderCounts,
    loadDbState: async () => {
      await syncEvents.loadDbState();
    },
    onToast,
  });

  // 폴더 상태를 processing에 연결
  useEffect(() => {
    setTempCustomFolders(folderLibrary.customFolders);
  }, [folderLibrary.customFolders]);

  // 5. 폰트 필터링, 검색, 섹션화 및 정렬 서브 훅
  const filterAndSort = useFontFilterAndSort({
    processedFonts: processing.processedFonts,
    unpluggedFonts: processing.unpluggedFonts,
    duplicateFontIds: processing.duplicateFontIds,
    duplicateGroupCount: processing.duplicateGroupCount,
    nonSystemDupCounts: processing.nonSystemDupCounts,
    activeCategory,
    searchQuery,
    sets: setLibrary.sets,
    setMap: setLibrary.setMap,
    favoriteIds,
    activatedFontIds,
    sortSettings,
  });

  // 6. 실시간 Tauri 이벤트 구독 및 라이프사이클 동기화 서브 훅
  const syncEvents = useFontSyncEvents({
    customFoldersRef: folderLibrary.customFoldersRef,
    setFonts,
    setCustomFolders: folderLibrary.setCustomFolders,
    setFavoriteIds,
    setActivatedFontIds,
    setIsLoading,
    setScanProgress,
    refreshSets: setLibrary.refreshSets,
    onToast,
  });

  return {
    core: {
      fonts,
      setFonts,
      isLoading,
      setIsLoading,
      scanProgress,
      favoriteIds,
      setFavoriteIds,
      activatedFontIds,
      setActivatedFontIds,
    },
    setLibrary: {
      sets: setLibrary.enrichedSets,
      rawSets: setLibrary.sets,
      setSets: setLibrary.setSets,
      setMap: setLibrary.setMap,
      setFontIds: setLibrary.setFontIds,
      setSetFontIds: setLibrary.setSetFontIds,
      refreshSets: setLibrary.refreshSets,
      refreshSetCount: setLibrary.refreshSetCount,
      handleSelectSet: setLibrary.handleSelectSet,
      handleUpdateSet: setLibrary.handleUpdateSet,
      handleUpdateSetParent: setLibrary.handleUpdateSetParent,
      handleUpdateSetColor: setLibrary.handleUpdateSetColor,
      handleCreateSet: setLibrary.handleCreateSet,
    },
    folderLibrary: {
      customFolders: folderLibrary.enrichedCustomFolders,
      rawFolders: folderLibrary.customFolders,
      setCustomFolders: folderLibrary.setCustomFolders,
      customFoldersRef: folderLibrary.customFoldersRef,
      handleRelinkFolder: folderLibrary.handleRelinkFolder,
      handleRemoveFolderWithData: folderLibrary.handleRemoveFolderWithData,
      handleUpdateFolderColor: folderLibrary.handleUpdateFolderColor,
    },
    filterAndSort: {
      filteredFonts: filterAndSort.filteredFonts,
      fontSections: filterAndSort.fontSections,
      categoryCounts: filterAndSort.categoryCounts,
      searchQuery,
      setSearchQuery,
      activeCategory,
      setActiveCategory,
    },
    processing: {
      unpluggedFonts: processing.unpluggedFonts,
      duplicateFontIds: processing.duplicateFontIds,
    },
    syncEvents: {
      loadSystemFonts: syncEvents.loadSystemFonts,
      loadDbState: syncEvents.loadDbState,
      refreshList: syncEvents.refreshList,
    },
  };
}
