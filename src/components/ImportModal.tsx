import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Sliders, Folder, BookOpen, Check, AlertCircle } from "lucide-react";
import { ModalDialog } from "./ModalDialog";
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
      if (result.settings) details.push(t("settings.import_done_settings", "시스템 설정"));
      if (result.foldersAdded > 0)
        details.push(t("settings.import_done_folders", "{{count}}개 폴더", { count: result.foldersAdded }));
      if (result.setsAdded > 0)
        details.push(t("settings.import_done_sets", "{{count}}개 서재", { count: result.setsAdded }));

      const feedback = details.length > 0
        ? t("settings.import_success_with_details", "성공적으로 복원되었습니다 ({{details}}).", {
            details: details.join(", "),
          })
        : t("settings.import_success", "데이터를 성공적으로 불러왔습니다.");

      onSuccess(feedback);
      onClose();
      onComplete();
    } catch (err) {
      console.error("Import error:", err);
      setErrorMsg(err instanceof Error ? err.message : t("settings.import_failed", "가져오기에 실패했습니다."));
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
      title={t("settings.import_modal_title", "데이터 및 설정 가져오기")}
      subtitle={t("settings.import_modal_subtitle", "가져올 백업 항목을 선택하세요.")}
      footer={
        <div className="flex items-center justify-end w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-theme-border text-xs font-medium text-theme-text-secondary hover:bg-theme-hover transition-colors cursor-pointer"
          >
            {t("common.cancel", "취소")}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isNoneSelected || isImporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text text-xs font-medium shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? t("common.loading", "처리 중...") : t("settings.import_btn_confirm", "선택 항목 가져오기")}</span>
          </button>
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
            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none ${
              !summary.hasSettings
                ? "opacity-50 cursor-not-allowed bg-theme-card/30 border-theme-border/50"
                : selection.settings
                ? "bg-theme-accent-subtle/40 border-theme-accent/40 cursor-pointer"
                : "bg-theme-card/60 border-theme-border hover:border-theme-border-hover cursor-pointer"
            }`}
          >
            <div
              className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                !summary.hasSettings
                  ? "border-theme-border bg-theme-card"
                  : selection.settings
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
                  {t("settings.import_item_settings", "시스템 기본 설정")}
                </span>
                {!summary.hasSettings && (
                  <span className="text-[10px] text-theme-text-muted">
                    ({t("common.not_included", "파일에 없음")})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">
                {t("settings.import_item_settings_desc", "파일에 저장된 테마, 언어, 폰트 크기 및 미리보기 기본값 적용")}
              </p>
            </div>
          </div>

          {/* 2. 추가된 폴더 */}
          <div
            onClick={() => toggleCategory("folders")}
            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none ${
              summary.foldersCount === 0
                ? "opacity-50 cursor-not-allowed bg-theme-card/30 border-theme-border/50"
                : selection.folders
                ? "bg-theme-accent-subtle/40 border-theme-accent/40 cursor-pointer"
                : "bg-theme-card/60 border-theme-border hover:border-theme-border-hover cursor-pointer"
            }`}
          >
            <div
              className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                summary.foldersCount === 0
                  ? "border-theme-border bg-theme-card"
                  : selection.folders
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
                  {t("settings.import_item_folders", "추가된 폴더")}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.foldersCount}
                </span>
                {summary.foldersCount === 0 && (
                  <span className="text-[10px] text-theme-text-muted">
                    ({t("common.not_included", "파일에 없음")})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">
                {t("settings.import_item_folders_desc", "등록된 감시 폴더 경로를 추가하고 파일 변경 감시 활성화")}
              </p>
            </div>
          </div>

          {/* 3. 서재 세트 */}
          <div
            onClick={() => toggleCategory("sets")}
            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none ${
              summary.setsCount === 0
                ? "opacity-50 cursor-not-allowed bg-theme-card/30 border-theme-border/50"
                : selection.sets
                ? "bg-theme-accent-subtle/40 border-theme-accent/40 cursor-pointer"
                : "bg-theme-card/60 border-theme-border hover:border-theme-border-hover cursor-pointer"
            }`}
          >
            <div
              className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                summary.setsCount === 0
                  ? "border-theme-border bg-theme-card"
                  : selection.sets
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
                  {t("settings.import_item_sets", "서재 세트")}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.setsCount}
                </span>
                {summary.setsCount === 0 && (
                  <span className="text-[10px] text-theme-text-muted">
                    ({t("common.not_included", "파일에 없음")})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">
                {t("settings.import_item_sets_desc", "서재 세트를 생성하고 해당 세트에 속한 글꼴 연결 복원")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
