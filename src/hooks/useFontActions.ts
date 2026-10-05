import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { FontMetadata, FontSet, CustomFolder } from "../types/font";
import { fontService } from "../services/fontService";
import { getRandomLibraryColor } from "../config/colorPresets";
import { isPathInFolder, normalizePath } from "../utils/pathUtils";
import { deduplicateFonts } from "../utils/fontDeduplication";
import { formatBatchInstallFeedback, formatBatchUninstallFeedback, formatErrorMessage } from "../utils/batchFeedback";

interface UseFontActionsProps {
  fonts: FontMetadata[];
  setFonts: React.Dispatch<React.SetStateAction<FontMetadata[]>>;
  filteredFonts: FontMetadata[];
  selectedFontIds: Set<number>;
  favoriteIds: Set<number>;
  setFavoriteIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  activatedFontIds: Set<number>;
  setActivatedFontIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  sets: FontSet[];
  setSets: React.Dispatch<React.SetStateAction<FontSet[]>>;
  customFolders: CustomFolder[];
  setCustomFolders: React.Dispatch<React.SetStateAction<CustomFolder[]>>;
  customFoldersRef: React.MutableRefObject<CustomFolder[]>;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  setIsLoading: (loading: boolean) => void;
  loadSystemFonts: (foldersToScan?: CustomFolder[]) => Promise<FontMetadata[]>;
  loadDbState: () => Promise<void>;
  refreshSets?: () => Promise<any>;
  refreshList?: () => Promise<void>;
  handleClearSelection: () => void;
  showToast: (message: string) => void;
}

