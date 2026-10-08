import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { FontMetadata, CustomFolder, FontSet } from "../../types/font";
import { ToastVariant } from "../../components/common/Toast";
import { fontService } from "../../services/fontService";
import { isPathInFolder, normalizePath } from "../../utils/pathUtils";
import { getFolderFontCount } from "../../utils/fontQueryEngine";
import { DEFAULT_FOLDER_COLOR } from "../../config/colorPresets";
import { STORAGE_KEYS } from "../../config/storageKeys";
import {
  fontScanProgressPayloadSchema,
  folderScanProgressPayloadSchema,
  folderPathEventPayloadSchema,
  legacyCustomFolderListSchema,
} from "../../schemas";
import { formatErrorMessage } from "../../utils/batchFeedback";

interface UseFontSyncEventsProps {
  customFoldersRef: React.MutableRefObject<CustomFolder[]>;
  setFonts: React.Dispatch<React.SetStateAction<FontMetadata[]>>;
  setCustomFolders: React.Dispatch<React.SetStateAction<CustomFolder[]>>;
  setFavoriteIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  setActivatedFontIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  setIsLoading: (loading: boolean) => void;
  setScanProgress: (progress: { current: number; total: number } | null) => void;
  refreshSets: () => Promise<FontSet[]>;
  onToast?: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useFontSyncEvents({
  customFoldersRef,
  setFonts,
  setCustomFolders,
  setFavoriteIds,
  setActivatedFontIds,
  setIsLoading,
  setScanProgress,
  refreshSets,
  onToast,
}: UseFontSyncEventsProps) {
  const { t } = useTranslation();

  // 시스템 폰트 및 등록된 커스텀 폴더 폰트 통합 동기화 (증분 캐시 지원)
  const loadSystemFonts = useCallback(async (foldersToScan?: CustomFolder[], forceRescan?: boolean) => {
    setIsLoading(true);
    const targetFolders = foldersToScan ?? customFoldersRef.current;
    const validPaths = targetFolders
      .filter((f) => !f.isMissing)
      .map((f) => f.path);

    try {
      const syncedFonts = await fontService.syncFontLibrary(validPaths, forceRescan);

      // 연결 끊김(isMissing: true) 상태인 폴더의 캐시 폰트를 보존하여 병합
      let allMergedFonts = syncedFonts;
      const missingFolders = targetFolders.filter((f) => f.isMissing);
      if (missingFolders.length > 0) {
        const cached = await fontService.getCachedFonts().catch(() => []);
        const syncedPaths = new Set(syncedFonts.map((f) => f.file_path));
        const missingFolderFonts = cached.filter((f) => {
          if (syncedPaths.has(f.file_path)) return false;
          return missingFolders.some((mf) => isPathInFolder(f.file_path, mf.path));
        });
        allMergedFonts = [...syncedFonts, ...missingFolderFonts];
      }

      if (targetFolders.length > 0) {
        const updatedFolders = targetFolders.map((folder) => {
          return {
            ...folder,
            count: getFolderFontCount(allMergedFonts, folder.path),
            isMissing: folder.isMissing,
          };
        });
        setCustomFolders(updatedFolders);
      }

      setFonts(allMergedFonts);
      return allMergedFonts;
    } catch (error) {
      console.error("폰트 라이브러리 동기화 실패:", error);
      onToast?.(t("toast.folder_scan_failed", { error: formatErrorMessage(error, t) }));
      return [];
    } finally {
      setIsLoading(false);
      setScanProgress(null);
    }
  }, [customFoldersRef, onToast, setCustomFolders, setFonts, setIsLoading, setScanProgress, t]);

  // DB 상태 로드 (캐시 우선 렌더링 + 세트, 즐겨찾기, 등록 폴더, 활성화 폰트, 순서)
  const loadDbState = useCallback(async () => {
    try {
      const [cached, initialFolders] = await Promise.all([
        fontService.getCachedFonts(),
        fontService.getFolders().catch(() => []),
      ]);
      if (initialFolders && initialFolders.length > 0) {
        setCustomFolders((prev) =>
          prev.length === 0
            ? initialFolders.map((df) => ({
                id: df.id,
                path: df.path,
                name: df.name,
                color: df.color || DEFAULT_FOLDER_COLOR,
                count: 0,
                isMissing: false,
              }))
            : prev
        );
      }
      if (cached && cached.length > 0) {
        setFonts(cached);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    } catch {
      setIsLoading(true);
    }

    try {
      const [
        _sets,
        favIds,
        folderStatuses,
        activatedRecords,
      ] = await Promise.all([
        refreshSets(),
        fontService.getFavoriteFontIds(),
        fontService.checkFoldersStatus().catch(() => []),
        fontService.validateAndCleanupActivatedFonts().catch(() => []),
      ]);

      setFavoriteIds(new Set(favIds));

      if (activatedRecords && activatedRecords.length > 0) {
        const activeIds = new Set(activatedRecords.map((r) => r.font_id));
        setActivatedFontIds(activeIds);
        const items = activatedRecords.map((r) => ({ font_id: r.font_id, path: r.file_path }));
        void fontService.activateFonts(items);
      } else {
        setActivatedFontIds(new Set());
      }

      let targetFolders: CustomFolder[] = [];
      if (folderStatuses && folderStatuses.length > 0) {
        targetFolders = folderStatuses.map((fs) => ({
          id: fs.id,
          path: fs.path,
          name: fs.name,
          color: fs.color || DEFAULT_FOLDER_COLOR,
          count: 0,
          sort_order: fs.sort_order,
          isMissing: !fs.exists,
        }));
      } else {
        try {
          const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY_CUSTOM_FOLDERS);
          if (legacy) {
            const parsed = legacyCustomFolderListSchema.safeParse(JSON.parse(legacy));
            if (parsed.success && parsed.data.length > 0) {
              for (const f of parsed.data) {
                await fontService.addFolder(f.path, f.name);
              }
              targetFolders = parsed.data.map((f) => ({
                path: f.path,
                name: f.name,
                color: f.color || DEFAULT_FOLDER_COLOR,
                count: 0,
                isMissing: false,
              }));
            }
            localStorage.removeItem(STORAGE_KEYS.LEGACY_CUSTOM_FOLDERS);
          }
        } catch {
          // ignore legacy migration error
        }
      }

      setCustomFolders(targetFolders);
      targetFolders.forEach((folder) => {
        fontService.watchFolder(folder.path).catch((err) => {
          console.warn(`폴더 감시 등록 실패 (${folder.path}):`, err);
        });
      });

      await loadSystemFonts(targetFolders);
    } catch (err) {
      console.error("DB 데이터 로드 실패:", err);
      void loadSystemFonts([]);
    }
  }, [loadSystemFonts, refreshSets, setActivatedFontIds, setCustomFolders, setFavoriteIds, setFonts, setIsLoading]);

  // 실시간 폴더 감시 및 스캔 진행 이벤트 수신
  useEffect(() => {
    void loadDbState();

    const unlistenProgressPromise = listen<unknown>(
      "font-scan-progress",
      (event) => {
        const parsed = fontScanProgressPayloadSchema.safeParse(event.payload);
        if (parsed.success) {
          setScanProgress(parsed.data);
        }
      }
    );

    const unlistenFolderProgressPromise = listen<unknown>(
      "folder-scan-progress",
      (event) => {
        const parsed = folderScanProgressPayloadSchema.safeParse(event.payload);
        if (!parsed.success) return;

        const { path, current, total } = parsed.data;
        setCustomFolders((prev) =>
          prev.map((f) =>
            normalizePath(f.path) === normalizePath(path)
              ? {
                  ...f,
                  isScanning: true,
                  scanProgress: { current, total },
                }
              : f
          )
        );
      }
    );

    const unlistenChangedPromise = listen<unknown>("folder-font-changed", async (event) => {
      const parsed = folderPathEventPayloadSchema.safeParse(event.payload);
      if (!parsed.success) return;
      const changedPath = parsed.data;
      try {
        const pathInfos = await fontService.checkPaths([changedPath]).catch(() => []);
        const exists = pathInfos.length > 0 && pathInfos[0].exists && pathInfos[0].is_dir;

        if (!exists) {
          setCustomFolders((prev) =>
            prev.map((f) =>
              normalizePath(f.path) === normalizePath(changedPath) ? { ...f, isMissing: true } : f
            )
          );
          return;
        }

        setCustomFolders((prev) =>
          prev.map((f) =>
            normalizePath(f.path) === normalizePath(changedPath) ? { ...f, isScanning: true } : f
          )
        );

        // 파일 감시 이벤트 감지 시 동일 크기/수정시각 파일 교체까지 포착하기 위해 forceRescan: true 전달
        const updated = await fontService.scanDirectory(changedPath, true);
        const folderCount = updated.length;
        setCustomFolders((prev) =>
          prev.map((f) =>
            normalizePath(f.path) === normalizePath(changedPath)
              ? { ...f, count: folderCount, isMissing: false, isScanning: false, scanProgress: undefined }
              : f
          )
        );

        setFonts((prev) => {
          const existingInFolder = prev.filter((f) => isPathInFolder(f.file_path, changedPath));
          const updatedIds = new Set(updated.map((u) => u.id));
          const removedFonts = existingInFolder.filter((f) => !updatedIds.has(f.id));

          if (removedFonts.length > 0) {
            setActivatedFontIds((prevIds) => {
              const next = new Set(prevIds);
              const toDeactivate: Array<{ font_id: number; path: string }> = [];
              for (const rf of removedFonts) {
                if (next.has(rf.id)) {
                  toDeactivate.push({ font_id: rf.id, path: rf.file_path });
                  next.delete(rf.id);
                }
              }
              if (toDeactivate.length > 0) {
                void fontService.deactivateFonts(toDeactivate);
              }
              return next;
            });
          }

          const others = prev.filter((f) => !isPathInFolder(f.file_path, changedPath));
          return [...others, ...updated];
        });

        const folderName = changedPath.split(/[\\/]/).pop() || changedPath;
        onToast?.(t("toast.folder_updated", { folder: folderName }));
      } catch (err) {
        console.error("감시 폴더 자동 갱신 실패:", err);
        const folderName = changedPath.split(/[\\/]/).pop() || changedPath;
        onToast?.(t("toast.folder_scan_failed", { error: `${folderName}: ${formatErrorMessage(err, t)}` }));
        setCustomFolders((prev) =>
          prev.map((f) =>
            normalizePath(f.path) === normalizePath(changedPath)
              ? { ...f, isScanning: false, scanProgress: undefined }
              : f
          )
        );
      }
    });

    const unlistenMissingPromise = listen<unknown>("folder-missing", (event) => {
      const parsed = folderPathEventPayloadSchema.safeParse(event.payload);
      if (!parsed.success) return;
      const missingPath = parsed.data;
      setCustomFolders((prev) =>
        prev.map((f) =>
          normalizePath(f.path) === normalizePath(missingPath) ? { ...f, isMissing: true } : f
        )
      );

      const folderName = missingPath.split(/[\\/]/).pop() || missingPath;
      onToast?.(t("toast.folder_missing", { folder: folderName }));
    });

    return () => {
      unlistenProgressPromise.then((unlisten) => unlisten());
      unlistenFolderProgressPromise.then((unlisten) => unlisten());
      unlistenChangedPromise.then((unlisten) => unlisten());
      unlistenMissingPromise.then((unlisten) => unlisten());
    };
  }, [loadDbState, onToast, setActivatedFontIds, setCustomFolders, setFonts, setScanProgress, t]);

  const refreshList = useCallback(async (forceRescan = false) => {
    if (forceRescan) {
      await loadSystemFonts(undefined, true);
    } else {
      await loadDbState();
    }
  }, [loadDbState, loadSystemFonts]);

  return {
    loadSystemFonts,
    loadDbState,
    refreshList,
  };
}
