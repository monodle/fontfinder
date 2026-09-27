import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check, RefreshCw, Sliders } from "lucide-react";
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

  // 뷰 모드 및 그리드 열 상태
  const [viewMode, setViewMode] = useState<"list" | "grid">(appSettings.defaultViewMode);
  const [gridColumns, setGridColumns] = useState<number>(appSettings.defaultGridColumns);

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), appConfig.ui.toastDurationMs);
  }, []);

  // 2. 도메인 계층 커스텀 훅: 폰트 라이브러리 및 DB 동기화
  const library = useFontLibrary({
    defaultCategory: appSettings.defaultCategory,
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
    unpluggedFonts: library.unpluggedFonts,
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
          t("diff.top5_sliced_notice", "최대 5개 폰트만 비교 슬롯에 등록되었습니다.")
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

  // 프리뷰 설정 동기화
  useEffect(() => {
    try {
      localStorage.setItem("fontfinder_preview_settings", JSON.stringify(previewSettings));
      void fontService.setSetting("preview_settings", JSON.stringify(previewSettings));
    } catch (e) {
      console.error("previewSettings 저장 실패:", e);
    }
  }, [previewSettings]);

  // DB 사용자 환경설정 로드 및 온보딩 상태 확인
  useEffect(() => {
    settingsService
      .loadSettings()
      .then((loaded) => {
        setAppSettings(loaded);
        if (loaded.language) {
          changeLanguage(loaded.language);
        }
        setPreviewSettings((prev) => {
          const isDefault = isDefaultPreviewText(prev.text);
          return {
            ...prev,
            text: isDefault && loaded.language
              ? getDefaultPreviewText(loaded.language)
              : prev.text,
            fontSize: prev.fontSize || loaded.defaultFontSize,
            textColor: prev.textColor || loaded.defaultTextColor || "",
            backgroundColor: prev.backgroundColor || loaded.defaultBackgroundColor || "",
            textAlign: prev.textAlign || loaded.defaultTextAlign || "left",
            lineHeight: prev.lineHeight || loaded.defaultLineHeight || 1.45,
            letterSpacing: prev.letterSpacing ?? loaded.defaultLetterSpacing ?? 0,
            isBold: prev.isBold ?? loaded.defaultIsBold ?? false,
            isItalic: prev.isItalic ?? loaded.defaultIsItalic ?? false,
            isUnderline: prev.isUnderline ?? loaded.defaultIsUnderline ?? false,
          };
        });
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




  const handleOpenFolder = useCallback(
    (path: string) => {
      fontService.showInFolder(path).catch((err) => {
        console.error("탐색기 열기 실패:", err);
        showToast(t("toast.folder_open_failed", { defaultValue: "폴더를 열지 못했습니다." }));
      });
    },
    [showToast, t]
  );

  // 서재 세트 화면에서 Delete / Backspace 키 단축키로 서재에서 선택 폰트 제거
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
        void actions.handleBulkRemoveFromSet(
          currentSetId,
          Array.from(selection.selectedFontIds)
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentSetId, selection.selectedFontIds, actions, handleToggleSidebar]);

  // 환경 설정 저장 핸들러
  const handleSaveSettings = async (newSettings: CustomAppSettings) => {
    try {
      await settingsService.saveSettings(newSettings);
      setAppSettings(newSettings);
      setPreviewSettings((prev) => ({
        ...prev,
        text: newSettings.defaultPreviewText,
        fontSize: newSettings.defaultFontSize,
        textColor: newSettings.defaultTextColor,
        backgroundColor: newSettings.defaultBackgroundColor,
        textAlign: newSettings.defaultTextAlign,
        lineHeight: newSettings.defaultLineHeight,
        letterSpacing: newSettings.defaultLetterSpacing,
        isBold: Boolean(newSettings.defaultIsBold),
        isItalic: Boolean(newSettings.defaultIsItalic),
        isUnderline: Boolean(newSettings.defaultIsUnderline),
      }));
      setGridColumns((prev) => Math.min(5, Math.max(2, prev)));
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
        counts={{
          total: library.fonts.length,
          system: library.fonts.filter((f) => f.source === "system").length,
          user: library.fonts.filter((f) => f.source === "user").length,
          activated: library.fonts.filter(
            (f) => library.activatedFontIds.has(f.id) && f.source !== "system" && f.source !== "user"
          ).length,
          favorites: library.favoriteIds.size,
          duplicates: library.duplicateFontIds.size,
        }}
        customFolders={library.customFolders}
        sets={library.sets}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
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
          onViewModeChange={setViewMode}
          gridColumns={gridColumns}
          onGridColumnsChange={setGridColumns}
          isLoading={library.isLoading}
          onRefresh={() => void library.refreshList()}
          onOpenStyleModal={() => setIsPreviewModalOpen(true)}
          selectedCount={selection.selectedFontIds.size}
          onOpenDiff={() => handleOpenDiffModal()}
        />

        <LocationBar
          activeCategory={library.activeCategory}
          customFolders={library.customFolders}
          sets={library.sets}
          fontsCount={library.filteredFonts.length}
          selectedCount={selection.selectedFontIds.size}
          onOpenFolder={handleOpenFolder}
          onRelinkFolder={actions.handleRelinkFolder}
        />

        <div className="flex-1 min-w-0 overflow-hidden">
          {library.isLoading && library.fonts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin text-theme-accent mb-2" />
              <p className="text-xs">{t("empty.scanning")}</p>
            </div>
          ) : library.filteredFonts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-theme-text-muted">
              <div className="w-12 h-12 rounded-2xl bg-theme-card border border-theme-border flex items-center justify-center mb-3 text-theme-text-secondary">
                <Sliders className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-theme-text">{t("empty.no_fonts_title")}</p>
              <p className="text-xs text-theme-text-muted mt-1 max-w-sm">
                {t("empty.no_fonts_desc")}
              </p>
            </div>
          ) : (
            <VirtualFontList
              fonts={library.filteredFonts}
              previewSettings={previewSettings}
              viewMode={viewMode}
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
          onRefreshList={() => void library.refreshList()}
          onActionFeedback={showToast}
          onClearSelection={selection.handleClearSelection}
          onOpenDiff={handleOpenDiffModal}
        />
      )}

      {/* 5. Modals */}
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

      <PreviewTextModal
        isOpen={isPreviewModalOpen}
        settings={previewSettings}
        minFontSize={appSettings.minFontSize}
        maxFontSize={appSettings.maxFontSize}
        defaultFontSize={appSettings.defaultFontSize}
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
              {t("empty.scanning", "활자 메타데이터를 스캔하는 중입니다...")}
            </h3>
            <p className="text-xs text-theme-text-muted leading-relaxed mb-6 max-w-xs">
              {t(
                "empty.scanning_desc",
                "운영체제 시스템 글꼴을 색인하여 최적화하고 있습니다. 최초 1회 완료 후에는 캐시를 통해 즉시 로드됩니다."
              )}
            </p>

            {/* 실시간 프로그레스 바 영역 */}
            <div className="w-full space-y-2">
              <div className="w-full h-2.5 rounded-full bg-theme-hover overflow-hidden p-0.5 border border-theme-border/70">
                <div
                  className="h-full rounded-full bg-theme-accent transition-all duration-200 ease-out shadow-xs"
                  style={{
                    width: `${library.scanProgress && library.scanProgress.total > 0
                      ? Math.min(
                        100,
                        Math.round(
                          (library.scanProgress.current /
                            library.scanProgress.total) *
                          100
                        )
                      )
                      : 20
                      }%`,
                  }}
                />
              </div>

              {/* 진행률 수치 및 퍼센트 */}
              <div className="flex items-center justify-between text-[11px] text-theme-text-secondary font-mono px-0.5">
                <span>
                  {library.scanProgress && library.scanProgress.total > 0
                    ? `${library.scanProgress.current.toLocaleString()} / ${library.scanProgress.total.toLocaleString()}개`
                    : t("common.loading", "분석 중...")}
                </span>
                <span className="font-semibold text-theme-accent">
                  {library.scanProgress && library.scanProgress.total > 0
                    ? `${Math.min(
                      100,
                      Math.round(
                        (library.scanProgress.current /
                          library.scanProgress.total) *
                        100
                      )
                    )}%`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. 폴더 드래그앤드롭 전체 화면 오버레이 */}
      <FolderDropOverlay isVisible={isDraggingOver && !isDiffModalOpen} />

      {/* 7. Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#2d2824]/95 text-[#fbf8f2] shadow-xl backdrop-blur-md border border-[#484039] text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
