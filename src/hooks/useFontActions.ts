import type { ToastVariant } from "../components/common/Toast";
import {
  FontCoreDomain,
  FontSetDomain,
  FolderDomain,
  FilterAndSortDomain,
  SyncEventsDomain,
} from "../types/fontLibrary";
import { useFontFavoriteActions } from "./font-actions/useFontFavoriteActions";
import { useFontActivationActions } from "./font-actions/useFontActivationActions";
import { useFontInstallActions } from "./font-actions/useFontInstallActions";
import { useFontSetActions } from "./font-actions/useFontSetActions";
import { useFontFolderActions } from "./font-actions/useFontFolderActions";

export interface UseFontActionsProps {
  core: FontCoreDomain;
  setLibrary: FontSetDomain;
  folderLibrary: FolderDomain;
  filterAndSort: FilterAndSortDomain;
  syncEvents: SyncEventsDomain;
  selectedFontIds: Set<number>;
  handleClearSelection: () => void;
  showToast: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFontActions({
  core,
  setLibrary,
  folderLibrary,
  filterAndSort,
  syncEvents,
  selectedFontIds,
  handleClearSelection,
  showToast,
}: UseFontActionsProps) {
  const {
    fonts,
    setFonts,
    favoriteIds,
    setFavoriteIds,
    activatedFontIds,
    setActivatedFontIds,
    setIsLoading,
  } = core;

  const { sets, setSets, refreshSets, refreshSetCount } = setLibrary;
  const { setCustomFolders, customFoldersRef } = folderLibrary;
  const { filteredFonts, activeCategory, setActiveCategory } = filterAndSort;
  const { loadSystemFonts, loadDbState, refreshList } = syncEvents;

  // 1. 즐겨찾기 도메인 액션
  const favoriteActions = useFontFavoriteActions({
    favoriteIds,
    setFavoriteIds,
    handleClearSelection,
  });

  // 2. 임시 활성화 도메인 액션
  const activationActions = useFontActivationActions({
    fonts,
    activatedFontIds,
    setActivatedFontIds,
    handleClearSelection,
    showToast,
  });

  // 3. 시스템 설치/제거 도메인 액션
  const installActions = useFontInstallActions({
    filteredFonts,
    selectedFontIds,
    activatedFontIds,
    setActivatedFontIds,
    loadSystemFonts,
    refreshList,
    handleClearSelection,
    showToast,
  });

  // 4. 서재 세트 도메인 액션
  const setActions = useFontSetActions({
    fonts,
    sets,
    setSets,
    activeCategory,
    setActiveCategory,
    refreshSets,
    refreshSetCount,
    loadDbState,
    handleClearSelection,
    showToast,
  });

  // 5. 감시 폴더 관리 도메인 액션
  const folderActions = useFontFolderActions({
    fonts,
    setFonts,
    customFoldersRef,
    setCustomFolders,
    activeCategory,
    setActiveCategory,
    activatedFontIds,
    setActivatedFontIds,
    refreshSets,
    loadDbState,
    setIsLoading,
    showToast,
  });

  return {
    ...favoriteActions,
    ...activationActions,
    ...installActions,
    ...setActions,
    ...folderActions,
  };
}