export function useFontActions({
  fonts,
  setFonts,
  filteredFonts,
  selectedFontIds,
  favoriteIds,
  setFavoriteIds,
  activatedFontIds,
  setActivatedFontIds,
  setSets,
  setCustomFolders,
  customFoldersRef,
  activeCategory,
  setActiveCategory,
  setIsLoading,
  loadSystemFonts,
  loadDbState,
  refreshSets,
  refreshList,
  handleClearSelection,
  showToast,
}: UseFontActionsProps) {
  const { t } = useTranslation();

  // 즐겨찾기 토글 (단일 정수 ID 기반 직관적 토글)
  const handleToggleFavorite = useCallback(
    async (fontId: number) => {
      try {
        const isCurrentFav = favoriteIds.has(fontId);
        await fontService.toggleFavorite(fontId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isCurrentFav) {
            next.delete(fontId);
          } else {
            next.add(fontId);
          }
          return next;
        });
      } catch (err) {
        console.error("즐겨찾기 토글 실패:", err);
      }
    },
    [favoriteIds, setFavoriteIds]
  );

  // 일괄 즐겨찾기 변경
  const handleBulkFavorite = useCallback(
    async (fontIds: number[], add: boolean) => {
      try {
        const toProcess = fontIds.filter((id) => (add ? !favoriteIds.has(id) : favoriteIds.has(id)));
        if (toProcess.length > 0) {
          await fontService.setFavoritesBulk(toProcess, add);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (add) {
              toProcess.forEach((id) => next.add(id));
            } else {
              toProcess.forEach((id) => next.delete(id));
            }
            return next;
          });
        }
        handleClearSelection();
      } catch (err) {
        console.error("일괄 즐겨찾기 변경 실패:", err);
      }
    },
    [favoriteIds, handleClearSelection, setFavoriteIds]
  );

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
      if (!isCurrentlyActive && (font.format === "Woff" || font.format === "Woff2")) {
        showToast(t("toast.woff_activate_unsupported"));
        return;
      }
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
          f.install_status !== "deleted" &&
          (activate ? f.format !== "Woff" && f.format !== "Woff2" : true)
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

  // 일괄 설치 (설치 전 임시 활성화 해제 시 font_id 정확히 매핑하여 DB 고아 레코드 방지)
  const handleBulkInstall = useCallback(async () => {
    const selectedFonts = filteredFonts.filter((f) => selectedFontIds.has(f.id));
    const installable = selectedFonts.filter(
      (f) =>
        f.source !== "system" &&
        f.source !== "user" &&
        !f.isMissing &&
        f.install_status !== "unplugged" &&
        f.install_status !== "deleted" &&
        f.format !== "Woff" &&
        f.format !== "Woff2"
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
  const handleBulkUninstall = useCallback(async (targetFonts?: FontMetadata[]) => {
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
  }, [filteredFonts, handleClearSelection, loadSystemFonts, refreshList, selectedFontIds, showToast, t]);

  // 세트 생성
  const handleCreateSet = useCallback(
    async (name: string, color?: string, parentId?: number | null) => {
      try {
        const finalColor = color || getRandomLibraryColor();
        const newSet = await fontService.createSet(name, finalColor, parentId);
        setSets((prev) => {
          const next = [newSet, ...prev];
          void fontService.setSetting("set_order", JSON.stringify(next.map((s) => s.id)));
          return next;
        });
        setActiveCategory(`set:${newSet.id}`);
      } catch (err) {
        console.error("세트 생성 실패:", err);
      }
    },
    [setActiveCategory, setSets]
  );

  // 세트 삭제 (부모 삭제 시 자식 세트도 CASCADE 정리)
  const handleDeleteSet = useCallback(
    async (setId: number) => {
      try {
        await fontService.deleteSet(setId);
        let deletedChildIds = new Set<number>();
        setSets((prev) => {
          const children = prev.filter((s) => s.parent_id === setId);
          children.forEach((c) => deletedChildIds.add(c.id));
          const next = prev.filter((s) => s.id !== setId && s.parent_id !== setId);
          void fontService.setSetting("set_order", JSON.stringify(next.map((s) => s.id)));
          return next;
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
        if (refreshSets) {
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
    [fonts, loadDbState, refreshSets, showToast, t]
  );

  // 일괄 세트 추가
  const handleBulkAddToSet = useCallback(
    async (setId: number, fontIds: number[]) => {
      try {
        if (fontIds.length > 0) {
          await fontService.addFontsToSetBulk(setId, fontIds);
        }
        if (refreshSets) {
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
    [handleClearSelection, loadDbState, refreshSets, showToast, t]
  );

  // 단일 세트에서 폰트 제거
  const handleRemoveFromSet = useCallback(
    async (setId: number, fontId: number) => {
      try {
        const targetFont = fonts.find((f) => f.id === fontId);
        await fontService.removeFontFromSet(setId, fontId);
        if (refreshSets) {
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
    [fonts, handleClearSelection, loadDbState, refreshSets, showToast, t]
  );

  // 일괄 세트에서 폰트 제거
  const handleBulkRemoveFromSet = useCallback(
    async (setId: number, fontIds: number[]) => {
      try {
        if (fontIds.length > 0) {
          await fontService.removeFontsFromSetBulk(setId, fontIds);
        }
        if (refreshSets) {
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
    [handleClearSelection, loadDbState, refreshSets, showToast, t]
  );

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
            const dbFolder = await fontService.addFolder(dir.path, folderName, folderColor);
            const uniqueFolderCount = deduplicateFonts(folderFonts, activatedFontIds).length;

            const finalizedFolder: CustomFolder = {
              id: dbFolder.id,
              path: dir.path,
              name: folderName,
              color: dbFolder.color || folderColor,
              count: uniqueFolderCount,
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

        // 전체 서재 폴더 순서 저장
        setCustomFolders((prev) => {
          void fontService.setSetting("folder_order", JSON.stringify(prev.map((f) => f.path)));
          return prev;
        });

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
    [activatedFontIds, customFoldersRef, getRandomLibraryColor, setActiveCategory, setCustomFolders, setFonts, setIsLoading, showToast, t]
  );

  // 폴더 추가 다이얼로그
  const handleAddFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("toast.folder_dialog_title"),
      });

      if (!selected || typeof selected !== "string") {
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
          const uniqueCount = deduplicateFonts(folderFonts, activatedFontIds).length;
          setCustomFolders((prev) =>
            prev.map((f) =>
              normalizePath(f.path) === normalizePath(folderPath)
                ? { ...f, count: uniqueCount, isScanning: false, scanProgress: undefined }
                : f
            )
          );
        } catch (err) {
          console.error("폴더 재스캔 실패:", err);
          setCustomFolders((prev) =>
            prev.map((f) => (normalizePath(f.path) === normalizePath(folderPath) ? { ...f, isScanning: false, scanProgress: undefined } : f))
          );
        } finally {
          setIsLoading(false);
        }
      }
    },
    [activatedFontIds, fonts, setActiveCategory, setCustomFolders, setFonts, setIsLoading]
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
      setCustomFolders((prev) => {
        const next = prev.filter((f) => f.path !== folderPath);
        void fontService.setSetting("folder_order", JSON.stringify(next.map((f) => f.path)));
        return next;
      });
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
        const selected = await open({
          directory: true,
          multiple: false,
          title: t("folder.relink_dialog_title"),
        });

        if (!selected || typeof selected !== "string") {
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
        setCustomFolders((prev) => {
          const next = prev.filter((f) => f.path !== folderPath);
          void fontService.setSetting("folder_order", JSON.stringify(next.map((f) => f.path)));
          return next;
        });
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
    handleToggleFavorite,
    handleBulkFavorite,
    handleToggleActivate,
    handleBulkActivate,
    handleBulkInstall,
    handleBulkUninstall,
    handleCreateSet,
    handleDeleteSet,
    handleAddToSet,
    handleBulkAddToSet,
    handleRemoveFromSet,
    handleBulkRemoveFromSet,
    handleAddFolder,
    handleAddFoldersByPaths,
    handleSelectFolder,
    handleRemoveFolder,
    handleRelinkFolder,
    handleRemoveFolderWithData,
  };
}
