import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download, Sliders, Folder, BookOpen, Check, AlertCircle } from "lucide-react";
import { ModalDialog } from "./ModalDialog";
import { backupService } from "../services/backupService";
import type { BackupCategorySelection, BackupSummary } from "../types/backup";

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
        onSuccess(t("settings.export_success", "데이터를 성공적으로 내보냈습니다."));
        onClose();
      }
    } catch (err) {
      console.error("Export error:", err);
      setErrorMsg(err instanceof Error ? err.message : t("settings.export_failed", "내보내기에 실패했습니다."));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      icon={<Download className="w-4 h-4 text-theme-accent" />}
      title={t("settings.export_modal_title", "데이터 및 설정 내보내기")}
      subtitle={t("settings.export_modal_subtitle", "백업할 데이터 항목을 선택하세요.")}
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
              ? t("common.deselect_all", "전체 해제")
              : t("common.select_all", "전체 선택")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-theme-border text-xs font-medium text-theme-text-secondary hover:bg-theme-hover transition-colors cursor-pointer"
            >
              {t("common.cancel", "취소")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isNoneSelected || isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text text-xs font-medium shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? t("common.loading", "처리 중...") : t("settings.export_btn_confirm", "JSON 파일로 내보내기")}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2.5">
          {/* 1. 시스템 기본 설정 */}
          <div
            onClick={() => toggleCategory("settings")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
              selection.settings
                ? "bg-theme-accent-subtle/40 border-theme-accent/40"
                : "bg-theme-card/60 border-theme-border hover:border-theme-border-hover"
            }`}
          >
            <div
              className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                selection.settings
                  ? "bg-theme-accent border-theme-accent text-theme-accent-text"
                  : "border-theme-border bg-theme-surface"
              }`}
            >
              {selection.settings && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-theme-accent" />
                <span className="text-xs font-semibold text-theme-text">
                  {t("settings.export_item_settings", "시스템 기본 설정")}
                </span>
              </div>
              <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">
                {t("settings.export_item_settings_desc", "테마, 언어, 기본 글꼴 크기, 그리드 열 수, 텍스트 미리보기 등")}
              </p>
            </div>
          </div>

          {/* 2. 추가된 폴더 */}
          <div
            onClick={() => toggleCategory("folders")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
              selection.folders
                ? "bg-theme-accent-subtle/40 border-theme-accent/40"
                : "bg-theme-card/60 border-theme-border hover:border-theme-border-hover"
            }`}
          >
            <div
              className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                selection.folders
                  ? "bg-theme-accent border-theme-accent text-theme-accent-text"
                  : "border-theme-border bg-theme-surface"
              }`}
            >
              {selection.folders && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-sky-500" />
                <span className="text-xs font-semibold text-theme-text">
                  {t("settings.export_item_folders", "추가된 폴더")}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.foldersCount}
                </span>
              </div>
              <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">
                {t("settings.export_item_folders_desc", "등록된 감시 폴더 경로, 이름 및 색상 태그")}
              </p>
            </div>
          </div>

          {/* 3. 서재 세트 */}
          <div
            onClick={() => toggleCategory("sets")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
              selection.sets
                ? "bg-theme-accent-subtle/40 border-theme-accent/40"
                : "bg-theme-card/60 border-theme-border hover:border-theme-border-hover"
            }`}
          >
            <div
              className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                selection.sets
                  ? "bg-theme-accent border-theme-accent text-theme-accent-text"
                  : "border-theme-border bg-theme-surface"
              }`}
            >
              {selection.sets && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-semibold text-theme-text">
                  {t("settings.export_item_sets", "서재 세트")}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.setsCount}
                </span>
              </div>
              <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">
                {t("settings.export_item_sets_desc", "생성한 서재 세트 및 세트에 분류된 폰트 연결 정보")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
