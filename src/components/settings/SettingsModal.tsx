import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Settings,
  RotateCcw,
  Check,
  Type,
  LayoutGrid,
  SlidersHorizontal,
  HardDrive,
  Globe,
  Palette,
  Download,
  Upload,
  Trash2,
  Coffee,
  Info,
  ArrowDownAZ,
} from "lucide-react";
import { ModalDialog, ConfirmModal, SettingSection, SettingRow, Tabs, TabItem } from "../common";
import {
  CustomAppSettings,
  getDefaultSettings,
  applyTheme,
  sanitizeFontSortSettings,
} from "../../services/settingsService";
import { clearFontLoaderCache } from "../../utils/fontLoader";
import {
  LibraryCategory,
  getDefaultPreviewText,
  AppTheme,
} from "../../config/appConfig";
import { changeLanguage } from "../../i18n";
import { ThemeSelector } from "../controls/ThemeSelector";
import { LanguageSelector } from "../controls/LanguageSelector";
import { ViewModeControl } from "../controls/ViewModeControl";
import { DetailModeControl } from "../controls/DetailModeControl";
import { GridColumnsSelector } from "../controls/GridColumnsSelector";
import { FontSortSettingsSection } from "./FontSortSettingsSection";
import { DEFAULT_SORT_SETTINGS } from "../../types/sort";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { SponsorSection } from "./SponsorSection";
import { AboutSection } from "./AboutSection";
import { backupService } from "../../services/backupService";
import { fontService } from "../../services/fontService";
import type { AppBackupData } from "../../types/backup";

export type SettingsTab =
  | "all"
  | "appearance"
  | "library"
  | "layout"
  | "advanced"
  | "sponsor"
  | "about";

interface SettingsModalProps {
  isOpen: boolean;
  settings: CustomAppSettings;
  initialTab?: SettingsTab;
  onClose: () => void;
  onSave: (newSettings: CustomAppSettings) => Promise<void> | void;
  onNotify?: (message: string) => void;
}

