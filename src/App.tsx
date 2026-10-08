import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Sliders, AlertTriangle, FolderSync, WifiOff } from "lucide-react";
import { normalizePath } from "./utils/pathUtils";
import { FontMetadata, FontLibraryTag } from "./types/font";
import { fontService } from "./services/fontService";
import { settingsService, CustomAppSettings } from "./services/settingsService";
import {
  appConfig,
  getDefaultPreviewText,
  isDefaultPreviewText,
} from "./config/appConfig";
import { DB_SETTINGS_KEYS } from "./config/storageKeys";
import { changeLanguage } from "./i18n";
import { sanitizePreviewSettings } from "./utils/settingsSanitizer";

import { useFontLibrary } from "./hooks/useFontLibrary";
import { useFontSelection } from "./hooks/useFontSelection";
import { useFontActions } from "./hooks/useFontActions";
import { useTypeToSearch } from "./hooks/useTypeToSearch";
import { useFolderDrop } from "./hooks/useFolderDrop";
import { useAppToast } from "./hooks/useAppToast";
import { usePreviewSettingsManager } from "./hooks/usePreviewSettingsManager";
import { useAppHotkeys } from "./hooks/useAppHotkeys";
import { useAppModals } from "./hooks/useAppModals";
import { useGoogleFonts } from "./hooks/useGoogleFonts";
import { useFontsource } from "./hooks/useFontsource";

import { Sidebar } from "./components/layout/Sidebar";
import { HeaderToolbar } from "./components/layout/HeaderToolbar";
import { LocationBar } from "./components/layout/LocationBar";
import { VirtualFontList } from "./components/font-list/VirtualFontList";
import { GoogleFontFilterBar } from "./components/google-fonts/GoogleFontFilterBar";
import { FontsourceFilterBar } from "./components/fontsource/FontsourceFilterBar";
import { ContextMenu } from "./components/font-list/ContextMenu";
import { EmptyState } from "./components/common";
import { AppModalsContainer } from "./components/modals/AppModalsContainer";
import { AppOverlaysContainer } from "./components/modals/AppOverlaysContainer";
import { FontDetailMode } from "./components/font-card/types";
import { FontSortSettings, DEFAULT_SORT_SETTINGS } from "./types/sort";

