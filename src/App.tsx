import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Sliders, AlertTriangle, FolderSync } from "lucide-react";
import { normalizePath } from "./utils/pathUtils";
import { FontMetadata, PreviewSettings, FontLibraryTag } from "./types/font";
import { fontService } from "./services/fontService";
import { settingsService, CustomAppSettings } from "./services/settingsService";
import {
  appConfig,
  defaultPreviewSettings,
  getDefaultPreviewText,
  isDefaultPreviewText,
} from "./config/appConfig";
import { changeLanguage } from "./i18n";

import { useFontLibrary } from "./hooks/useFontLibrary";
import { useFontSelection } from "./hooks/useFontSelection";
import { useFontActions } from "./hooks/useFontActions";
import { useTypeToSearch } from "./hooks/useTypeToSearch";
import { useFolderDrop } from "./hooks/useFolderDrop";

import { Sidebar } from "./components/layout/Sidebar";
import { HeaderToolbar } from "./components/layout/HeaderToolbar";
import { LocationBar } from "./components/layout/LocationBar";
import { VirtualFontList } from "./components/VirtualFontList";
import { ContextMenu } from "./components/ContextMenu";
import { PreviewTextModal } from "./components/PreviewTextModal";
import { SettingsModal, SettingsTab } from "./components/SettingsModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { FolderDropOverlay } from "./components/FolderDropOverlay";
import { GlyphDiffModal } from "./components/diff/GlyphDiffModal";
import { FontInfoModal } from "./components/font-info/FontInfoModal";
import { ConfirmModal } from "./components/ConfirmModal";
import { EmptyState, ProgressBar, Toast, ToastVariant } from "./components/common";
import { FontDetailMode } from "./components/font-card/types";
import { FontSortSettings, DEFAULT_SORT_SETTINGS } from "./types/sort";

