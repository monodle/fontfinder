import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata, FontSet } from "../../types/font";
import { fontService } from "../../services/fontService";
import { getRandomLibraryColor } from "../../config/colorPresets";
import { calculateOrderBetween } from "../../utils/orderUtils";
import { formatErrorMessage } from "../../utils/batchFeedback";
import type { ToastVariant } from "../../components/common/Toast";

export interface UseFontSetActionsProps {
  fonts: FontMetadata[];
  sets: FontSet[];
  setSets: React.Dispatch<React.SetStateAction<FontSet[]>>;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  refreshSets?: () => Promise<FontSet[] | void>;
  refreshSetCount?: (targetSetId?: number) => Promise<void>;
  loadDbState: () => Promise<void>;
  handleClearSelection: () => void;
  showToast: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFontSetActions({
  fonts,
  sets,
  setSets,
  activeCategory,
  setActiveCategory,
  refreshSets,
  refreshSetCount,
  loadDbState,
  handleClearSelection,
  showToast,
}: UseFontSetActionsProps) {
  const { t } = useTranslation();

  // 세트 생성
  const handleCreateSet = useCallback(
    async (name: string, color?: string, parentId?: number | null) => {
      try {
        const finalColor = color || getRandomLibraryColor();
        // 동일 부모(형제) 목록의 첫 번째 항목 앞 키 계산 (신규 생성 세트 상단 배치)
        const siblings = sets.filter((s) => (s.parent_id ?? null) === (parentId ?? null));
        const firstKey = siblings[0]?.sort_order ?? null;
        const initialOrder = calculateOrderBetween(null, firstKey);

        const newSet = await fontService.createSet(name, finalColor, parentId, initialOrder);
        setSets((prev) => [newSet, ...prev]);
        setActiveCategory(`set:${newSet.id}`);
      } catch (err) {
        console.error("세트 생성 실패:", err);
      }
    },
    [setActiveCategory, setSets, sets]
  );

  // 세트 삭제 (부모 삭제 시 자식 세트도 CASCADE 정리 및 선택 카테고리 초기화)
  const handleDeleteSet = useCallback(
    async (setId: number) => {
      try {
        await fontService.deleteSet(setId);
        const deletedChildIds = new Set<number>();
        setSets((prev) => {
          const children = prev.filter((s) => s.parent_id === setId);
          children.forEach((c) => deletedChildIds.add(c.id));
          return prev.filter((s) => s.id !== setId && s.parent_id !== setId);
        });
        if (
          activeCategory === `set:${setId}` ||
          (activeCategory.startsWith("set:") &&
            deletedChildIds.has(Number(activeCategory.replace("set:", ""))))
        ) {
          setActiveCategory("all");
        }
      } catch (err) {
        console.error("세트 삭제 실패:", err);
      }
    },
    [activeCategory, setActiveCategory, setSets]
  );

  // 단일 세트에 폰트 추가
  const handleAddToSet = useCallback(
    async (setId: number, fontId: number) => {
      try {
        const targetFont = fonts.find((f) => f.id === fontId);
        await fontService.addFontToSet(setId, fontId);
        if (refreshSetCount) {
          await refreshSetCount(setId);
        } else if (refreshSets) {
          await refreshSets();
        } else {
          await loadDbState();
        }
        showToast(
          t("toast.added_to_set", {
            name: targetFont?.full_name || t("font_item.badge_external"),
          })
        );
      } catch (err) {
        console.error("세트에 추가 실패:", err);
      }
    },
    [fonts, loadDbState, refreshSetCount, refreshSets, showToast, t]
  );

  // 일괄 세트 추가
  const handleBulkAddToSet = useCallback(
    async (setId: number, fontIds: number[]) => {
      try {
        if (fontIds.length > 0) {
          await fontService.addFontsToSetBulk(setId, fontIds);
        }
        if (refreshSetCount) {
          await refreshSetCount(setId);
        } else if (refreshSets) {
          await refreshSets();
        } else {
          await loadDbState();
        }
        handleClearSelection();
        showToast(
          t("toast.bulk_added_to_set", {
            count: fontIds.length,
          })
        );
      } catch (err) {
        console.error("일괄 세트 추가 실패:", err);
      }
    },
    [handleClearSelection, loadDbState, refreshSetCount, refreshSets, showToast, t]
  );

  // 단일 세트에서 폰트 제거
  const handleRemoveFromSet = useCallback(
    async (setId: number, fontId: number) => {
      try {
        const targetFont = fonts.find((f) => f.id === fontId);
        await fontService.removeFontFromSet(setId, fontId);
        if (refreshSetCount) {
          await refreshSetCount(setId);
        } else if (refreshSets) {
          await refreshSets();
        } else {
          await loadDbState();
        }
        handleClearSelection();
        showToast(
          t("toast.removed_from_set", {
            name: targetFont?.full_name || t("font_item.badge_external"),
          })
        );
      } catch (err) {
        console.error("서재에서 제거 실패:", err);
        const localizedErr = formatErrorMessage(err, t);
        showToast(
          t("toast.remove_from_set_failed", {
            error: localizedErr,
          })
        );
      }
    },
    [fonts, handleClearSelection, loadDbState, refreshSetCount, refreshSets, showToast, t]
  );

  // 일괄 세트에서 폰트 제거
  const handleBulkRemoveFromSet = useCallback(
    async (setId: number, fontIds: number[]) => {
      try {
        if (fontIds.length > 0) {
          await fontService.removeFontsFromSetBulk(setId, fontIds);
        }
        if (refreshSetCount) {
          await refreshSetCount(setId);
        } else if (refreshSets) {
          await refreshSets();
        } else {
          await loadDbState();
        }
        handleClearSelection();
        showToast(
          t("toast.bulk_removed_from_set", {
            count: fontIds.length,
          })
        );
      } catch (err) {
        console.error("일괄 서재 제거 실패:", err);
        const localizedErr = formatErrorMessage(err, t);
        showToast(
          t("toast.remove_from_set_failed", {
            error: localizedErr,
          })
        );
      }
    },
    [handleClearSelection, loadDbState, refreshSetCount, refreshSets, showToast, t]
  );

  return {
    handleCreateSet,
    handleDeleteSet,
    handleAddToSet,
    handleBulkAddToSet,
    handleRemoveFromSet,
    handleBulkRemoveFromSet,
  };
}
