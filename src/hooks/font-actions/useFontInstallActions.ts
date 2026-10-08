import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata, CustomFolder } from "../../types/font";
import { fontService } from "../../services/fontService";
import {
  formatBatchInstallFeedback,
  formatBatchUninstallFeedback,
  formatErrorMessage,
} from "../../utils/batchFeedback";
import type { ToastVariant } from "../../components/common/Toast";

export interface UseFontInstallActionsProps {
  filteredFonts: FontMetadata[];
  selectedFontIds: Set<number>;
  activatedFontIds: Set<number>;
  setActivatedFontIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  loadSystemFonts: (foldersToScan?: CustomFolder[]) => Promise<FontMetadata[] | void>;
  refreshList?: () => Promise<void>;
  handleClearSelection: () => void;
  showToast: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFontInstallActions({
  filteredFonts,
  selectedFontIds,
  activatedFontIds,
  setActivatedFontIds,
  loadSystemFonts,
  refreshList,
  handleClearSelection,
  showToast,
}: UseFontInstallActionsProps) {
  const { t } = useTranslation();

  // 일괄 설치 (설치 전 임시 활성화 해제 시 font_id 정확히 매핑하여 DB 고아 레코드 방지)
  const handleBulkInstall = useCallback(async () => {
    const selectedFonts = filteredFonts.filter((f) => selectedFontIds.has(f.id));
    const installable = selectedFonts.filter(
      (f) =>
        f.source !== "system" &&
        f.source !== "user" &&
        !f.isMissing &&
        f.install_status !== "unplugged" &&
        f.install_status !== "deleted"
    );
    if (installable.length === 0) {
      showToast(t("toast.no_external_selected_install"));
      return;
    }
    try {
      // 1. 임시 활성화된 글꼴이 있다면 먼저 DB 및 OS에서 정확한 font_id와 함께 해제
      const activatedToDeactivate = installable.filter((f) => activatedFontIds.has(f.id));
      if (activatedToDeactivate.length > 0) {
        const deactivateItems = activatedToDeactivate.map((f) => ({
          font_id: f.id,
          path: f.file_path,
        }));
        try {
          await fontService.deactivateFonts(deactivateItems);
          setActivatedFontIds((prev) => {
            const next = new Set(prev);
            activatedToDeactivate.forEach((f) => next.delete(f.id));
            return next;
          });
        } catch (deactErr) {
          console.warn("일괄 설치 전 임시 활성화 해제 오류(설치 계속 진행):", deactErr);
        }
      }

      // 2. 시스템 등록 진행
      const paths = installable.map((f) => f.file_path);
      const result = await fontService.installFonts(paths);
      showToast(formatBatchInstallFeedback(result, t));
      setActivatedFontIds((prev) => {
        const next = new Set(prev);
        installable.forEach((f) => next.delete(f.id));
        return next;
      });
      handleClearSelection();
      if (refreshList) {
        await refreshList();
      } else {
        await loadSystemFonts();
      }
    } catch (err) {
      showToast(t("toast.install_failed", { error: formatErrorMessage(err, t) }));
    }
  }, [
    activatedFontIds,
    filteredFonts,
    handleClearSelection,
    loadSystemFonts,
    refreshList,
    selectedFontIds,
    setActivatedFontIds,
    showToast,
    t,
  ]);

  // 일괄 삭제
  const handleBulkUninstall = useCallback(
    async (targetFonts?: FontMetadata[]) => {
      const candidateFonts = targetFonts || filteredFonts.filter((f) => selectedFontIds.has(f.id));
      const uninstallable = candidateFonts.filter((f) => f.source === "user");
      if (uninstallable.length === 0) {
        showToast(t("toast.no_user_selected_uninstall"));
        return;
      }
      try {
        const paths = uninstallable.map((f) => f.file_path);
        const result = await fontService.uninstallFonts(paths);
        showToast(formatBatchUninstallFeedback(result, t));
        handleClearSelection();
        if (refreshList) {
          await refreshList();
        } else {
          await loadSystemFonts();
        }
      } catch (err) {
        showToast(t("toast.uninstall_failed", { error: formatErrorMessage(err, t) }));
      }
    },
    [filteredFonts, handleClearSelection, loadSystemFonts, refreshList, selectedFontIds, showToast, t]
  );

  return {
    handleBulkInstall,
    handleBulkUninstall,
  };
}