export default function App() {
  const { t } = useTranslation();

  // 1. 토스트 알림 훅
  const { toastInfo, setToastInfo, showToast } = useAppToast();

  // 2. 환경 설정 상태 (단일 진실원천: appSettings)
  const [appSettings, setAppSettings] = useState<CustomAppSettings>(() =>
    settingsService.getInitialSettings()
  );

  // 3. 프리뷰 설정 매니저 훅 (로컬스토리지 즉시, DB 300ms 디바운스 동기화)
  const { previewSettings, setPreviewSettings } = usePreviewSettingsManager();

  // 뷰 모드, 디테일 모드, 그리드 열 및 정렬 설정 (appSettings 단일 진실원천으로부터 파생)
  const viewMode: "list" | "grid" = appSettings.defaultViewMode;
  const detailMode: FontDetailMode = appSettings.defaultFontDetailMode || "detailed";
  const gridColumns: number = appSettings.defaultGridColumns;
  const sortSettings: FontSortSettings = appSettings.fontSortSettings || DEFAULT_SORT_SETTINGS;

  // 4. 도메인 계층 커스텀 훅: 폰트 라이브러리 및 DB 동기화
  const library = useFontLibrary({
    defaultCategory: appSettings.defaultCategory,
    sortSettings,
    onToast: showToast,
  });
  const { core, setLibrary, folderLibrary, filterAndSort, syncEvents } = library;

  // 5. 인터랙션 계층 커스텀 훅: 선택 상태 및 키보드 단축키
  const selection = useFontSelection({
    filteredFonts: filterAndSort.filteredFonts,
    activeCategory: filterAndSort.activeCategory,
  });

  // 6. 비즈니스 액션 계층 커스텀 훅: 활성화/설치/제거/세트/폴더 조작
  const actions = useFontActions({
    core,
    setLibrary,
    folderLibrary,
    filterAndSort,
    syncEvents,
    selectedFontIds: selection.selectedFontIds,
    handleClearSelection: selection.handleClearSelection,
    showToast,
  });

  // 7. 모달 상태 관리 훅
  const modals = useAppModals({
    selectedFontIds: selection.selectedFontIds,
    filteredFonts: filterAndSort.filteredFonts,
    sets: setLibrary.sets,
    showToast,
  });

  const currentSetId = filterAndSort.activeCategory.startsWith("set:")
    ? Number(filterAndSort.activeCategory.replace("set:", ""))
    : null;

  // 8. 전역 단축키 및 사이드바 토글 훅
  const { isSidebarCollapsed, handleToggleSidebar } = useAppHotkeys({
    currentSetId,
    selectedFontIds: selection.selectedFontIds,
    filteredFonts: filterAndSort.filteredFonts,
    onRequestRemoveFromSet: modals.handleRequestRemoveFromSet,
  });

  const isGoogleFonts = filterAndSort.activeCategory === "google_fonts";
  const isFontsource = filterAndSort.activeCategory === "fontsource";

  // 9. Google Fonts 공급자 훅 (글로벌 검색어, 정렬 설정, 로컬 설치 폰트 실시간 연동)
  const googleFonts = useGoogleFonts({
    enabled: Boolean(appSettings.enableGoogleFonts),
    externalSearchQuery: isGoogleFonts ? filterAndSort.searchQuery : "",
    sortSettings,
    installedFonts: core.fonts,
  });

  // 10. Font Source (Fontsource) 공급자 훅
  const fontsource = useFontsource({
    enabled: Boolean(appSettings.enableFontsource),
    externalSearchQuery: isFontsource ? filterAndSort.searchQuery : "",
    sortSettings,
    installedFonts: core.fonts,
  });

  // 외부 폰트 제공자 비활성화 시 안전 카테고리 폴백
  useEffect(() => {
    if (isGoogleFonts && !appSettings.enableGoogleFonts) {
      filterAndSort.setActiveCategory(appSettings.defaultCategory || "all");
    }
  }, [isGoogleFonts, appSettings.enableGoogleFonts, appSettings.defaultCategory, filterAndSort]);

  useEffect(() => {
    if (isFontsource && !appSettings.enableFontsource) {
      filterAndSort.setActiveCategory(appSettings.defaultCategory || "all");
    }
  }, [isFontsource, appSettings.enableFontsource, appSettings.defaultCategory, filterAndSort]);

  // 선택된 구글 폰트 메타데이터 목록 (드래그/클릭 다중 선택과 실시간 동기화)
  const selectedGoogleFonts = useMemo(() => {
    if (!isGoogleFonts) return [];
    const set = selection.selectedFontIds;
    return googleFonts.filteredMetadataFonts.filter((f) => set.has(f.id));
  }, [isGoogleFonts, selection.selectedFontIds, googleFonts.filteredMetadataFonts]);

  // 선택된 Font Source 메타데이터 목록
  const selectedFontsourceFonts = useMemo(() => {
    if (!isFontsource) return [];
    const set = selection.selectedFontIds;
    return fontsource.filteredMetadataFonts.filter((f) => set.has(f.id));
  }, [isFontsource, selection.selectedFontIds, fontsource.filteredMetadataFonts]);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    font: FontMetadata;
  } | null>(null);

  // 9. 검색창 DOM 참조 및 즉시 검색 (Type-to-Search) 연동 훅
  const searchInputRef = useRef<HTMLInputElement>(null);
  useTypeToSearch({
    searchInputRef,
    isModalOpen: modals.isAnyModalOpen || contextMenu !== null,
    hasSelection: selection.selectedFontIds.size > 0,
    onClearSelection: selection.handleClearSelection,
  });

  // 10. 파인더/탐색기 폴더 드래그앤드롭 전체 화면 감지 훅
  const { isDraggingOver } = useFolderDrop({
    onDropPaths: actions.handleAddFoldersByPaths,
    enabled: !modals.isOnboardingOpen && !modals.isDiffModalOpen,
  });

  // DB 사용자 환경설정 및 프리뷰 설정 로드, 온보딩 상태 확인
  useEffect(() => {
    Promise.all([
      settingsService.loadSettings(),
      fontService.getSetting(DB_SETTINGS_KEYS.PREVIEW_SETTINGS),
    ])
      .then(([loaded, dbPreviewStr]) => {
        setAppSettings(loaded);
        if (loaded.language) {
          changeLanguage(loaded.language);
        }

        if (dbPreviewStr) {
          try {
            const parsed = JSON.parse(dbPreviewStr);
            setPreviewSettings((prev) => {
              const sanitized = sanitizePreviewSettings(parsed, prev);
              const isDefault = isDefaultPreviewText(sanitized.text);
              return {
                ...sanitized,
                text: isDefault && loaded.language
                  ? getDefaultPreviewText(loaded.language)
                  : sanitized.text,
              };
            });
          } catch (e) {
            console.warn("DB 프리뷰 설정 파싱 실패:", e);
          }
        }
      })
      .catch((e) => {
        console.warn("DB 설정 로드 오류:", e);
      });

    void settingsService.checkOnboardingStatus().then((completed) => {
      if (completed) {
        modals.setIsOnboardingOpen(false);
      }
    });
  }, []);

  // 폰트 카드 우클릭 핸들러
  const handleFontContextMenu = useCallback(
    (e: React.MouseEvent, font: FontMetadata) => {
      e.preventDefault();

      const isDisconnected =
        font.isMissing || font.install_status === "unplugged" || font.install_status === "deleted";

      if (
        selection.selectedFontIds.size > 0 &&
        isDisconnected &&
        !selection.selectedFontIds.has(font.id)
      ) {
        const firstSelectedFont =
          filterAndSort.filteredFonts.find((f) => selection.selectedFontIds.has(f.id)) || font;
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          font: firstSelectedFont,
        });
        return;
      }

      if (!selection.selectedFontIds.has(font.id)) {
        selection.setSelectedFontIds(new Set([font.id]));
        selection.setSelectedFont(font);
        selection.setLastSelectedId(font.id);
      }
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        font,
      });
    },
    [selection, filterAndSort.filteredFonts]
  );

  // 서재 아바타 칩 클릭 핸들러 (해당 세트/폴더로 이동)
  const handleSelectLibraryTag = useCallback(
    (tag: FontLibraryTag) => {
      if (tag.type === "set") {
        setLibrary.handleSelectSet(Number(tag.id));
      } else {
        filterAndSort.setActiveCategory(`folder:${tag.id}`);
      }
    },
    [setLibrary, filterAndSort]
  );

  const handleOpenFolder = useCallback(
    (path: string) => {
      fontService.showInFolder(path).catch((err) => {
        console.error("탐색기 열기 실패:", err);
        showToast(t("toast.folder_open_failed"));
      });
    },
    [showToast, t]
  );

  const activeScanningFolder = useMemo(() => {
    if (filterAndSort.activeCategory.startsWith("folder:")) {
      const folderPath = filterAndSort.activeCategory.replace("folder:", "");
      return folderLibrary.customFolders.find(
        (f) => normalizePath(f.path) === normalizePath(folderPath) && f.isScanning
      );
    }
    return null;
  }, [filterAndSort.activeCategory, folderLibrary.customFolders]);

  const activeMissingFolder = useMemo(() => {
    if (filterAndSort.activeCategory.startsWith("folder:")) {
      const folderPath = filterAndSort.activeCategory.replace("folder:", "");
      return folderLibrary.customFolders.find(
        (f) => f.isMissing && normalizePath(f.path) === normalizePath(folderPath)
      );
    }
    return null;
  }, [filterAndSort.activeCategory, folderLibrary.customFolders]);

  const handleSortSettingsChange = useCallback((newSortSettings: FontSortSettings) => {
    setAppSettings((prev) => {
      const next = { ...prev, fontSortSettings: newSortSettings };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  const handleViewModeChange = useCallback((mode: "list" | "grid") => {
    setAppSettings((prev) => {
      const next = { ...prev, defaultViewMode: mode };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  const handleGridColumnsChange = useCallback((cols: number) => {
    setAppSettings((prev) => {
      const next = { ...prev, defaultGridColumns: cols };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  const handleDetailModeChange = useCallback((mode: FontDetailMode) => {
    setAppSettings((prev) => {
      const next = { ...prev, defaultFontDetailMode: mode };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  const handleSaveSettings = async (newSettings: CustomAppSettings) => {
    try {
      await settingsService.saveSettings(newSettings);
      setAppSettings(newSettings);
      showToast(t("toast.settings_saved"));
    } catch (err) {
      console.error("환경 설정 저장 실패:", err);
      showToast(t("toast.settings_save_failed"));
    }
  };

  const handleOnboardingComplete = (savedSettings: CustomAppSettings) => {
    setAppSettings(savedSettings);
    if (savedSettings.language) {
      changeLanguage(savedSettings.language);
    }
    setPreviewSettings((prev) => ({
      ...prev,
      text: getDefaultPreviewText(savedSettings.language),
      fontSize: savedSettings.defaultFontSize,
      textColor: savedSettings.defaultTextColor,
      backgroundColor: savedSettings.defaultBackgroundColor,
      textAlign: savedSettings.defaultTextAlign,
      lineHeight: savedSettings.defaultLineHeight,
      letterSpacing: savedSettings.defaultLetterSpacing,
      isBold: Boolean(savedSettings.defaultIsBold),
      isItalic: Boolean(savedSettings.defaultIsItalic),
      isUnderline: Boolean(savedSettings.defaultIsUnderline),
    }));
    modals.setIsOnboardingOpen(false);
    showToast(t("toast.settings_saved"));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-theme-app text-theme-text select-none font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        appName={appConfig.app.name}
        appVersion={appConfig.app.version}
        activeCategory={filterAndSort.activeCategory}
        counts={filterAndSort.categoryCounts}
        customFolders={folderLibrary.customFolders}
        sets={setLibrary.sets}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isLoading={core.isLoading}
        onRefresh={() => void syncEvents.refreshList()}
        onOpenSettings={(tab) => {
          modals.setSettingsInitialTab(tab || "all");
          modals.setIsSettingsModalOpen(true);
        }}
        onSelectCategory={filterAndSort.setActiveCategory}
        onSelectFolder={actions.handleSelectFolder}
        onAddFolder={actions.handleAddFolder}
        onRemoveFolder={actions.handleRemoveFolder}
        onRelinkFolder={actions.handleRelinkFolder}
        onReorderFolders={(nextFolders) => {
          folderLibrary.setCustomFolders(nextFolders);
        }}
        onSelectSet={setLibrary.handleSelectSet}
        onCreateSet={actions.handleCreateSet}
        onDeleteSet={actions.handleDeleteSet}
        onReorderSets={(nextSets) => {
          setLibrary.setSets(nextSets);
        }}
        onUpdateSet={setLibrary.handleUpdateSet}
        onUpdateSetParent={setLibrary.handleUpdateSetParent}
        onUpdateSetColor={setLibrary.handleUpdateSetColor}
        onUpdateFolderColor={folderLibrary.handleUpdateFolderColor}
        googleFontsCount={googleFonts.totalCount}
        isGoogleFontsOnline={googleFonts.isOnline}
        isGoogleFontsLoading={googleFonts.isLoading}
        fontsourceCount={fontsource.totalCount}
        isFontsourceOnline={fontsource.isOnline}
        isFontsourceLoading={fontsource.isLoading}
        enableGoogleFonts={Boolean(appSettings.enableGoogleFonts)}
        enableFontsource={Boolean(appSettings.enableFontsource)}
      />

      {/* 2. Main Content Canvas */}
      <main className="flex-1 flex flex-col min-w-0 bg-theme-app">
        <HeaderToolbar
          searchInputRef={searchInputRef}
          searchQuery={filterAndSort.searchQuery}
          onSearchChange={filterAndSort.setSearchQuery}
          previewSettings={previewSettings}
          onFontSizeChange={(fontSize) => setPreviewSettings((prev) => ({ ...prev, fontSize }))}
          onBoldChange={(isBold) => setPreviewSettings((prev) => ({ ...prev, isBold }))}
          onItalicChange={(isItalic) => setPreviewSettings((prev) => ({ ...prev, isItalic }))}
          onUnderlineChange={(isUnderline) => setPreviewSettings((prev) => ({ ...prev, isUnderline }))}
          onTextAlignChange={(textAlign) => setPreviewSettings((prev) => ({ ...prev, textAlign }))}
          onTextColorChange={(textColor) => setPreviewSettings((prev) => ({ ...prev, textColor }))}
          onBackgroundColorChange={(backgroundColor) => setPreviewSettings((prev) => ({ ...prev, backgroundColor }))}
          minFontSize={appSettings.minFontSize}
          maxFontSize={appSettings.maxFontSize}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          gridColumns={gridColumns}
          onGridColumnsChange={handleGridColumnsChange}
          onOpenStyleModal={() => modals.setIsPreviewModalOpen(true)}
          isGoogleFontsActive={isGoogleFonts}
          selectedGoogleFonts={selectedGoogleFonts}
          isFontsourceActive={isFontsource}
          selectedFontsourceFonts={selectedFontsourceFonts}
        />

        <LocationBar
          activeCategory={filterAndSort.activeCategory}
          customFolders={folderLibrary.customFolders}
          sets={setLibrary.sets}
          fontsCount={
            isGoogleFonts
              ? googleFonts.filteredMetadataFonts.length
              : isFontsource
              ? fontsource.filteredMetadataFonts.length
              : filterAndSort.filteredFonts.length
          }
          selectedCount={selection.selectedFontIds.size}
          detailMode={detailMode}
          onDetailModeChange={handleDetailModeChange}
          sortSettings={sortSettings}
          onSortSettingsChange={handleSortSettingsChange}
          onOpenFolder={handleOpenFolder}
          onRelinkFolder={actions.handleRelinkFolder}
        />

        {/* 3. Google Fonts 전용 서브 필터 툴바 */}
        {isGoogleFonts && (
          <GoogleFontFilterBar
            selectedCategory={googleFonts.selectedCategory}
            onSelectCategory={googleFonts.setSelectedCategory}
            selectedSubset={googleFonts.selectedSubset}
            onSelectSubset={googleFonts.setSelectedSubset}
            onlyVariable={googleFonts.onlyVariable}
            onToggleVariable={() => googleFonts.setOnlyVariable((prev) => !prev)}
            onlyInstalled={googleFonts.onlyInstalled}
            onToggleInstalled={() => googleFonts.setOnlyInstalled((prev) => !prev)}
            filteredCount={googleFonts.filteredMetadataFonts.length}
            totalCount={googleFonts.totalCount}
          />
        )}

        {/* 4. Font Source 전용 서브 필터 툴바 */}
        {isFontsource && (
          <FontsourceFilterBar
            selectedCategory={fontsource.selectedCategory}
            onSelectCategory={fontsource.setSelectedCategory}
            selectedSubset={fontsource.selectedSubset}
            onSelectSubset={fontsource.setSelectedSubset}
            onlyVariable={fontsource.onlyVariable}
            onToggleVariable={() => fontsource.setOnlyVariable((prev) => !prev)}
            onlyInstalled={fontsource.onlyInstalled}
            onToggleInstalled={() => fontsource.setOnlyInstalled((prev) => !prev)}
            filteredCount={fontsource.filteredMetadataFonts.length}
            totalCount={fontsource.totalCount}
          />
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
          {isGoogleFonts ? (
            !googleFonts.isOnline ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <WifiOff className="w-10 h-10 text-amber-500 mb-3" />
                <h3 className="text-base font-semibold text-theme-text mb-1">
                  {t("sidebar.google_fonts_offline", "인터넷 연결이 필요합니다")}
                </h3>
                <p className="text-xs text-theme-text-muted max-w-sm mb-4">
                  네트워크가 연결되지 않았거나 외부 인터넷에 접속할 수 없습니다. 연결 상태를 확인해주세요.
                </p>
                <button
                  type="button"
                  onClick={googleFonts.reload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-accent text-white text-xs font-medium hover:bg-theme-accent/90 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>다시 시도</span>
                </button>
              </div>
            ) : googleFonts.error && googleFonts.fonts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
                <h3 className="text-base font-semibold text-theme-text mb-1">
                  Google Fonts를 불러올 수 없습니다
                </h3>
                <p className="text-xs text-theme-text-muted max-w-sm mb-4">
                  {googleFonts.error || "Google Fonts 카탈로그를 가져오는 중 오류가 발생했습니다."}
                </p>
                <button
                  type="button"
                  onClick={googleFonts.reload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-accent text-white text-xs font-medium hover:bg-theme-accent/90 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>다시 시도</span>
                </button>
              </div>
            ) : googleFonts.isLoading && googleFonts.fonts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-muted">
                <RefreshCw className="w-8 h-8 animate-spin text-theme-accent mb-3" />
                <p className="text-sm font-semibold text-theme-text mb-1">Google Fonts 카탈로그 로드 중...</p>
                <p className="text-xs text-theme-text-muted">1,900개 이상의 구글 폰트 메타데이터를 불러오고 있습니다.</p>
              </div>
            ) : googleFonts.filteredMetadataFonts.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={<Sliders className="w-6 h-6" />}
                  title={t("empty.no_fonts_title")}
                  description={t("empty.no_fonts_desc")}
                />
              </div>
            ) : (
              <VirtualFontList
                fonts={googleFonts.filteredMetadataFonts}
                previewSettings={previewSettings}
                viewMode={viewMode}
                detailMode={detailMode}
                gridColumns={gridColumns}
                selectedFontIds={selection.selectedFontIds}
                onSelectFont={selection.handleSelectFont}
                onSelectionChange={selection.handleSelectionChange}
              />
            )
          ) : isFontsource ? (
            !fontsource.isOnline ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <WifiOff className="w-10 h-10 text-amber-500 mb-3" />
                <h3 className="text-base font-semibold text-theme-text mb-1">
                  {t("sidebar.fontsource_offline", "인터넷 연결이 필요합니다")}
                </h3>
                <p className="text-xs text-theme-text-muted max-w-sm mb-4">
                  네트워크가 연결되지 않았거나 외부 인터넷에 접속할 수 없습니다. 연결 상태를 확인해주세요.
                </p>
                <button
                  type="button"
                  onClick={fontsource.reload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-accent text-white text-xs font-medium hover:bg-theme-accent/90 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>다시 시도</span>
                </button>
              </div>
            ) : fontsource.error && fontsource.fonts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
                <h3 className="text-base font-semibold text-theme-text mb-1">
                  Font Source를 불러올 수 없습니다
                </h3>
                <p className="text-xs text-theme-text-muted max-w-sm mb-4">
                  {fontsource.error || "Font Source 카탈로그를 가져오는 중 오류가 발생했습니다."}
                </p>
                <button
                  type="button"
                  onClick={fontsource.reload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-accent text-white text-xs font-medium hover:bg-theme-accent/90 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>다시 시도</span>
                </button>
              </div>
            ) : fontsource.isLoading && fontsource.fonts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-muted">
                <RefreshCw className="w-8 h-8 animate-spin text-theme-accent mb-3" />
                <p className="text-sm font-semibold text-theme-text mb-1">Font Source 카탈로그 로드 중...</p>
                <p className="text-xs text-theme-text-muted">2,100개 이상의 오픈소스 폰트 메타데이터를 불러오고 있습니다.</p>
              </div>
            ) : fontsource.filteredMetadataFonts.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={<Sliders className="w-6 h-6" />}
                  title={t("empty.no_fonts_title")}
                  description={t("empty.no_fonts_desc")}
                />
              </div>
            ) : (
              <VirtualFontList
                fonts={fontsource.filteredMetadataFonts}
                previewSettings={previewSettings}
                viewMode={viewMode}
                detailMode={detailMode}
                gridColumns={gridColumns}
                selectedFontIds={selection.selectedFontIds}
                onSelectFont={selection.handleSelectFont}
                onSelectionChange={selection.handleSelectionChange}
              />
            )
          ) : activeScanningFolder ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-muted p-6">
              <RefreshCw className="w-8 h-8 animate-spin text-theme-accent mb-3" />
              <p className="text-sm font-semibold text-theme-text mb-1">
                {t("empty.folder_scanning_title", {
                  name: activeScanningFolder.name,
                })}
              </p>
              <p className="text-xs text-theme-text-muted max-w-sm">
                {activeScanningFolder.scanProgress && activeScanningFolder.scanProgress.total > 0
                  ? `${activeScanningFolder.scanProgress.current} / ${activeScanningFolder.scanProgress.total} (${Math.round((activeScanningFolder.scanProgress.current / activeScanningFolder.scanProgress.total) * 100)}%)`
                  : t("empty.folder_scanning_desc")}
              </p>
            </div>
          ) : activeMissingFolder ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
                title={t("folder.missing_title")}
                description={t("folder.missing_desc")}
                action={
                  <button
                    type="button"
                    onClick={() => actions.handleRelinkFolder(activeMissingFolder.path)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium text-xs shadow-xs cursor-pointer"
                  >
                    <FolderSync className="w-4 h-4" />
                    <span>{t("folder.relink")}</span>
                  </button>
                }
              />
            </div>
          ) : core.isLoading && core.fonts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin text-theme-accent mb-2" />
              <p className="text-xs">{t("empty.scanning")}</p>
            </div>
          ) : filterAndSort.filteredFonts.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={<Sliders className="w-6 h-6" />}
                title={t("empty.no_fonts_title")}
                description={t("empty.no_fonts_desc")}
              />
            </div>
          ) : (
            <VirtualFontList
              fonts={filterAndSort.filteredFonts}
              sections={filterAndSort.fontSections}
              previewSettings={previewSettings}
              viewMode={viewMode}
              detailMode={detailMode}
              gridColumns={gridColumns}
              selectedFontIds={selection.selectedFontIds}
              favoriteIds={core.favoriteIds}
              activatedFontIds={core.activatedFontIds}
              onSelectFont={selection.handleSelectFont}
              onSelectionChange={selection.handleSelectionChange}
              onToggleFavorite={actions.handleToggleFavorite}
              onToggleActivate={actions.handleToggleActivate}
              onContextMenu={handleFontContextMenu}
              onSelectLibrary={handleSelectLibraryTag}
            />
          )}
        </div>
      </main>

      {/* 3. Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          fonts={
            selection.selectedFontIds.has(contextMenu.font.id)
              ? filterAndSort.filteredFonts.filter((f) => selection.selectedFontIds.has(f.id))
              : [contextMenu.font]
          }
          sets={setLibrary.sets}
          favoriteIds={core.favoriteIds}
          activatedFontIds={core.activatedFontIds}
          currentSetId={currentSetId}
          setMap={setLibrary.setMap}
          onClose={() => setContextMenu(null)}
          onToggleFavorite={actions.handleToggleFavorite}
          onToggleActivate={actions.handleToggleActivate}
          onBulkActivate={actions.handleBulkActivate}
          onAddToSet={actions.handleAddToSet}
          onRemoveFromSet={actions.handleRemoveFromSet}
          onBulkFavorite={actions.handleBulkFavorite}
          onBulkAddToSet={actions.handleBulkAddToSet}
          onBulkRemoveFromSet={actions.handleBulkRemoveFromSet}
          onRequestUninstall={modals.handleRequestUninstall}
          onRequestDeactivate={modals.handleRequestDeactivate}
          onRequestRemoveFromSet={modals.handleRequestRemoveFromSet}
          onRefreshList={() => void syncEvents.refreshList()}
          onActionFeedback={showToast}
          onClearSelection={selection.handleClearSelection}
          onOpenDiff={modals.handleOpenDiffModal}
          onOpenFontInfo={modals.handleOpenFontInfo}
        />
      )}

      {/* 4. Modals Container */}
      <AppModalsContainer
        modals={modals}
        previewSettings={previewSettings}
        setPreviewSettings={setPreviewSettings}
        appSettings={appSettings}
        handleSaveSettings={handleSaveSettings}
        handleOnboardingComplete={handleOnboardingComplete}
        actions={actions}
        allFonts={core.fonts}
        scanProgress={core.scanProgress}
        showToast={showToast}
      />

      {/* 5. Overlays and Toast Container */}
      <AppOverlaysContainer
        isLoading={core.isLoading}
        hasNoFonts={core.fonts.length === 0}
        isOnboardingOpen={modals.isOnboardingOpen}
        isDiffModalOpen={modals.isDiffModalOpen}
        scanProgress={core.scanProgress}
        isDraggingOver={isDraggingOver}
        toastInfo={toastInfo}
        onCloseToast={() => setToastInfo(null)}
      />
    </div>
  );
}
