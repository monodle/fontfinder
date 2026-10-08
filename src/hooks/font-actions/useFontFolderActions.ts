import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { FontMetadata, CustomFolder, FontSet } from "../../types/font";
import { fontService } from "../../services/fontService";
import { getRandomLibraryColor } from "../../config/colorPresets";
import { isPathInFolder, normalizePath } from "../../utils/pathUtils";
import { calculateOrderBetween } from "../../utils/orderUtils";
import { formatErrorMessage } from "../../utils/batchFeedback";
import { nativeDialogSinglePathSchema } from "../../schemas";
import type { ToastVariant } from "../../components/common/Toast";

export interface UseFontFolderActionsProps {
  fonts: FontMetadata[];
  setFonts: React.Dispatch<React.SetStateAction<FontMetadata[]>>;
  customFoldersRef: React.MutableRefObject<CustomFolder[]>;
  setCustomFolders: React.Dispatch<React.SetStateAction<CustomFolder[]>>;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  activatedFontIds: Set<number>;
  setActivatedFontIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  refreshSets?: () => Promise<FontSet[] | void>;
  loadDbState: () => Promise<void>;
  setIsLoading: (loading: boolean) => void;
  showToast: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFontFolderActions({
  fonts,
  setFonts,
  customFoldersRef,
  setCustomFolders,
  activeCategory,
  setActiveCategory,
  activatedFontIds,
  setActivatedFontIds,
  refreshSets,
  loadDbState,
  setIsLoading,
  showToast,
}: UseFontFolderActionsProps) {
  const { t } = useTranslation();

  // 여러 폴더 경로 일괄 추가 (드래그앤드롭 및 탐색기 공용)
  const handleAddFoldersByPaths = useCallback(
    async (paths: string[]) => {
      if (!paths || paths.length === 0) return;

      try {
        // 1. 경로 유효성 및 디렉토리 판별 (Rust 백엔드 커맨드)
        const pathInfos = await fontService.checkPaths(paths);
        const dirInfos = pathInfos.filter((info) => info.exists && info.is_dir);

        if (dirInfos.length === 0) {
          showToast(t("toast.drop_folder_only"));
          return;
        }

        // 2. 이미 존재하는 폴더 필터링
        const existingPaths = new Set(customFoldersRef.current.map((f) => normalizePath(f.path)));
        const newDirs = dirInfos.filter((d) => !existingPaths.has(normalizePath(d.path)));

        // 모든 폴더가 이미 등록되어 있는 경우
        if (newDirs.length === 0) {
          const firstExisting = dirInfos[0];
          setActiveCategory(`folder:${firstExisting.path}`);
          showToast(
            t("toast.folder_already_exists", {
              name: firstExisting.name,
            })
          );
          return;
        }

        setIsLoading(true);

        // 1. 낙관적 UI (Optimistic UI): 사이드바에 '스캔 중' 상태로 폴더 즉시 추가
        const optimisticFolders: CustomFolder[] = newDirs.map((dir) => {
          const folderName = dir.name || dir.path.split(/[\\/]/).pop() || dir.path;
          return {
            path: dir.path,
            name: folderName,
            color: getRandomLibraryColor(),
            count: 0,
            isScanning: true,
          };
        });

        setCustomFolders((prev) => [
          ...prev.filter((f) => !newDirs.some((d) => normalizePath(d.path) === normalizePath(f.path))),
          ...optimisticFolders,
        ]);

        // 사용자가 스캔 과정을 바로 확인할 수 있도록 마지막 추가 폴더로 즉시 포커스
        if (optimisticFolders.length > 0) {
          setActiveCategory(`folder:${optimisticFolders[optimisticFolders.length - 1].path}`);
        }

        const newFoldersToAdd: CustomFolder[] = [];
        const allNewFonts: FontMetadata[] = [];

        for (const dir of newDirs) {
          const folderName = dir.name || dir.path.split(/[\\/]/).pop() || dir.path;
          const matchingOptimistic = optimisticFolders.find((f) => normalizePath(f.path) === normalizePath(dir.path));
          const folderColor = matchingOptimistic?.color || getRandomLibraryColor();

          try {
            const folderFonts = await fontService.scanDirectory(dir.path);
            const lastFolder = customFoldersRef.current[customFoldersRef.current.length - 1];
            const sortOrder = calculateOrderBetween(lastFolder?.sort_order, null);
            const dbFolder = await fontService.addFolder(dir.path, folderName, folderColor, sortOrder);
            const folderCount = folderFonts.length;

            const finalizedFolder: CustomFolder = {
              id: dbFolder.id,
              path: dir.path,
              name: folderName,
              color: dbFolder.color || folderColor,
              count: folderCount,
              sort_order: dbFolder.sort_order,
              isScanning: false,
              scanProgress: undefined,
            };

            newFoldersToAdd.push(finalizedFolder);
            allNewFonts.push(...folderFonts);

            // 해당 폴더의 폰트 즉시 목록에 병합
            if (folderFonts.length > 0) {
              setFonts((prev) => {
                const existingFontPaths = new Set(prev.map((f) => f.file_path));
                const freshFonts = folderFonts.filter((f) => !existingFontPaths.has(f.file_path));
                return freshFonts.length > 0 ? [...prev, ...freshFonts] : prev;
              });
            }

            // 해당 폴더 상태 개별 즉시 완료 반영
            setCustomFolders((prev) =>
              prev.map((f) => (normalizePath(f.path) === normalizePath(dir.path) ? finalizedFolder : f))
            );

            await fontService.watchFolder(dir.path);
          } catch (dirErr) {
            console.error(`폴더(${dir.path}) 스캔/추가 실패:`, dirErr);
            // 실패 시 낙관적 임시 폴더 제거
            setCustomFolders((prev) => prev.filter((f) => normalizePath(f.path) !== normalizePath(dir.path)));
            throw dirErr;
          }
        }

        // 6. 완료 토스트 알림
        if (newFoldersToAdd.length === 1) {
          const added = newFoldersToAdd[0];
          showToast(t("toast.folder_added", { name: added.name, count: added.count }));
        } else {
          showToast(
            t("toast.folders_added", {
              count: newFoldersToAdd.length,
              fontCount: allNewFonts.length,
            })
          );
        }
      } catch (error) {
        console.error("폴더 추가 실패:", error);
        showToast(t("toast.folder_scan_failed", { error: formatErrorMessage(error, t) }));
      } finally {
        setIsLoading(false);
      }
    },
    [activatedFontIds, customFoldersRef, setActiveCategory, setCustomFolders, setFonts, setIsLoading, showToast, t]
  );

  // 폴더 추가 다이얼로그
  const handleAddFolder = useCallback(async () => {
    try {
      const raw = await open({
        directory: true,
        multiple: false,
        title: t("toast.folder_dialog_title"),
      });

      const selected = nativeDialogSinglePathSchema.parse(raw);
      if (!selected) {
        return;
      }

      await handleAddFoldersByPaths([selected]);
    } catch (error) {
      console.error("폴더 다이얼로그 실패:", error);
    }
  }, [handleAddFoldersByPaths, t]);

  // 사이드바 폴더 선택 (필요 시 보충 스캔)
  const handleSelectFolder = useCallback(
    async (folderPath: string) => {
      setActiveCategory(`folder:${folderPath}`);
      const hasFonts = fonts.some((f) => isPathInFolder(f.file_path, folderPath));

      if (!hasFonts) {
        try {
          setIsLoading(true);
          setCustomFolders((prev) =>
            prev.map((f) => (normalizePath(f.path) === normalizePath(folderPath) ? { ...f, isScanning: true } : f))
          );
          const folderFonts = await fontService.scanDirectory(folderPath);
          setFonts((prev) => {
            const existingPaths = new Set(prev.map((f) => f.file_path));
            const newOnes = folderFonts.filter((f) => !existingPaths.has(f.file_path));
            return [...prev, ...newOnes];
          });
          const folderCount = folderFonts.length;
          setCustomFolders((prev) =>
            prev.map((f) =>
              normalizePath(f.path) === normalizePath(folderPath)
                ? { ...f, count: folderCount, isScanning: false, scanProgress: undefined }
                : f
            )
          );
        } catch (err) {
          console.error("폴더 재스캔 실패:", err);
          showToast(t("toast.folder_scan_failed", { error: formatErrorMessage(err, t) }));
          setCustomFolders((prev) =>
            prev.map((f) => (normalizePath(f.path) === normalizePath(folderPath) ? { ...f, isScanning: false, scanProgress: undefined } : f))
          );
        } finally {
          setIsLoading(false);
        }
      }
    },
    [activatedFontIds, fonts, setActiveCategory, setCustomFolders, setFonts, setIsLoading, showToast, t]
  );

  // 커스텀 폴더 제거
  const handleRemoveFolder = useCallback(
    async (folderPath: string) => {
      // 1. 해당 폴더 내 폰트 수집
      const folderFonts = fonts.filter((f) => isPathInFolder(f.file_path, folderPath));
      const remainingFonts = fonts.filter((f) => !isPathInFolder(f.file_path, folderPath));

      // 2. 활성화된 폰트 처리 (다른 폴더에 복제본이 있으면 인계, 없으면 안전 해제 - Bulk 일괄 처리로 N+1 방지)
      const toDeactivate: { font_id: number; path: string }[] = [];
      const toActivate: { font_id: number; path: string }[] = [];
      const removedActiveIds = new Set<number>();
      const addedActiveIds = new Set<number>();

      for (const font of folderFonts) {
        if (activatedFontIds.has(font.id)) {
          // 다른 활성 폴더에 동일 해시 폰트가 있는지 검사
          const counterpart = font.file_hash
            ? remainingFonts.find(
              (rf) => rf.file_hash === font.file_hash && rf.font_index === font.font_index
            )
            : undefined;

          toDeactivate.push({ font_id: font.id, path: font.file_path });
          removedActiveIds.add(font.id);

          if (counterpart) {
            toActivate.push({ font_id: counterpart.id, path: counterpart.file_path });
            addedActiveIds.add(counterpart.id);
          }
        }
      }

      if (toDeactivate.length > 0) {
        void fontService.deactivateFonts(toDeactivate);
      }
      if (toActivate.length > 0) {
        void fontService.activateFonts(toActivate);
      }
      if (removedActiveIds.size > 0 || addedActiveIds.size > 0) {
        setActivatedFontIds((prev) => {
          const next = new Set(prev);
          removedActiveIds.forEach((id) => next.delete(id));
          addedActiveIds.forEach((id) => next.add(id));
          return next;
        });
      }

      // 3. 백엔드 폴더 삭제 (세트/즐겨찾기 보존 캐시는 백엔드에서 유지됨)
      await fontService.removeFolder(folderPath);

      // 4. 프론트엔드 상태 갱신
      setCustomFolders((prev) => prev.filter((f) => f.path !== folderPath));
      setFonts(remainingFonts);
      void fontService.unwatchFolder(folderPath);

      if (activeCategory === `folder:${folderPath}`) {
        setActiveCategory("all");
      }

      if (refreshSets) {
        await refreshSets();
      }

      showToast(t("toast.folder_removed"));
    },
    [activatedFontIds, activeCategory, fonts, refreshSets, setActiveCategory, setActivatedFontIds, setCustomFolders, setFonts, showToast, t]
  );

  // 폴더 위치 재지정 (새 위치 찾기)
  const handleRelinkFolder = useCallback(
    async (oldPath: string) => {
      try {
        const raw = await open({
          directory: true,
          multiple: false,
          title: t("folder.relink_dialog_title"),
        });

        const selected = nativeDialogSinglePathSchema.parse(raw);
        if (!selected) {
          return;
        }

        setIsLoading(true);
        const folderName = selected.split(/[\\/]/).pop() || selected;
        await fontService.relinkFolder(oldPath, selected, folderName);
        await loadDbState();
        showToast(t("toast.folder_relinked"));
      } catch (err) {
        console.error("폴더 재연결 실패:", err);
        showToast(t("toast.folder_relink_failed"));
      } finally {
        setIsLoading(false);
      }
    },
    [loadDbState, setIsLoading, showToast, t]
  );

  // 폴더 및 관련 데이터 완전 제거
  const handleRemoveFolderWithData = useCallback(
    async (folderPath: string) => {
      try {
        await fontService.removeFolderWithData(folderPath);
        setCustomFolders((prev) => prev.filter((f) => f.path !== folderPath));
        setFonts((prev) => prev.filter((f) => !isPathInFolder(f.file_path, folderPath)));
        if (activeCategory === `folder:${folderPath}`) {
          setActiveCategory("all");
        }
        await loadDbState();
        showToast(t("toast.folder_removed"));
      } catch (err) {
        console.error("폴더 완전 제거 실패:", err);
      }
    },
    [activeCategory, loadDbState, setActiveCategory, setCustomFolders, setFonts, showToast, t]
  );

  return {
    handleAddFoldersByPaths,
    handleAddFolder,
    handleSelectFolder,
    handleRemoveFolder,
    handleRelinkFolder,
    handleRemoveFolderWithData,
  };
}
