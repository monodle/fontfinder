import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata } from "../../types/font";
import { fontService } from "../../services/fontService";
import { formatErrorMessage } from "../../utils/batchFeedback";
import type { ToastVariant } from "../../components/common/Toast";

export interface UseFontActivationActionsProps {
  fonts: FontMetadata[];
  activatedFontIds: Set<number>;
  setActivatedFontIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  handleClearSelection: () => void;
  showToast: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFontActivationActions({
  fonts,
  activatedFontIds,
  setActivatedFontIds,
  handleClearSelection,
  showToast,
}: UseFontActivationActionsProps) {
  const { t } = useTranslation();

  // 단일 폰트 임시 활성화/비활성화
  const handleToggleActivate = useCallback(
    async (font: FontMetadata) => {
      if (font.source === "system" || font.source === "user") {
        showToast(t("toast.already_installed"));
        return;
      }
      if (font.install_status === "deleted") {
        showToast(t("toast.deleted_activate_error"));
        return;
      }
      if (font.isMissing || font.install_status === "unplugged") {
        showToast(t("toast.unplugged_activate_error"));
        return;
      }
      const isCurrentlyActive = activatedFontIds.has(font.id);
      try {
        if (isCurrentlyActive) {
          await fontService.deactivateFont(font.file_path, font.id);
          setActivatedFontIds((prev) => {
            const next = new Set(prev);
            next.delete(font.id);
            return next;
          });
          showToast(t("toast.deactivated", { name: font.family_name }));
        } else {
          await fontService.activateFont(font.file_path, font.id);
          setActivatedFontIds((prev) => {
            const next = new Set(prev);
            next.add(font.id);
            return next;
          });
          showToast(t("toast.activated", { name: font.family_name }));
        }
      } catch (err) {
        showToast(t("toast.activate_failed", { error: formatErrorMessage(err, t) }));
      }
    },
    [activatedFontIds, setActivatedFontIds, showToast, t]
  );

  // 일괄 임시 활성화/비활성화
  const handleBulkActivate = useCallback(
    async (fontIds: number[], activate: boolean) => {
      const targetFonts = fonts.filter(
        (f) =>
          fontIds.includes(f.id) &&
          f.source !== "system" &&
          f.source !== "user" &&
          !f.isMissing &&
          f.install_status !== "unplugged" &&
          f.install_status !== "deleted"
      );
      if (targetFonts.length === 0) {
        showToast(t("toast.no_external_selected_activate"));
        return;
      }
      try {
        const items = targetFonts.map((f) => ({ font_id: f.id, path: f.file_path }));
        if (activate) {
          const count = await fontService.activateFonts(items);
          setActivatedFontIds((prev) => {
            const next = new Set(prev);
            targetFonts.forEach((f) => next.add(f.id));
            return next;
          });
          showToast(t("toast.bulk_activated", { count }));
        } else {
          const count = await fontService.deactivateFonts(items);
          setActivatedFontIds((prev) => {
            const next = new Set(prev);
            targetFonts.forEach((f) => next.delete(f.id));
            return next;
          });
          showToast(t("toast.bulk_deactivated", { count }));
        }
        handleClearSelection();
      } catch (err) {
        showToast(t("toast.bulk_activate_failed", { error: formatErrorMessage(err, t) }));
      }
    },
    [fonts, handleClearSelection, setActivatedFontIds, showToast, t]
  );

  return {
    handleToggleActivate,
    handleBulkActivate,
  };
}
