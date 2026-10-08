import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CustomFolder } from "../../types/font";
import { fontService } from "../../services/fontService";
import { ToastVariant } from "../../components/common/Toast";

interface UseFolderLibraryProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  folderCounts: Map<string, number>;
  loadDbState: () => Promise<void>;
  onToast?: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFolderLibrary({
  activeCategory,
  setActiveCategory,
  folderCounts,
  loadDbState,
  onToast,
}: UseFolderLibraryProps) {
  const { t } = useTranslation();
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const customFoldersRef = useRef<CustomFolder[]>(customFolders);
  useEffect(() => {
    customFoldersRef.current = customFolders;
  }, [customFolders]);

  // 실시간 계산된 고유 폰트 수가 반영된 폴더 목록
  const enrichedCustomFolders = useMemo(() => {
    return customFolders.map((folder) => {
      const liveCount = folderCounts.get(folder.path);
      const resolvedCount =
        folder.isScanning
          ? (folder.count ?? 0)
          : liveCount !== undefined && liveCount > 0
            ? liveCount
            : (folder.count ?? liveCount ?? 0);
      return {
        ...folder,
        count: resolvedCount,
      };
    });
  }, [customFolders, folderCounts]);

  // 폴더 위치 재지정 (Relink)
  const handleRelinkFolder = useCallback(async (oldPath: string, newPath: string, newName?: string) => {
    try {
      await fontService.relinkFolder(oldPath, newPath, newName);
      await loadDbState();
      onToast?.(t("toast.folder_relinked"));
      return true;
    } catch (err) {
      console.error("폴더 재연결 실패:", err);
      onToast?.(t("toast.folder_relink_failed"));
      return false;
    }
  }, [loadDbState, onToast, t]);

  // 폴더 및 관련 데이터 완전 제거
  const handleRemoveFolderWithData = useCallback(async (path: string) => {
    try {
      await fontService.removeFolderWithData(path);
      await loadDbState();
      if (activeCategory === `folder:${path}`) {
        setActiveCategory("all");
      }
      onToast?.(t("toast.folder_removed"));
      return true;
    } catch (err) {
      console.error("폴더 삭제 실패:", err);
      return false;
    }
  }, [activeCategory, loadDbState, onToast, setActiveCategory, t]);

  // 감시 폴더 색상 변경
  const handleUpdateFolderColor = useCallback(async (folderId: number, color: string) => {
    try {
      await fontService.updateFolderColor(folderId, color);
      setCustomFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, color } : f)));
      return true;
    } catch (err) {
      console.error("폴더 색상 변경 실패:", err);
      return false;
    }
  }, []);

  return {
    customFolders,
    setCustomFolders,
    customFoldersRef,
    enrichedCustomFolders,
    handleRelinkFolder,
    handleRemoveFolderWithData,
    handleUpdateFolderColor,
  };
}
