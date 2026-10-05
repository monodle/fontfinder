import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Sliders, Folder, BookOpen } from "lucide-react";
import { ModalDialog } from "./ModalDialog";
import { Button, Alert, CheckboxCard } from "./common";
import { backupService, summarizeBackupData } from "../services/backupService";
import type { AppBackupData, BackupCategorySelection, BackupSummary } from "../types/backup";

export interface ImportModalProps {
  isOpen: boolean;
  backupData: AppBackupData | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onComplete: () => void;
}

export function ImportModal({
  isOpen,
  backupData,
  onClose,
  onSuccess,
  onComplete,
}: ImportModalProps) {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<BackupSummary>({
    hasSettings: false,
    foldersCount: 0,
    setsCount: 0,
  });
  const [selection, setSelection] = useState<BackupCategorySelection>({
    settings: false,
    folders: false,
    sets: false,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && backupData) {
      setErrorMsg(null);
      setIsImporting(false);
      const s = summarizeBackupData(backupData);
      setSummary(s);
      setSelection({
        settings: s.hasSettings,
        folders: s.foldersCount > 0,
        sets: s.setsCount > 0,
      });
    }
  }, [isOpen, backupData]);

  if (!backupData) return null;

  const toggleCategory = (key: keyof BackupCategorySelection) => {
    // 해당 카테고리가 파일 내에 존재할 때만 토글 허용
    if (key === "settings" && !summary.hasSettings) return;
    if (key === "folders" && summary.foldersCount === 0) return;
    if (key === "sets" && summary.setsCount === 0) return;

    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isNoneSelected = !selection.settings && !selection.folders && !selection.sets;

  const handleImport = async () => {
    if (isNoneSelected || isImporting || !backupData) return;
    setIsImporting(true);
    setErrorMsg(null);

    try {
      const result = await backupService.importBackupData(backupData, selection);
      const details: string[] = [];
      if (result.settings) details.push(t("settings.import_done_settings"));
      if (result.foldersAdded > 0)
        details.push(t("settings.import_done_folders", { count: result.foldersAdded }));
      if (result.setsAdded > 0)
        details.push(t("settings.import_done_sets", { count: result.setsAdded }));

      const feedback = details.length > 0
        ? t("settings.import_success_with_details", {
            details: details.join(", "),
          })
        : t("settings.import_success");

      onSuccess(feedback);
      onClose();
      onComplete();
    } catch (err) {
      console.error("Import error:", err);
      setErrorMsg(err instanceof Error ? err.message : t("settings.import_failed"));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      icon={<Upload className="w-4 h-4 text-theme-accent" />}
      title={t("settings.import_modal_title")}
      subtitle={t("settings.import_modal_subtitle")}
      footer={
        <div className="flex items-center justify-end w-full gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={isNoneSelected}
            isLoading={isImporting}
            loadingText={t("common.loading")}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            {t("settings.import_btn_confirm")}
          </Button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {errorMsg && <Alert variant="error" message={errorMsg} />}

        <div className="space-y-2.5">
          {/* 1. 시스템 기본 설정 */}
          <CheckboxCard
            checked={selection.settings}
            onChange={() => toggleCategory("settings")}
            disabled={!summary.hasSettings}
            icon={<Sliders className="w-3.5 h-3.5 text-theme-accent" />}
            title={t("settings.import_item_settings")}
            description={t("settings.import_item_settings_desc")}
            badge={
              !summary.hasSettings ? (
                <span className="text-[10px] text-theme-text-muted">
                  ({t("common.not_included")})
                </span>
              ) : undefined
            }
          />

          {/* 2. 추가된 폴더 */}
          <CheckboxCard
            checked={selection.folders}
            onChange={() => toggleCategory("folders")}
            disabled={summary.foldersCount === 0}
            icon={<Folder className="w-3.5 h-3.5 text-sky-500" />}
            title={t("settings.import_item_folders")}
            description={t("settings.import_item_folders_desc")}
            badge={
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.foldersCount}
                </span>
                {summary.foldersCount === 0 && (
                  <span className="text-[10px] text-theme-text-muted">
                    ({t("common.not_included")})
                  </span>
                )}
              </div>
            }
          />

          {/* 3. 서재 세트 */}
          <CheckboxCard
            checked={selection.sets}
            onChange={() => toggleCategory("sets")}
            disabled={summary.setsCount === 0}
            icon={<BookOpen className="w-3.5 h-3.5 text-indigo-500" />}
            title={t("settings.import_item_sets")}
            description={t("settings.import_item_sets_desc")}
            badge={
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.setsCount}
                </span>
                {summary.setsCount === 0 && (
                  <span className="text-[10px] text-theme-text-muted">
                    ({t("common.not_included")})
                  </span>
                )}
              </div>
            }
          />
        </div>
      </div>
    </ModalDialog>
  );
}