export function SettingsModal({
  isOpen,
  settings,
  initialTab = "all",
  onClose,
  onSave,
  onNotify,
}: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState<CustomAppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedBackupData, setImportedBackupData] = useState<AppBackupData | null>(null);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(settings);
      setActiveTab(initialTab);
      applyTheme(settings.theme);
    }
  }, [isOpen, settings, initialTab]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    applyTheme(settings.theme);
    onClose();
  };

  const handleThemeChange = (newTheme: AppTheme) => {
    setForm((prev) => ({
      ...prev,
      theme: newTheme,
    }));
    applyTheme(newTheme);
  };

  const categoryOptions: { id: LibraryCategory; label: string; desc: string }[] = [
    { id: "all", label: t("sidebar.category_all"), desc: t("settings.cat_all_desc") },
    { id: "user", label: t("sidebar.category_user"), desc: t("settings.cat_user_desc") },
    { id: "activated", label: t("sidebar.category_activated"), desc: t("settings.cat_activated_desc") },
    { id: "favorites", label: t("sidebar.category_favorites"), desc: t("settings.cat_favorites_desc") },
    { id: "duplicates", label: t("sidebar.category_duplicates"), desc: t("settings.cat_duplicates_desc") },
  ];

  const handleLanguageChange = (langCode: string) => {
    setForm((prev) => ({
      ...prev,
      language: langCode,
      defaultPreviewText: getDefaultPreviewText(langCode),
    }));
    changeLanguage(langCode);
  };

  const handleSave = async () => {
    const validMin = Math.max(8, form.minFontSize);
    const validMax = Math.max(validMin + 4, form.maxFontSize);
    const validDefaultSize = Math.min(validMax, Math.max(validMin, form.defaultFontSize));

    const finalSettings: CustomAppSettings = {
      ...form,
      minFontSize: validMin,
      maxFontSize: validMax,
      defaultFontSize: validDefaultSize,
      defaultGridColumns: Math.min(5, Math.max(2, form.defaultGridColumns)),
      defaultVariableWeight: Math.min(900, Math.max(100, form.defaultVariableWeight)),
      defaultTextAlign: ["left", "center", "right"].includes(form.defaultTextAlign) ? form.defaultTextAlign : "left",
      defaultLineHeight: Math.min(2.5, Math.max(1.0, form.defaultLineHeight || 1.45)),
      defaultLetterSpacing: Math.min(12, Math.max(-2, form.defaultLetterSpacing ?? 0)),
      defaultIsBold: Boolean(form.defaultIsBold),
      defaultIsItalic: Boolean(form.defaultIsItalic),
      defaultIsUnderline: Boolean(form.defaultIsUnderline),
      fontSortSettings: sanitizeFontSortSettings(form.fontSortSettings),
    };

    setIsSaving(true);
    try {
      await onSave(finalSettings);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm(t("settings.reset_confirm"))) {
      return;
    }

    const currentLang = form.language;
    const currentTheme = form.theme;
    const defaults = getDefaultSettings(currentLang);

    setForm({
      ...defaults,
      language: currentLang,
      theme: currentTheme,
    });
  };

  const handleOpenExport = () => {
    setIsExportModalOpen(true);
  };

  const handleStartImport = async () => {
    try {
      const data = await backupService.selectAndReadBackupFile();
      if (!data) return; // 사용자 취소
      setImportedBackupData(data);
      setIsImportModalOpen(true);
    } catch (err) {
      console.error("Backup file read error:", err);
      const errorMsg = err instanceof Error ? err.message : "";
      const msg = t("settings.import_failed", { error: errorMsg });
      if (onNotify) {
        onNotify(msg);
      } else {
        alert(msg);
      }
    }
  };

  const handleExportSuccess = (msg: string) => {
    if (onNotify) {
      onNotify(msg);
    }
  };

  const handleImportSuccess = (msg: string) => {
    if (onNotify) {
      onNotify(msg);
    }
  };

  const handleImportComplete = () => {
    onClose();
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleExecuteResetAll = async () => {
    setIsResetting(true);
    try {
      clearFontLoaderCache();
      await fontService.resetAppData();
      localStorage.clear();
      if (onNotify) {
        onNotify(t("settings.reset_all_data_success"));
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error("Reset app data failed:", err);
      const errorMsg = err instanceof Error ? `: ${err.message}` : "";
      alert(`${t("settings.reset_failed_alert")}${errorMsg}`);
      setIsResetting(false);
    }
  };

  const tabItems: TabItem<SettingsTab>[] = [
    { id: "all", label: t("settings.tab_all"), icon: <SlidersHorizontal className="w-4 h-4 shrink-0" /> },
    { id: "appearance", label: t("settings.tab_appearance"), icon: <Palette className="w-4 h-4 shrink-0" /> },
    { id: "library", label: t("settings.tab_library"), icon: <Type className="w-4 h-4 shrink-0" /> },
    { id: "layout", label: t("settings.tab_layout"), icon: <LayoutGrid className="w-4 h-4 shrink-0" /> },
    { id: "advanced", label: t("settings.tab_advanced"), icon: <HardDrive className="w-4 h-4 shrink-0" /> },
    { id: "sponsor", label: t("settings.tab_sponsor"), icon: <Coffee className="w-4 h-4 shrink-0" /> },
    { id: "about", label: t("settings.tab_about"), icon: <Info className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <>
      <ModalDialog
        isOpen={isOpen}
        onClose={handleCloseModal}
        maxWidth="4xl"
        heightClass="h-[720px] max-h-[90vh]"
        icon={<Settings className="w-4 h-4" />}
        title={t("settings.title")}
        subtitle={tabItems.find((tab) => tab.id === activeTab)?.label}
        footer={
          <>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-theme-text-muted hover:text-theme-accent px-2.5 py-1.5 rounded-lg hover:bg-theme-hover transition-colors cursor-pointer"
              title={t("common.reset")}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("common.reset")}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-3.5 py-1.5 rounded-lg border border-theme-border text-xs font-medium text-theme-text-secondary hover:bg-theme-hover transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text text-xs font-medium shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? t("common.loading") : t("common.save")}</span>
              </button>
            </div>
          </>
        }
      >
        {/* Modal Body: Left Tab Sidebar + Right Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Tabs Sidebar */}
          <aside className="w-full md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-theme-border bg-theme-surface-header/30 flex flex-col justify-between p-3 select-none">
            <Tabs
              tabs={tabItems}
              activeTab={activeTab}
              onChange={setActiveTab}
              orientation="vertical"
              variant="pill"
              className="md:flex-col gap-1 overflow-x-auto md:overflow-x-visible no-scrollbar pb-1 md:pb-0"
              tabClassName="shrink-0 md:shrink whitespace-nowrap"
            />
          </aside>

          {/* Right Main Content */}
          <main
            ref={contentRef}
            className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-theme-text"
          >
            {/* 1 & 2. 언어 및 테마 설정 (Appearance) */}
            {(activeTab === "all" || activeTab === "appearance") && (
              <>
                {/* 1. 언어 설정 (Language) */}
                <SettingSection icon={<Globe className="w-4 h-4" />} title={t("settings.language")}>
                  <SettingRow
                    title={t("settings.language")}
                    description={t("settings.language_desc")}
                  >
                    <LanguageSelector
                      variant="dropdown"
                      selectedLanguage={form.language || i18n.language}
                      onSelect={handleLanguageChange}
                    />
                  </SettingRow>
                </SettingSection>

                {/* 2. 테마 설정 (Theme) */}
                <SettingSection icon={<Palette className="w-4 h-4" />} title={t("settings.theme")}>
                  <ThemeSelector
                    selectedTheme={form.theme}
                    onSelect={handleThemeChange}
                    columns={3}
                  />
                </SettingSection>
              </>
            )}

            {/* 3. 서재 및 기본 카테고리 설정 (Library) */}
            {(activeTab === "all" || activeTab === "library") && (
              <SettingSection icon={<Type className="w-4 h-4" />} title={t("settings.default_category")}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categoryOptions.map((cat) => {
                    const isSelected = form.defaultCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, defaultCategory: cat.id }))}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                          ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-xs ring-1 ring-theme-accent/40"
                          : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover"
                          }`}
                      >
                        <span className="font-semibold text-xs">{cat.label}</span>
                        <span className="text-[10px] text-theme-text-muted mt-0.5 line-clamp-1">
                          {cat.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SettingSection>
            )}

            {/* 4. 뷰 모드 및 그리드 설정 (Layout) */}
            {(activeTab === "all" || activeTab === "layout") && (
              <section className="space-y-4">
                {/* 폰트 목록 정렬 섹션 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-theme-border-subtle">
                    <ArrowDownAZ className="w-4 h-4 text-theme-accent" />
                    <h3 className="font-semibold text-xs text-theme-text">
                      {t("settings.font_sort_title")}
                    </h3>
                  </div>

                  <FontSortSettingsSection
                    settings={form.fontSortSettings || DEFAULT_SORT_SETTINGS}
                    onChange={(newSortSettings) =>
                      setForm((prev) => ({ ...prev, fontSortSettings: newSortSettings }))
                    }
                  />
                </div>

                <div className="flex items-center gap-2 pb-1.5 border-b border-theme-border-subtle pt-2">
                  <LayoutGrid className="w-4 h-4 text-theme-accent" />
                  <h3 className="font-semibold text-xs text-theme-text">
                    {t("settings.layout_grid_title")}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* 폰트 카드 표시 방식 (간단히 / 자세히) */}
                  <div className="p-3 bg-theme-card rounded-xl border border-theme-border space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-medium text-theme-text-secondary">
                        {t("settings.font_detail_mode")}
                      </span>
                      <span className="text-[10px] text-theme-text-muted mt-0.5">
                        {t("settings.font_detail_mode_desc")}
                      </span>
                    </div>
                    <DetailModeControl
                      detailMode={form.defaultFontDetailMode || "detailed"}
                      onChange={(mode) =>
                        setForm((prev) => ({ ...prev, defaultFontDetailMode: mode }))
                      }
                      variant="button"
                    />
                  </div>

                  {/* 기본 뷰 모드 */}
                  <div className="p-3 bg-theme-card rounded-xl border border-theme-border space-y-2">
                    <span className="text-[11px] font-medium text-theme-text-secondary">
                      {t("settings.default_view_mode")}
                    </span>
                    <ViewModeControl
                      viewMode={form.defaultViewMode}
                      onChange={(mode) =>
                        setForm((prev) => ({ ...prev, defaultViewMode: mode }))
                      }
                      variant="button"
                    />
                  </div>

                  {/* 기본 그리드 열 수 */}
                  <div className="p-3 bg-theme-card rounded-xl border border-theme-border space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-medium text-theme-text-secondary">
                        {t("settings.grid_columns")}
                      </span>
                      <span className="font-mono font-semibold text-theme-accent bg-theme-accent-subtle px-1.5 py-0.5 rounded text-[10px]">
                        {t("settings.grid_column_unit", {
                          cols: form.defaultGridColumns,
                        })}
                      </span>
                    </div>
                    <GridColumnsSelector
                      columns={form.defaultGridColumns}
                      onChange={(cols) =>
                        setForm((prev) => ({ ...prev, defaultGridColumns: cols }))
                      }
                      variant="buttons"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 6. 시스템 관리 (System / Advanced) */}
            {(activeTab === "all" || activeTab === "advanced") && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-theme-border-subtle">
                  <HardDrive className="w-4 h-4 text-theme-accent" />
                  <h3 className="font-semibold text-xs text-theme-text">
                    {t("settings.tab_advanced")}
                  </h3>
                </div>

                {/* 데이터 내보내기 & 가져오기 카드 */}
                <div className="p-4 rounded-xl bg-theme-card/60 border border-theme-border space-y-3">
                  <div>
                    <span className="font-semibold text-xs text-theme-text block">
                      {t("settings.system_backup_title")}
                    </span>
                    <p className="text-[11px] text-theme-text-secondary leading-relaxed mt-0.5">
                      {t("settings.system_backup_desc")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleOpenExport}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-xs font-medium text-theme-text hover:bg-theme-hover hover:border-theme-border-hover transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-theme-accent" />
                      <span>{t("settings.export_btn")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartImport}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-xs font-medium text-theme-text hover:bg-theme-hover hover:border-theme-border-hover transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-theme-accent" />
                      <span>{t("settings.import_btn")}</span>
                    </button>
                  </div>
                </div>

                {/* 캐시 및 데이터 전체 초기화 (Danger Zone) */}
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
                  <div>
                    <span className="font-semibold text-xs text-red-500 block">
                      {t("settings.system_danger_title")}
                    </span>
                    <p className="text-[11px] text-theme-text-secondary leading-relaxed mt-0.5">
                      {t("settings.system_danger_desc")}
                    </p>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsConfirmResetOpen(true)}
                      disabled={isResetting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-600/30 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {isResetting
                          ? t("common.loading")
                          : t("settings.reset_all_data_btn")}
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* 7. 커피 한 잔 보내기 (Sponsor) */}
            {(activeTab === "all" || activeTab === "sponsor") && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-theme-border-subtle">
                  <Coffee className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-xs text-theme-text">
                    {t("settings.tab_sponsor")}
                  </h3>
                </div>
                <SponsorSection />
              </section>
            )}

            {/* 8. 정보 (About) */}
            {(activeTab === "all" || activeTab === "about") && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-theme-border-subtle">
                  <Info className="w-4 h-4 text-theme-accent" />
                  <h3 className="font-semibold text-xs text-theme-text">
                    {t("settings.tab_about")}
                  </h3>
                </div>
                <AboutSection />
              </section>
            )}
          </main>
        </div>
      </ModalDialog>

      {/* 내보내기 모달 */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onSuccess={handleExportSuccess}
      />

      {/* 가져오기 모달 */}
      <ImportModal
        isOpen={isImportModalOpen}
        backupData={importedBackupData}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
        onComplete={handleImportComplete}
      />

      {/* 캐시 및 데이터 완전 초기화 확인 모달 */}
      <ConfirmModal
        isOpen={isConfirmResetOpen}
        onClose={() => setIsConfirmResetOpen(false)}
        onConfirm={handleExecuteResetAll}
        title={t("settings.reset_all_data_confirm_title")}
        description={t("settings.reset_all_data_confirm_desc")}
        confirmText={t("settings.reset_all_data_confirm_btn")}
        isDanger
        icon={<Trash2 className="w-6 h-6 text-red-500" />}
      />
    </>
  );
}
