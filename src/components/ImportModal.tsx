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
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("common.cancel", "취소")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={isNoneSelected}
            isLoading={isImporting}
            loadingText={t("common.loading", "처리 중...")}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            {t("settings.import_btn_confirm", "선택 항목 가져오기")}
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
            title={t("settings.import_item_settings", "시스템 기본 설정")}
            description={t("settings.import_item_settings_desc", "파일에 저장된 테마, 언어, 폰트 크기 및 미리보기 기본값 적용")}
            badge={
              !summary.hasSettings ? (
                <span className="text-[10px] text-theme-text-muted">
                  ({t("common.not_included", "파일에 없음")})
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
            title={t("settings.import_item_folders", "추가된 폴더")}
            description={t("settings.import_item_folders_desc", "등록된 감시 폴더 경로를 추가하고 파일 변경 감시 활성화")}
            badge={
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.foldersCount}
                </span>
                {summary.foldersCount === 0 && (
                  <span className="text-[10px] text-theme-text-muted">
                    ({t("common.not_included", "파일에 없음")})
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
            title={t("settings.import_item_sets", "서재 세트")}
            description={t("settings.import_item_sets_desc", "서재 세트를 생성하고 해당 세트에 속한 글꼴 연결 복원")}
            badge={
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-theme-hover text-theme-text-secondary text-[10px] font-mono">
                  {summary.setsCount}
                </span>
                {summary.setsCount === 0 && (
                  <span className="text-[10px] text-theme-text-muted">
                    ({t("common.not_included", "파일에 없음")})
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
