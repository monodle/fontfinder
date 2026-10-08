import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Sliders, Folder, BookOpen } from "lucide-react";
import { ModalDialog, Button, Alert, CheckboxCard } from "../common";
import { backupService } from "../../services/backup";
import type { BackupCategorySelection, BackupSummary } from "../../types/backup";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ExportModal({ isOpen, onClose, onSuccess }: ExportModalProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<BackupSummary>({
    hasSettings: true,
    foldersCount: 0,
    setsCount: 0,
  });
  const [selection, setSelection] = useState<BackupCategorySelection>({
    settings: true,
    folders: true,
    sets: true,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsExporting(false);
      setSelection({ settings: true, folders: true, sets: true });
      backupService.getCurrentSummary().then(setSummary);
    }
  }, [isOpen]);

  const toggleCategory = (key: keyof BackupCategorySelection) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isNoneSelected = !selection.settings && !selection.folders && !selection.sets;

  const handleExport = async () => {
    if (isNoneSelected || isExporting) return;
    setIsExporting(true);
    setErrorMsg(null);

    try {
      const payload = await backupService.createExportPayload(selection);
      const saved = await backupService.saveBackupToFile(payload);
      if (saved) {
        onSuccess(t("settings.export_success"));
        onClose();
      }
    } catch (err) {
      console.error("Export error:", err);
      setErrorMsg(err instanceof Error ? err.message : t("settings.export_failed"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      icon={<Upload className="w-4 h-4 text-theme-accent" />}
      title={t("settings.export_modal_title")}
      subtitle={t("settings.export_modal_subtitle")}
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => {
              const allChecked = selection.settings && selection.folders && selection.sets;
              setSelection({
                settings: !allChecked,
                folders: !allChecked,
                sets: !allChecked,
              });
            }}
            className="text-xs text-theme-text-muted hover:text-theme-accent transition-colors cursor-pointer"
          >
            {selection.settings && selection.folders && selection.sets
              ? t("common.deselect_all")
              : t("common.select_all")}
          </button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExport}
              disabled={isNoneSelected}
              isLoading={isExporting}
              loadingText={t("common.loading")}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
            >
              {t("settings.export_btn_confirm")}
            </Button>
          </div>
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
            icon={<Sliders className="w-3.5 h-3.5" />}
            title={t("settings.export_item_settings")}
            description={t("settings.export_item_settings_desc")}
          />

          {/* 2. 추가된 폴더 */}
          <CheckboxCard
            checked={selection.folders}
            onChange={() => toggleCategory("folders")}
            icon={<Folder className="w-3.5 h-3.5 text-sky-500" />}
            title={t("settings.export_item_folders")}
            description={t("settings.export_item_folders_desc")}
            badge={
              <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                {summary.foldersCount}
              </span>
            }
          />

          {/* 3. 서재 세트 */}
          <CheckboxCard
            checked={selection.sets}
            onChange={() => toggleCategory("sets")}
            icon={<BookOpen className="w-3.5 h-3.5 text-indigo-500" />}
            title={t("settings.export_item_sets")}
            description={t("settings.export_item_sets_desc")}
            badge={
              <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                {summary.setsCount}
              </span>
            }
          />
        </div>
      </div>
    </ModalDialog>
  );
}