export default function App() {
  const { t } = useTranslation();

  // 1. 환경 설정 및 프리뷰 설정 상태
  const [appSettings, setAppSettings] = useState<CustomAppSettings>(() =>
    settingsService.getInitialSettings()
  );
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>("all");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() =>
    !settingsService.hasCompletedOnboarding()
  );
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffModalFonts, setDiffModalFonts] = useState<FontMetadata[]>([]);

  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>(() => {
    try {
      const initialApp = settingsService.getInitialSettings();
      const saved = localStorage.getItem("fontfinder_preview_settings");
      const base: PreviewSettings = {
        ...defaultPreviewSettings,
        text: initialApp.defaultPreviewText,
        fontSize: initialApp.defaultFontSize,
        textAlign: initialApp.defaultTextAlign || "left",
        lineHeight: initialApp.defaultLineHeight || 1.45,
        letterSpacing: initialApp.defaultLetterSpacing ?? 0,
        textColor: initialApp.defaultTextColor,
        backgroundColor: initialApp.defaultBackgroundColor,
        isBold: Boolean(initialApp.defaultIsBold),
        isItalic: Boolean(initialApp.defaultIsItalic),
        isUnderline: Boolean(initialApp.defaultIsUnderline),
      };
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...base,
          ...parsed,
          fontSize: typeof parsed.fontSize === "number" ? parsed.fontSize : initialApp.defaultFontSize,
        };
      }
      return base;
    } catch {
      return defaultPreviewSettings;
    }
  });

  // 뷰 모드, 디테일 모드, 그리드 열 및 정렬 설정 상태
  const [viewMode, setViewMode] = useState<"list" | "grid">(appSettings.defaultViewMode);
  const [detailMode, setDetailMode] = useState<FontDetailMode>(appSettings.defaultFontDetailMode || "detailed");
  const [gridColumns, setGridColumns] = useState<number>(appSettings.defaultGridColumns);
  const [sortSettings, setSortSettings] = useState<FontSortSettings>(
    () => appSettings.fontSortSettings || DEFAULT_SORT_SETTINGS
  );

  // 사이드바 접기/펼치기 상태
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("fontfinder_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("fontfinder_sidebar_collapsed", String(next));
      } catch (err) {
        console.error("사이드바 상태 저장 실패:", err);
      }
      return next;
    });
  }, []);

  // 컨텍스트 메뉴 및 토스트 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    font: FontMetadata;
  } | null>(null);
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    variant?: ToastVariant;
  } | null>(null);

  // 확인 모달 상태 (시스템 글꼴 제거 / 서재 세트에서 제거 / 임시 활성화 해제)
  const [uninstallConfirmFonts, setUninstallConfirmFonts] = useState<FontMetadata[] | null>(null);
  const [deactivateConfirmFonts, setDeactivateConfirmFonts] = useState<FontMetadata[] | null>(null);
  const [removeFromSetConfirm, setRemoveFromSetConfirm] = useState<{
    setId: number;
    setName: string;
    fonts: FontMetadata[];
  } | null>(null);

  // 폰트 정보 보기 모달 상태
  const [fontInfoState, setFontInfoState] = useState<{
    isOpen: boolean;
    fonts: FontMetadata[];
    initialFont?: FontMetadata | null;
  }>({
    isOpen: false,
    fonts: [],
  });

  const handleOpenFontInfo = useCallback((fonts: FontMetadata[]) => {
    if (!fonts || fonts.length === 0) return;
    setFontInfoState({
      isOpen: true,
      fonts,
      initialFont: fonts[0],
    });
  }, []);

  const showToast = useCallback(
    (msg: string | { message: string; variant?: ToastVariant }) => {
      if (typeof msg === "string") {
        const isError = /실패|오류|failed|error/i.test(msg);
        setToastInfo({ message: msg, variant: isError ? "error" : "success" });
      } else {
        setToastInfo(msg);
      }
    },
    []
  );

  // 2. 도메인 계층 커스텀 훅: 폰트 라이브러리 및 DB 동기화
  const library = useFontLibrary({
    defaultCategory: appSettings.defaultCategory,
    sortSettings,
    onToast: showToast,
  });

  // 3. 인터랙션 계층 커스텀 훅: 선택 상태 및 키보드 단축키
  const selection = useFontSelection({
    filteredFonts: library.filteredFonts,
    activeCategory: library.activeCategory,
  });

  // 4. 비즈니스 액션 계층 커스텀 훅: 활성화/설치/제거/세트/폴더 조작
  const actions = useFontActions({
    fonts: library.fonts,
    setFonts: library.setFonts,
    filteredFonts: library.filteredFonts,
    selectedFontIds: selection.selectedFontIds,
    favoriteIds: library.favoriteIds,
    setFavoriteIds: library.setFavoriteIds,
    activatedFontIds: library.activatedFontIds,
    setActivatedFontIds: library.setActivatedFontIds,
    sets: library.sets,
    setSets: library.setSets,
    customFolders: library.customFolders,
    setCustomFolders: library.setCustomFolders,
    customFoldersRef: library.customFoldersRef,
    activeCategory: library.activeCategory,
    setActiveCategory: library.setActiveCategory,
    setIsLoading: library.setIsLoading,
    loadSystemFonts: library.loadSystemFonts,
    loadDbState: library.loadDbState,
    refreshSets: library.refreshSets,
    refreshList: library.refreshList,
    handleClearSelection: selection.handleClearSelection,
    showToast,
  });

  // 전문가용 글리프 Diff 모달 오픈 핸들러
  const handleOpenDiffModal = useCallback(
    (fontsToDiff?: FontMetadata[]) => {
      let targetFonts = fontsToDiff;

      if (!targetFonts || targetFonts.length === 0) {
        if (selection.selectedFontIds.size > 0) {
          targetFonts = library.filteredFonts.filter((f) =>
            selection.selectedFontIds.has(f.id)
          );
        } else {
          targetFonts = [];
        }
      }

      if (targetFonts.length > 5) {
        showToast(
          t("diff.top5_sliced_notice")
        );
        setDiffModalFonts(targetFonts.slice(0, 5));
      } else {
        setDiffModalFonts(targetFonts);
      }
      setIsDiffModalOpen(true);
    },
    [selection.selectedFontIds, library.filteredFonts, showToast, t]
  );

  // 5. 검색창 DOM 참조 및 즉시 검색 (Type-to-Search) 연동 훅
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isAnyModalOpen =
    isSettingsModalOpen ||
    isPreviewModalOpen ||
    isOnboardingOpen ||
    isDiffModalOpen ||
    contextMenu !== null;

  useTypeToSearch({
    searchInputRef,
    isModalOpen: isAnyModalOpen,
    hasSelection: selection.selectedFontIds.size > 0,
    onClearSelection: selection.handleClearSelection,
  });

  // 6. 파인더/탐색기 폴더 드래그앤드롭 전체 화면 감지 훅
  const { isDraggingOver } = useFolderDrop({
    onDropPaths: actions.handleAddFoldersByPaths,
    enabled: !isOnboardingOpen && !isDiffModalOpen,
  });

  // 프리뷰 설정 동기화 (로컬스토리지 즉시, DB 300ms 디바운스 저장)
  useEffect(() => {
    try {
      localStorage.setItem("fontfinder_preview_settings", JSON.stringify(previewSettings));
    } catch (e) {
      console.error("previewSettings 로컬 저장 실패:", e);
    }

    const timer = setTimeout(() => {
      void fontService.setSetting("preview_settings", JSON.stringify(previewSettings));
    }, 300);

    return () => clearTimeout(timer);
  }, [previewSettings]);

  // DB 사용자 환경설정 및 프리뷰 설정 로드, 온보딩 상태 확인
  useEffect(() => {
    Promise.all([
      settingsService.loadSettings(),
      fontService.getSetting("preview_settings"),
    ])
      .then(([loaded, dbPreviewStr]) => {
        setAppSettings(loaded);
        if (loaded.language) {
          changeLanguage(loaded.language);
        }
        if (loaded.fontSortSettings) {
          setSortSettings(loaded.fontSortSettings);
        }
        if (loaded.defaultViewMode) {
          setViewMode(loaded.defaultViewMode);
        }
        if (loaded.defaultGridColumns) {
          setGridColumns(loaded.defaultGridColumns);
        }
        if (loaded.defaultFontDetailMode) {
          setDetailMode(loaded.defaultFontDetailMode);
        }

        // DB에 저장된 preview_settings 파싱하여 상태 복원
        let dbPreview: Partial<PreviewSettings> | null = null;
        if (dbPreviewStr) {
          try {
            dbPreview = JSON.parse(dbPreviewStr);
          } catch (e) {
            console.warn("DB 프리뷰 설정 파싱 실패:", e);
          }
        }

        if (dbPreview) {
          setPreviewSettings((prev) => {
            const merged = { ...prev, ...dbPreview };
            const isDefault = isDefaultPreviewText(merged.text);
            return {
              ...merged,
              text: isDefault && loaded.language
                ? getDefaultPreviewText(loaded.language)
                : merged.text,
            };
          });
        }
      })
      .catch((e) => {
        console.warn("DB 설정 로드 오류:", e);
      });

    void settingsService.checkOnboardingStatus().then((completed) => {
      if (completed) {
        setIsOnboardingOpen(false);
      }
    });
  }, []);

  // 전역 브라우저 기본 우클릭 차단
  useEffect(() => {
    const handleContextMenuGlobal = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", handleContextMenuGlobal);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenuGlobal);
    };
  }, []);

  // 폰트 카드 우클릭 핸들러
  const handleFontContextMenu = useCallback(
    (e: React.MouseEvent, font: FontMetadata) => {
      e.preventDefault();

      const isDisconnected =
        font.isMissing || font.install_status === "unplugged" || font.install_status === "deleted";

      // 기존 선택된 폰트들이 있는 상태에서, 선택되지 않은 비활성화(언플러그드/삭제됨) 폰트를 우클릭한 경우:
      // 기존 선택 목록을 해제하지 않고 안전하게 유지하며, 기존 선택 폰트들을 대상으로 컨텍스트 메뉴를 엽니다.
      if (
        selection.selectedFontIds.size > 0 &&
        isDisconnected &&
        !selection.selectedFontIds.has(font.id)
      ) {
        const firstSelectedFont =
          library.filteredFonts.find((f) => selection.selectedFontIds.has(f.id)) || font;
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
    [selection, library.filteredFonts]
  );

  // 서재 아바타 칩 클릭 핸들러 (해당 세트/폴더로 이동)
  const handleSelectLibraryTag = useCallback(
    (tag: FontLibraryTag) => {
      if (tag.type === "set") {
        library.handleSelectSet(Number(tag.id));
      } else {
        library.setActiveCategory(`folder:${tag.id}`);
      }
    },
    [library]
  );

  const currentSetId = library.activeCategory.startsWith("set:")
    ? Number(library.activeCategory.replace("set:", ""))
    : null;




  // 시스템 글꼴 제거 요청 (확인 모달 표시)
  const handleRequestUninstall = useCallback((fontsToUninstall: FontMetadata[]) => {
    const userFonts = fontsToUninstall.filter((f) => f.source === "user");
    if (userFonts.length === 0) return;
    setUninstallConfirmFonts(userFonts);
  }, []);

  // 임시 활성화 해제 요청 (확인 모달 표시)
  const handleRequestDeactivate = useCallback((fontsToDeactivate: FontMetadata[]) => {
    if (fontsToDeactivate.length === 0) return;
    setDeactivateConfirmFonts(fontsToDeactivate);
  }, []);

  // 서재 세트에서 폰트 제거 요청 (확인 모달 표시)
  const handleRequestRemoveFromSet = useCallback(
    (setId: number, targetFonts: FontMetadata[]) => {
      if (targetFonts.length === 0) return;
      const currentSet = library.sets.find((s) => s.id === setId);
      setRemoveFromSetConfirm({
        setId,
        setName: currentSet?.name || "",
        fonts: targetFonts,
      });
    },
    [library.sets]
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
    if (library.activeCategory.startsWith("folder:")) {
      const folderPath = library.activeCategory.replace("folder:", "");
      return library.customFolders.find(
        (f) => normalizePath(f.path) === normalizePath(folderPath) && f.isScanning
      );
    }
    return null;
  }, [library.activeCategory, library.customFolders]);

  const activeMissingFolder = useMemo(() => {
    if (library.activeCategory.startsWith("folder:")) {
      const folderPath = library.activeCategory.replace("folder:", "");
      return library.customFolders.find(
        (f) => f.isMissing && normalizePath(f.path) === normalizePath(folderPath)
      );
    }
    return null;
  }, [library.activeCategory, library.customFolders]);

  // 서재 세트 화면에서 Delete / Backspace 키 단축키로 서재에서 선택 폰트 제거 (확인 모달 트리거)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      // 단축키: Ctrl+B / Cmd+B 로 좌측 메뉴 접기/펼치기
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleSidebar();
        return;
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        currentSetId !== null &&
        selection.selectedFontIds.size > 0
      ) {
        e.preventDefault();
        const selectedFonts = library.filteredFonts.filter((f) =>
          selection.selectedFontIds.has(f.id)
        );
        if (selectedFonts.length > 0) {
          handleRequestRemoveFromSet(currentSetId, selectedFonts);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentSetId, selection.selectedFontIds, library.filteredFonts, handleRequestRemoveFromSet, handleToggleSidebar]);

  // 정렬 설정 빠른 변경 핸들러 (LocationBar 정렬 토글)
  const handleSortSettingsChange = useCallback((newSortSettings: FontSortSettings) => {
    setSortSettings(newSortSettings);
    setAppSettings((prev) => {
      const next = { ...prev, fontSortSettings: newSortSettings };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  // 뷰 모드(리스트/그리드) 변경 핸들러 (환경설정 DB 동기화)
  const handleViewModeChange = useCallback((mode: "list" | "grid") => {
    setViewMode(mode);
    setAppSettings((prev) => {
      const next = { ...prev, defaultViewMode: mode };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  // 그리드 기본 열 수 변경 핸들러 (환경설정 DB 동기화)
  const handleGridColumnsChange = useCallback((cols: number) => {
    setGridColumns(cols);
    setAppSettings((prev) => {
      const next = { ...prev, defaultGridColumns: cols };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  // 카드 상세 수준 변경 핸들러 (환경설정 DB 동기화)
  const handleDetailModeChange = useCallback((mode: FontDetailMode) => {
    setDetailMode(mode);
    setAppSettings((prev) => {
      const next = { ...prev, defaultFontDetailMode: mode };
      void settingsService.saveSettings(next);
      return next;
    });
  }, []);

  // 환경 설정 저장 핸들러
  const handleSaveSettings = async (newSettings: CustomAppSettings) => {
    try {
      await settingsService.saveSettings(newSettings);
      setAppSettings(newSettings);
      if (newSettings.fontSortSettings) {
        setSortSettings(newSettings.fontSortSettings);
      }
      if (newSettings.defaultViewMode) {
        setViewMode(newSettings.defaultViewMode);
      }
      if (newSettings.defaultGridColumns) {
        setGridColumns(newSettings.defaultGridColumns);
      }
      if (newSettings.defaultFontDetailMode) {
        setDetailMode(newSettings.defaultFontDetailMode);
      }
      showToast(t("toast.settings_saved"));
    } catch (err) {
      console.error("환경 설정 저장 실패:", err);
      showToast(t("toast.settings_save_failed"));
    }
  };

  // 온보딩 완료 핸들러
  const handleOnboardingComplete = (savedSettings: CustomAppSettings) => {
    setAppSettings(savedSettings);
    if (savedSettings.language) {
      changeLanguage(savedSettings.language);
    }
    if (savedSettings.defaultFontDetailMode) {
      setDetailMode(savedSettings.defaultFontDetailMode);
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
    setIsOnboardingOpen(false);
    showToast(t("toast.settings_saved"));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-theme-app text-theme-text select-none font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        appName={appConfig.app.name}
        appVersion={appConfig.app.version}
        activeCategory={library.activeCategory}
        counts={library.categoryCounts}
        customFolders={library.customFolders}
        sets={library.sets}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isLoading={library.isLoading}
        onRefresh={() => void library.refreshList()}
        onOpenSettings={(tab) => {
          setSettingsInitialTab(tab || "all");
          setIsSettingsModalOpen(true);
        }}
        onSelectCategory={library.setActiveCategory}
        onSelectFolder={actions.handleSelectFolder}
        onAddFolder={actions.handleAddFolder}
        onRemoveFolder={actions.handleRemoveFolder}
        onRelinkFolder={actions.handleRelinkFolder}
        onReorderFolders={(nextFolders) => {
          library.setCustomFolders(nextFolders);
          void fontService.setSetting("folder_order", JSON.stringify(nextFolders.map((f) => f.path)));
        }}
        onSelectSet={library.handleSelectSet}
        onCreateSet={actions.handleCreateSet}
        onDeleteSet={actions.handleDeleteSet}
        onReorderSets={(nextSets) => {
          library.setSets(nextSets);
          void fontService.setSetting("set_order", JSON.stringify(nextSets.map((s) => s.id)));
        }}
        onUpdateSet={library.handleUpdateSet}
        onUpdateSetParent={library.handleUpdateSetParent}
        onUpdateSetColor={library.handleUpdateSetColor}
        onUpdateFolderColor={library.handleUpdateFolderColor}
      />

      {/* 2. Main Content Canvas */}
      <main className="flex-1 flex flex-col min-w-0 bg-theme-app">
        <HeaderToolbar
          searchInputRef={searchInputRef}
          searchQuery={library.searchQuery}
          onSearchChange={library.setSearchQuery}
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
          onOpenStyleModal={() => setIsPreviewModalOpen(true)}
        />

        <LocationBar
          activeCategory={library.activeCategory}
          customFolders={library.customFolders}
          sets={library.sets}
          fontsCount={library.filteredFonts.length}
          selectedCount={selection.selectedFontIds.size}
          detailMode={detailMode}
          onDetailModeChange={handleDetailModeChange}
          sortSettings={sortSettings}
          onSortSettingsChange={handleSortSettingsChange}
          onOpenFolder={handleOpenFolder}
          onRelinkFolder={actions.handleRelinkFolder}
        />

        <div className="flex-1 min-w-0 overflow-hidden">
          {activeScanningFolder ? (
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
          ) : library.isLoading && library.fonts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin text-theme-accent mb-2" />
              <p className="text-xs">{t("empty.scanning")}</p>
            </div>
          ) : library.filteredFonts.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={<Sliders className="w-6 h-6" />}
                title={t("empty.no_fonts_title")}
                description={t("empty.no_fonts_desc")}
              />
            </div>
          ) : (
            <VirtualFontList
              fonts={library.filteredFonts}
              previewSettings={previewSettings}
              viewMode={viewMode}
              detailMode={detailMode}
              gridColumns={gridColumns}
              selectedFontIds={selection.selectedFontIds}
              favoriteIds={library.favoriteIds}
              activatedFontIds={library.activatedFontIds}
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
              ? library.filteredFonts.filter((f) => selection.selectedFontIds.has(f.id))
              : [contextMenu.font]
          }
          sets={library.sets}
          favoriteIds={library.favoriteIds}
          activatedFontIds={library.activatedFontIds}
          currentSetId={currentSetId}
          setMap={library.setMap}
          onClose={() => setContextMenu(null)}
          onToggleFavorite={actions.handleToggleFavorite}
          onToggleActivate={actions.handleToggleActivate}
          onBulkActivate={actions.handleBulkActivate}
          onAddToSet={actions.handleAddToSet}
          onRemoveFromSet={actions.handleRemoveFromSet}
          onBulkFavorite={actions.handleBulkFavorite}
          onBulkAddToSet={actions.handleBulkAddToSet}
          onBulkRemoveFromSet={actions.handleBulkRemoveFromSet}
          onRequestUninstall={handleRequestUninstall}
          onRequestDeactivate={handleRequestDeactivate}
          onRequestRemoveFromSet={handleRequestRemoveFromSet}
          onRefreshList={() => void library.refreshList()}
          onActionFeedback={showToast}
          onClearSelection={selection.handleClearSelection}
          onOpenDiff={handleOpenDiffModal}
          onOpenFontInfo={handleOpenFontInfo}
        />
      )}

      {/* 5. Modals */}
      {/* 5-1. 시스템 글꼴 영구 제거 확인 모달 */}
      {uninstallConfirmFonts && uninstallConfirmFonts.length > 0 && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setUninstallConfirmFonts(null)}
          onConfirm={async () => {
            const fontsToDelete = [...uninstallConfirmFonts];
            setUninstallConfirmFonts(null);
            await actions.handleBulkUninstall(fontsToDelete);
          }}
          title={
            uninstallConfirmFonts.length === 1
              ? t("confirm.uninstall_font_title")
              : t("confirm.bulk_uninstall_title")
          }
          itemName={
            uninstallConfirmFonts.length === 1
              ? (uninstallConfirmFonts[0].full_name || uninstallConfirmFonts[0].family_name)
              : t("confirm.bulk_uninstall_item", {
                count: uninstallConfirmFonts.length,
              })
          }
          description={
            <div className="space-y-3">
              <p>
                {uninstallConfirmFonts.length === 1
                  ? t("confirm.uninstall_font_desc")
                  : t("confirm.bulk_uninstall_desc", {
                    count: uninstallConfirmFonts.length,
                  })}
              </p>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-xs leading-relaxed text-left flex items-start gap-2">
                <span className="text-sm shrink-0">🗑️</span>
                <span>{t("confirm.uninstall_warning")}</span>
              </div>
            </div>
          }
          confirmText={t("confirm.uninstall_btn")}
          cancelText={t("common.cancel")}
          isDanger={true}
        />
      )}

      {/* 5-2. 서재 세트에서 글꼴 제거 확인 모달 */}
      {removeFromSetConfirm && removeFromSetConfirm.fonts.length > 0 && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setRemoveFromSetConfirm(null)}
          onConfirm={async () => {
            const { setId, fonts } = removeFromSetConfirm;
            setRemoveFromSetConfirm(null);
            if (fonts.length === 1) {
              await actions.handleRemoveFromSet(setId, fonts[0].id);
            } else {
              await actions.handleBulkRemoveFromSet(setId, fonts.map((f) => f.id));
            }
          }}
          title={
            removeFromSetConfirm.fonts.length === 1
              ? t("confirm.remove_from_set_title")
              : t("confirm.bulk_remove_from_set_title")
          }
          itemName={
            removeFromSetConfirm.fonts.length === 1
              ? (removeFromSetConfirm.fonts[0].full_name || removeFromSetConfirm.fonts[0].family_name)
              : t("confirm.bulk_remove_from_set_item", {
                count: removeFromSetConfirm.fonts.length,
              })
          }
          description={
            <div className="space-y-1.5 text-center">
              <p>
                {removeFromSetConfirm.fonts.length === 1
                  ? t("confirm.remove_from_set_desc", {
                    setName: removeFromSetConfirm.setName,
                  })
                  : t("confirm.bulk_remove_from_set_desc", {
                    setName: removeFromSetConfirm.setName,
                    count: removeFromSetConfirm.fonts.length,
                  })}
              </p>
              <p className="text-[11px] text-theme-text-muted">
                {t("confirm.remove_from_set_notice")}
              </p>
            </div>
          }
          confirmText={t("confirm.remove_btn")}
          cancelText={t("common.cancel")}
          isDanger={true}
        />
      )}

      {/* 5-3. 임시 활성화 해제 확인 모달 */}
      {deactivateConfirmFonts && deactivateConfirmFonts.length > 0 && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeactivateConfirmFonts(null)}
          onConfirm={async () => {
            const fontsToDeact = [...deactivateConfirmFonts];
            setDeactivateConfirmFonts(null);
            if (fontsToDeact.length === 1) {
              await actions.handleToggleActivate(fontsToDeact[0]);
            } else {
              await actions.handleBulkActivate(
                fontsToDeact.map((f) => f.id),
                false
              );
            }
          }}
          title={
            deactivateConfirmFonts.length === 1
              ? t("confirm.deactivate_font_title")
              : t("confirm.bulk_deactivate_title")
          }
          itemName={
            deactivateConfirmFonts.length === 1
              ? (deactivateConfirmFonts[0].full_name || deactivateConfirmFonts[0].family_name)
              : t("confirm.bulk_deactivate_item", {
                  count: deactivateConfirmFonts.length,
                })
          }
          description={
            <div className="space-y-3">
              <p>
                {deactivateConfirmFonts.length === 1
                  ? t("confirm.deactivate_font_desc")
                  : t("confirm.bulk_deactivate_desc", {
                      count: deactivateConfirmFonts.length,
                    })}
              </p>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-xs leading-relaxed text-left flex items-start gap-2">
                <span className="text-sm shrink-0">⚠️</span>
                <span>
                  {t(
                    "confirm.deactivate_warning"
                  )}
                </span>
              </div>
            </div>
          }
          confirmText={t("confirm.deactivate_btn")}
          cancelText={t("common.cancel")}
          isDanger={true}
        />
      )}

      <GlyphDiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        initialFonts={diffModalFonts}
        allFonts={library.fonts}
        fallbackText={
          previewSettings.text?.trim() ||
          appSettings.defaultPreviewText?.trim() ||
          "R g h e"
        }
      />

      <FontInfoModal
        isOpen={fontInfoState.isOpen}
        fonts={fontInfoState.fonts}
        initialFont={fontInfoState.initialFont}
        initialPreviewText={
          previewSettings.text?.trim() ||
          appSettings.defaultPreviewText?.trim() ||
          undefined
        }
        onClose={() => setFontInfoState((prev) => ({ ...prev, isOpen: false }))}
      />

      <PreviewTextModal
        isOpen={isPreviewModalOpen}
        settings={previewSettings}
        minFontSize={appSettings.minFontSize}
        maxFontSize={appSettings.maxFontSize}
        defaultText={appSettings.defaultPreviewText}
        onClose={() => setIsPreviewModalOpen(false)}
        onApply={(newSettings) => setPreviewSettings(newSettings)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        settings={appSettings}
        initialTab={settingsInitialTab}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
        onNotify={showToast}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialSettings={appSettings}
        onComplete={handleOnboardingComplete}
        scanProgress={library.scanProgress}
      />

      {/* 전체 화면 스캔 진행률 블러 오버레이 (초기 로딩 시 다른 메뉴 접근 완전 차단) */}
      {library.isLoading && library.fonts.length === 0 && !isOnboardingOpen && (
        <div className="fixed inset-0 z-40 bg-theme-bg/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
          <div className="max-w-md w-full p-8 rounded-3xl bg-theme-card/90 border border-theme-border/80 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-center relative overflow-hidden">
            {/* 배경 은은한 액센트 글로우 */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-theme-accent/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-theme-accent/10 rounded-full blur-2xl pointer-events-none" />

            {/* 회전 아이콘 */}
            <div className="w-14 h-14 rounded-2xl bg-theme-accent-subtle/70 border border-theme-accent/30 flex items-center justify-center mb-5 text-theme-accent shadow-inner">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>

            {/* 제목 및 설명 */}
            <h3 className="text-base font-semibold text-theme-text tracking-tight mb-1.5">
              {t("empty.scanning")}
            </h3>
            <p className="text-xs text-theme-text-muted leading-relaxed mb-6 max-w-xs">
              {t(
                "empty.scanning_desc"
              )}
            </p>

            {/* 실시간 프로그레스 바 영역 */}
            <ProgressBar
              value={library.scanProgress?.current ?? 0}
              max={library.scanProgress?.total ?? 100}
              size="md"
              showLabel
              label={
                library.scanProgress && library.scanProgress.total > 0
                  ? `${library.scanProgress.current.toLocaleString()} / ${library.scanProgress.total.toLocaleString()}${t("common.count_unit")}`
                  : t("common.loading")
              }
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* 6. 폴더 드래그앤드롭 전체 화면 오버레이 */}
      <FolderDropOverlay isVisible={isDraggingOver && !isDiffModalOpen} />

      {/* 7. Toast Notification */}
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          variant={toastInfo.variant}
          duration={appConfig.ui.toastDurationMs}
          onClose={() => setToastInfo(null)}
        />
      )}
    </div>
  );
}
