import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import {
  FontMetadata,
  FontSet,
  CustomFolder,
  FontLibraryTag,
  FontInstallStatus,
  FontVersionStatus,
} from "../types/font";
import { fontService } from "../services/fontService";
import { isPathInFolder, normalizePath } from "../utils/pathUtils";
import { sortFonts } from "../utils/fontSortUtils";
import { deduplicateFonts, getFontUniqueKey } from "../utils/fontDeduplication";
import { matchesFontSearch } from "../utils/fontLocalization";
import { FontSortSettings, DEFAULT_SORT_SETTINGS } from "../types/sort";

interface UseFontLibraryProps {
  defaultCategory?: string;
  sortSettings?: FontSortSettings;
  onToast?: (message: string) => void;
}

export function useFontLibrary({
  defaultCategory = "all",
  sortSettings = DEFAULT_SORT_SETTINGS,
  onToast,
}: UseFontLibraryProps = {}) {
  const { t, i18n } = useTranslation();
  const [fonts, setFonts] = useState<FontMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory);
  const activeCategoryRef = useRef<string>(activeCategory);
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);
  const [searchQuery, setSearchQuery] = useState("");

  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const customFoldersRef = useRef<CustomFolder[]>(customFolders);
  useEffect(() => {
    customFoldersRef.current = customFolders;
  }, [customFolders]);

  const [sets, setSets] = useState<FontSet[]>([]);
  const [setMap, setSetMap] = useState<Map<number, Set<number>>>(new Map());
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [activatedFontIds, setActivatedFontIds] = useState<Set<number>>(new Set());
  const [setFontIds, setSetFontIds] = useState<Set<number>>(new Set());
  const [unpluggedFonts, setUnpluggedFonts] = useState<FontMetadata[]>([]);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);

  // 시스템 폰트 및 등록된 커스텀 폴더 폰트 통합 동기화 (증분 캐시 지원)
  const loadSystemFonts = useCallback(async (foldersToScan?: CustomFolder[]) => {
    setIsLoading(true);
    const targetFolders = foldersToScan ?? customFoldersRef.current;
    const validPaths = targetFolders
      .filter((f) => !f.isMissing)
      .map((f) => f.path);

    try {
      const syncedFonts = await fontService.syncFontLibrary(validPaths);

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
          const folderFonts = allMergedFonts.filter((f) => isPathInFolder(f.file_path, folder.path));
          const uniqueFolderFonts = deduplicateFonts(folderFonts);
          return {
            ...folder,
            count: uniqueFolderFonts.length,
            isMissing: folder.isMissing,
          };
        });
        setCustomFolders(updatedFolders);
      }

      setFonts(allMergedFonts);
      return allMergedFonts;
    } catch (error) {
      console.error("폰트 라이브러리 동기화 실패:", error);
      return [];
    } finally {
      setIsLoading(false);
      setScanProgress(null);
    }
  }, []);

  // 서재(세트) 목록 및 폰트 매핑 즉각 동기화 (개수 및 리스트 즉시 갱신)
  const refreshSets = useCallback(async () => {
    try {
      const [fetchedSets, setOrderJson] = await Promise.all([
        fontService.getSets(),
        fontService.getSetting("set_order").catch(() => null),
      ]);

      // 서재 세트 순서 복원
      if (setOrderJson) {
        try {
          const order: number[] = JSON.parse(setOrderJson);
          const orderMap = new Map(order.map((id, idx) => [id, idx]));
          fetchedSets.sort((a, b) => {
            const hasA = orderMap.has(a.id);
            const hasB = orderMap.has(b.id);
            if (hasA && hasB) {
              return orderMap.get(a.id)! - orderMap.get(b.id)!;
            }
            if (!hasA && hasB) return -1;
            if (hasA && !hasB) return 1;
            return b.id - a.id;
          });
        } catch {
          // ignore parsing error
        }
      }
      setSets(fetchedSets);

      // 모든 세트의 폰트 ID 목록을 단일 쿼리로 일괄 로드하여 1+N 쿼리/IPC 방지
      const allSetFonts = await fontService.getAllSetFontIds().catch(() => ({} as Record<number, number[]>));
      const newSetMap = new Map<number, Set<number>>();
      for (const s of fetchedSets) {
        const ids = allSetFonts[s.id] ?? [];
        newSetMap.set(s.id, new Set(ids));
      }
      setSetMap(newSetMap);

      // 현재 활성화된 카테고리가 세트인 경우 폰트 ID 목록 즉시 갱신
      const curCategory = activeCategoryRef.current;
      if (curCategory.startsWith("set:")) {
        const currentSetId = Number(curCategory.replace("set:", ""));
        const currentIds = newSetMap.get(currentSetId) ?? new Set<number>();
        setSetFontIds(new Set(currentIds));
      }
      return fetchedSets;
    } catch (err) {
      console.warn("세트 데이터 갱신 실패:", err);
      return [];
    }
  }, []);

  // DB 상태 로드 (캐시 우선 렌더링 + 세트, 즐겨찾기, 등록 폴더, 활성화 폰트, 순서)
  const loadDbState = useCallback(async () => {
    // 1. 캐시된 폰트와 등록 폴더가 있으면 첫 화면을 즉시 렌더링 (SWR)
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
                color: df.color || "#0ea5e9",
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
        folderOrderJson,
      ] = await Promise.all([
        refreshSets(),
        fontService.getFavoriteFontIds(),
        fontService.checkFoldersStatus().catch(() => []),
        fontService.validateAndCleanupActivatedFonts().catch(() => []),
        fontService.getSetting("folder_order"),
      ]);

      setFavoriteIds(new Set(favIds));

      // 활성화된 폰트 복원 (실제 존재하는 유효한 폰트만 복원)
      if (activatedRecords && activatedRecords.length > 0) {
        const activeIds = new Set(activatedRecords.map((r) => r.font_id));
        setActivatedFontIds(activeIds);
        const items = activatedRecords.map((r) => ({ font_id: r.font_id, path: r.file_path }));
        void fontService.activateFonts(items);
      } else {
        setActivatedFontIds(new Set());
      }

      // 등록 폴더 동기화 및 마이그레이션 (checkFoldersStatus 결과로 단일화하여 중복 쿼리 방지)
      let targetFolders: CustomFolder[] = [];
      if (folderStatuses && folderStatuses.length > 0) {
        targetFolders = folderStatuses.map((fs) => ({
          id: fs.id,
          path: fs.path,
          name: fs.name,
          color: fs.color || "#0ea5e9",
          count: 0,
          isMissing: !fs.exists,
        }));
      } else {
        try {
          const legacy = localStorage.getItem("fontfinder_custom_folders");
          if (legacy) {
            const parsedLegacy: CustomFolder[] = JSON.parse(legacy);
            for (const f of parsedLegacy) {
              await fontService.addFolder(f.path, f.name);
            }
            targetFolders = parsedLegacy;
            localStorage.removeItem("fontfinder_custom_folders");
          }
        } catch {
          // ignore legacy migration error
        }
      }

      // 폴더 순서 복원
      if (folderOrderJson && targetFolders.length > 0) {
        try {
          const order: string[] = JSON.parse(folderOrderJson);
          const orderMap = new Map(order.map((p, idx) => [p, idx]));
          targetFolders.sort((a, b) => {
            const posA = orderMap.has(a.path) ? orderMap.get(a.path)! : 999999;
            const posB = orderMap.has(b.path) ? orderMap.get(b.path)! : 999999;
            return posA - posB;
          });
        } catch {
          // ignore parsing error
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
  }, [loadSystemFonts, refreshSets]);

  // 실시간 폴더 감시 및 스캔 진행 이벤트 수신
  useEffect(() => {
    void loadDbState();

    // 1. 폰트 스캔 진행률 이벤트
    const unlistenProgressPromise = listen<{ current: number; total: number }>(
      "font-scan-progress",
      (event) => {
        setScanProgress(event.payload);
      }
    );

    // 1-2. 개별 폴더 스캔 진행률 이벤트
    const unlistenFolderProgressPromise = listen<{ path: string; current: number; total: number }>(
      "folder-scan-progress",
      (event) => {
        const { path, current, total } = event.payload;
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

    // 2. 폴더 내 폰트 변경/삭제 또는 폴더 복구 이벤트
    const unlistenChangedPromise = listen<string>("folder-font-changed", async (event) => {
      const changedPath = event.payload;
      try {
        // 해당 폴더가 실제 디스크에 존재하는지 선행 확인하여 언마운트 오탐 및 폰트 증발 방지
        const pathInfos = await fontService.checkPaths([changedPath]).catch(() => []);
        const exists = pathInfos.length > 0 && pathInfos[0].exists && pathInfos[0].is_dir;

        if (!exists) {
          // 디렉터리가 부재(언마운트)한 경우 scanDirectory 호출을 건너뛰고 isMissing: true로 전환
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

        const updated = await fontService.scanDirectory(changedPath);
        const uniqueCount = deduplicateFonts(updated).length;
        setCustomFolders((prev) =>
          prev.map((f) =>
            normalizePath(f.path) === normalizePath(changedPath)
              ? { ...f, count: uniqueCount, isMissing: false, isScanning: false, scanProgress: undefined }
              : f
          )
        );

        setFonts((prev) => {
          const existingInFolder = prev.filter((f) => isPathInFolder(f.file_path, changedPath));
          const updatedIds = new Set(updated.map((u) => u.id));
          const removedFonts = existingInFolder.filter((f) => !updatedIds.has(f.id));

          // 개별 삭제된 폰트 중 임시 활성화 상태였던 것 일괄 자동 해제 (N+1 방지)
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
        setCustomFolders((prev) =>
          prev.map((f) =>
            normalizePath(f.path) === normalizePath(changedPath)
              ? { ...f, isScanning: false, scanProgress: undefined }
              : f
          )
        );
      }
    });

    // 2. 폴더 자체 부재 / 외장 드라이브 언마운트 이벤트
    const unlistenMissingPromise = listen<string>("folder-missing", (event) => {
      const missingPath = event.payload;
      setCustomFolders((prev) =>
        prev.map((f) =>
          normalizePath(f.path) === normalizePath(missingPath) ? { ...f, isMissing: true } : f
        )
      );

      // 폴더 연결이 끊기더라도 캐시된 폰트를 fonts에서 제거하지 않고 보존하여,
      // processedFonts에서 해당 폴더의 폰트들이 자동으로 언플러그드(unplugged) 상태로 렌더링되도록 함

      const folderName = missingPath.split(/[\\/]/).pop() || missingPath;
      onToast?.(t("toast.folder_missing", { folder: folderName }));
    });

    return () => {
      unlistenProgressPromise.then((unlisten) => unlisten());
      unlistenFolderProgressPromise.then((unlisten) => unlisten());
      unlistenChangedPromise.then((unlisten) => unlisten());
      unlistenMissingPromise.then((unlisten) => unlisten());
    };
  }, [loadDbState, onToast, t]);

  // 특정 세트 선택
  const handleSelectSet = useCallback(async (setId: number) => {
    try {
      const ids = await fontService.getSetFontIds(setId);
      const idSet = new Set(ids);
      setSetFontIds(idSet);
      setSetMap((prev) => {
        const next = new Map(prev);
        next.set(setId, idSet);
        return next;
      });
      setActiveCategory(`set:${setId}`);
    } catch (err) {
      console.error("세트 폰트 로드 실패:", err);
    }
  }, []);

  // 세트 또는 즐겨찾기에 등록되었으나 파일 시스템 어디에도 없는 폰트(언플러그드/삭제 폰트) 자동 감지
  useEffect(() => {
    if ((sets.length === 0 || setMap.size === 0) && favoriteIds.size === 0) {
      setUnpluggedFonts([]);
      return;
    }

    const currentFontIds = new Set<number>();
    for (const f of fonts) {
      // 시스템/사용자 폰트이거나 현재 등록된 감시 폴더(customFolders)에 실제로 속한 외부 폰트만 유효 활성 키로 간주
      const isValidActive =
        f.source === "system" ||
        f.source === "user" ||
        customFolders.some((cf) => !cf.isMissing && isPathInFolder(f.file_path, cf.path));

      if (isValidActive) {
        currentFontIds.add(f.id);
      }
    }

    const allPreservedIds = new Set<number>();
    setMap.forEach((idSet) => {
      idSet.forEach((id) => allPreservedIds.add(id));
    });
    favoriteIds.forEach((id) => allPreservedIds.add(id));

    const missingIds = Array.from(allPreservedIds).filter((id) => !currentFontIds.has(id));
    if (missingIds.length === 0) {
      setUnpluggedFonts([]);
      return;
    }

    void fontService.getCachedFontsByIds(missingIds).then((cached) => {
      const ghostFonts: FontMetadata[] = [];
      for (const cm of cached) {
        const matchedSets: FontLibraryTag[] = [];
        for (const s of sets) {
          const idsInSet = setMap.get(s.id);
          if (idsInSet && idsInSet.has(cm.id)) {
            matchedSets.push({
              id: s.id,
              name: s.name,
              type: "set",
              color: s.color || "#6366f1",
            });
          }
        }

        // 해당 폰트가 위치했던 폴더 검사 (unplugged vs deleted 판정)
        const relatedFolders = customFolders.filter((cf) =>
          isPathInFolder(cm.file_path, cf.path)
        );

        // 우선순위 규칙:
        // 1. 폴더 목록에 해당 폴더가 등록되어 있는 경우(외장하드 분리 등) -> unplugged ("연결 끊김")
        // 2. 폴더 목록 어디에도 해당 폴더가 없는 경우(폴더 삭제됨) -> deleted ("폴더 제거됨")
        const install_status: "unplugged" | "deleted" =
          relatedFolders.length > 0 ? "unplugged" : "deleted";

        ghostFonts.push({
          ...cm,
          isMissing: true,
          install_status,
          version_status: "none" as const,
          libraries: matchedSets,
        });
      }
      setUnpluggedFonts(ghostFonts);
    });
  }, [fonts, sets, setMap, favoriteIds, customFolders]);

  // 중복 폰트 식별 (고유 키 기준으로 동일한 폰트가 둘 이상의 물리 파일에 존재하는 경우, 시스템 폰트 제외)
  const duplicateFontIds = useMemo(() => {
    const keyMap = new Map<string, number[]>();
    for (const font of fonts) {
      if (font.source === "system") continue;
      const key = getFontUniqueKey(font);
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(font.id);
    }
    const duplicates = new Set<number>();
    for (const ids of keyMap.values()) {
      if (ids.length > 1) {
        ids.forEach((id) => duplicates.add(id));
      }
    }
    return duplicates;
  }, [fonts]);

  // 중복 폰트 그룹(고유 폰트) 수 (시스템 폰트 제외)
  const duplicateGroupCount = useMemo(() => {
    const keyMap = new Map<string, number>();
    for (const font of fonts) {
      if (font.source === "system") continue;
      const key = getFontUniqueKey(font);
      keyMap.set(key, (keyMap.get(key) || 0) + 1);
    }
    let count = 0;
    for (const c of keyMap.values()) {
      if (c > 1) count++;
    }
    return count;
  }, [fonts]);

  // 시스템 폰트 제외 중복 개수 맵
  const nonSystemDupCounts = useMemo(() => {
    const countsMap = new Map<string, number>();
    for (const f of fonts) {
      if (f.source === "system") continue;
      const key = getFontUniqueKey(f);
      countsMap.set(key, (countsMap.get(key) || 0) + 1);
    }
    return countsMap;
  }, [fonts]);

  // 폰트 상태(설치, 임시활성화, 미설치, 버전상태) 및 소속 서재(libraries) 동적 매핑
  const processedFonts = useMemo(() => {
    // 1. 동일 지문/경로를 가진 폴더 매핑
    const hashToFoldersMap = new Map<string, Set<CustomFolder>>();
    for (const f of fonts) {
      const key = f.fast_hash || f.file_path;
      if (!hashToFoldersMap.has(key)) {
        hashToFoldersMap.set(key, new Set());
      }
      const folderSet = hashToFoldersMap.get(key)!;
      for (const folder of customFolders) {
        if (isPathInFolder(f.file_path, folder.path)) {
          folderSet.add(folder);
        }
      }
    }

    // 시스템 및 사용자 설치 폰트 인덱스
    const systemMap = new Map<string, FontMetadata>();
    for (const f of fonts) {
      if (f.source === "system" || f.source === "user") {
        const key = (f.postscript_name || f.full_name).toLowerCase();
        systemMap.set(key, f);
      }
    }

    return fonts.map((font): FontMetadata => {
      // 1. 소속 서재(세트 & 감시 폴더) 계산
      const libraries: FontLibraryTag[] = [];

      // 세트 매핑 (정수 ID로 단일 매핑)
      for (const set of sets) {
        const fontIdsInSet = setMap.get(set.id);
        if (fontIdsInSet && fontIdsInSet.has(font.id)) {
          libraries.push({
            id: set.id,
            name: set.name,
            type: "set",
            color: set.color || "#6366f1",
          });
        }
      }

      // 등록 폴더 매핑
      const folderKey = font.fast_hash || font.file_path;
      const matchedFolders = hashToFoldersMap.get(folderKey);
      if (matchedFolders && matchedFolders.size > 0) {
        for (const folder of matchedFolders) {
          libraries.push({
            id: folder.id ?? folder.path,
            name: folder.name,
            type: "folder",
            color: folder.color || "#0ea5e9",
          });
        }
      } else {
        // 폴더 매핑 폴백
        for (const folder of customFolders) {
          if (isPathInFolder(font.file_path, folder.path)) {
            libraries.push({
              id: folder.id ?? folder.path,
              name: folder.name,
              type: "folder",
              color: folder.color || "#0ea5e9",
            });
          }
        }
      }

      const isActivated = activatedFontIds.has(font.id);

      // 시스템/사용자 폰트인 경우 (일반 리스트에서는 중복 배지 비노출)
      if (font.source === "system" || font.source === "user") {
        return {
          ...font,
          duplicate_count: undefined,
          install_status: font.source === "system" ? "installed_system" : "installed_user",
          version_status: "up_to_date",
          libraries,
        };
      }

      // 외부 폰트인 경우 (source === "external")
      // 1. 등록된 감시 폴더(customFolders)에 속하지 않는 경우 -> 출처 폴더 제거됨 (deleted)
      const relatedFolders = customFolders.filter((cf) => isPathInFolder(font.file_path, cf.path));
      if (relatedFolders.length === 0) {
        return {
          ...font,
          duplicate_count: undefined,
          isMissing: true,
          install_status: "deleted",
          version_status: "none",
          libraries,
        };
      }

      // 2. 소속된 등록 감시 폴더가 모두 연결 끊김(외장 드라이브 미연결, 폴더 위치 변경 등) 상태이거나 이미 누락 판정된 경우 -> 원본 파일 연결 끊김 (unplugged)
      const hasActiveFolder = relatedFolders.some((cf) => !cf.isMissing);
      if (!hasActiveFolder || font.isMissing) {
        return {
          ...font,
          duplicate_count: undefined,
          isMissing: true,
          install_status: "unplugged",
          version_status: "none",
          libraries,
        };
      }

      const key = (font.postscript_name || font.full_name).toLowerCase();
      const counterpart = systemMap.get(key);

      let install_status: FontInstallStatus = isActivated ? "activated" : "uninstalled";
      let version_status: FontVersionStatus = "none";
      let installed_path: string | undefined;
      let installed_version: string | undefined;

      if (counterpart) {
        install_status = counterpart.source === "system" ? "installed_system" : "installed_user";
        installed_path = counterpart.file_path;
        installed_version = counterpart.version;

        if (font.version_num !== undefined && counterpart.version_num !== undefined) {
          if (font.version_num > counterpart.version_num) {
            version_status = "update_available";
          } else if (font.version_num < counterpart.version_num) {
            version_status = "outdated";
          } else {
            version_status = "up_to_date";
          }
        } else if (font.version && counterpart.version) {
          version_status = font.version === counterpart.version ? "up_to_date" : "update_available";
        } else {
          version_status = "up_to_date";
        }
      }

      return {
        ...font,
        duplicate_count: undefined,
        install_status,
        version_status,
        installed_path,
        installed_version,
        libraries,
      };
    });
  }, [fonts, sets, setMap, customFolders, activatedFontIds]);

  // 카테고리별 실시간 파일/그룹 카운트
  const categoryCounts = useMemo(() => {
    const activeNonSystemFonts = processedFonts.filter(
      (f) =>
        f.install_status !== "deleted" &&
        f.install_status !== "unplugged" &&
        f.source !== "system"
    );
    const systemFonts = processedFonts.filter((f) => f.source === "system");
    const userFonts = processedFonts.filter((f) => f.source === "user");
    const activatedFonts = processedFonts.filter(
      (f) => activatedFontIds.has(f.id) && f.source !== "system" && f.source !== "user"
    );

    return {
      total: activeNonSystemFonts.length,
      system: systemFonts.length,
      user: userFonts.length,
      activated: activatedFonts.length,
      favorites: favoriteIds.size,
      duplicates: duplicateGroupCount,
      duplicateGroups: duplicateGroupCount,
    };
  }, [processedFonts, activatedFontIds, favoriteIds, duplicateGroupCount]);

  // 1. 등록 폴더별 실시간 폰트 수 동적 계산 (고유 폰트 패밀리 기준)
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of customFolders) {
      const folderFonts = processedFonts.filter((f) => isPathInFolder(f.file_path, folder.path));
      map.set(folder.path, deduplicateFonts(folderFonts).length);
    }
    return map;
  }, [customFolders, processedFonts]);

  // 2. 서재 세트별 실시간 폰트 수 동적 계산 (모든 파일 기준, 1depth는 직속 2depth 하위 세트 통합 합산)
  const setCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const set of sets) {
      const isParent = set.parent_id == null;
      const childIds = isParent ? sets.filter((s) => s.parent_id === set.id).map((s) => s.id) : [];
      const targetIds = [set.id, ...childIds];

      const idsInSet = new Set<number>();
      for (const tId of targetIds) {
        const sIds = setMap.get(tId);
        if (sIds) {
          sIds.forEach((id) => idsInSet.add(id));
        }
      }
      if (idsInSet.size === 0 && setFontIds) {
        setFontIds.forEach((id) => idsInSet.add(id));
      }

      if (idsInSet.size === 0) {
        map.set(set.id, 0);
        continue;
      }
      const matchesSet = (font: FontMetadata) => idsInSet.has(font.id);

      const activeInSet = processedFonts.filter(matchesSet);
      const unpluggedInSet = unpluggedFonts.filter(matchesSet);
      map.set(set.id, activeInSet.length + unpluggedInSet.length);
    }
    return map;
  }, [sets, setMap, setFontIds, processedFonts, unpluggedFonts]);

  // 실시간 계산된 고유 폰트 수가 반영된 폴더 및 서재 세트 목록
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

  const enrichedSets = useMemo(() => {
    return sets.map((set) => ({
      ...set,
      count: setCounts.get(set.id) ?? set.count ?? 0,
    }));
  }, [sets, setCounts]);

  // 필터링된 폰트 목록 (중복 폰트 탭에서만 대표 1개 노출 및 중복 배지 표시, 그 외 일반 리스트는 모든 폰트 파일 노출)
  const filteredFonts = useMemo(() => {
    let result: FontMetadata[] = [];

    if (activeCategory === "all") {
      result = processedFonts.filter(
        (f) =>
          f.install_status !== "deleted" &&
          f.install_status !== "unplugged" &&
          f.source !== "system"
      );
    } else if (activeCategory === "system") {
      result = processedFonts.filter((f) => f.source === "system");
    } else if (activeCategory === "user") {
      result = processedFonts.filter((f) => f.source === "user");
    } else if (activeCategory === "activated") {
      result = processedFonts.filter(
        (f) => activatedFontIds.has(f.id) && f.source !== "system" && f.source !== "user"
      );
    } else if (activeCategory === "favorites") {
      const matchesFavorite = (f: FontMetadata) => favoriteIds.has(f.id);
      const activeFavs = processedFonts.filter(matchesFavorite);
      const unpluggedFavs = unpluggedFonts.filter(matchesFavorite);
      result = [...activeFavs, ...unpluggedFavs];
    } else if (activeCategory === "duplicates") {
      // 중복 폰트 탭: 시스템 폰트를 제외하고, 중복된 폰트들 중 같은 폰트면 대표 1개만 집약 노출하며 중복 개수(duplicate_count) 표시
      const nonSystemDuplicates = processedFonts.filter(
        (f) => duplicateFontIds.has(f.id) && f.source !== "system"
      );
      result = deduplicateFonts(nonSystemDuplicates, activatedFontIds).map((font) => ({
        ...font,
        duplicate_count: nonSystemDupCounts.get(getFontUniqueKey(font)) || 1,
      }));
    } else if (activeCategory.startsWith("set:")) {
      const setId = Number(activeCategory.replace("set:", ""));
      // 1depth 세트인 경우 직속 2depth 자식 세트들의 폰트 ID까지 모두 합산 (Rollup 집계)
      const childSetIds = sets.filter((s) => s.parent_id === setId).map((s) => s.id);
      const targetSetIds = [setId, ...childSetIds];

      const idsInSet = new Set<number>();
      for (const sId of targetSetIds) {
        const sIds = setMap.get(sId);
        if (sIds) {
          sIds.forEach((id) => idsInSet.add(id));
        }
      }
      if (idsInSet.size === 0 && setFontIds) {
        setFontIds.forEach((id) => idsInSet.add(id));
      }

      const matchesSet = (font: FontMetadata) => idsInSet.has(font.id);

      const activeInSet = processedFonts.filter(matchesSet);
      const unpluggedInSet = unpluggedFonts.filter(matchesSet);
      result = [...activeInSet, ...unpluggedInSet];
    } else if (activeCategory.startsWith("folder:")) {
      const folderPath = activeCategory.replace("folder:", "");
      result = processedFonts.filter((f) => isPathInFolder(f.file_path, folderPath));
    }

    if (searchQuery.trim()) {
      result = result.filter((f) => matchesFontSearch(f, searchQuery));
    }

    return sortFonts(
      result,
      {
        favoriteIds,
        activatedFontIds,
      },
      sortSettings,
      i18n.language
    );
  }, [
    processedFonts,
    activeCategory,
    searchQuery,
    favoriteIds,
    setFontIds,
    setMap,
    sets,
    unpluggedFonts,
    duplicateFontIds,
    nonSystemDupCounts,
    activatedFontIds,
    sortSettings,
    i18n.language,
  ]);

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
  }, [activeCategory, loadDbState, onToast, t]);

  // 서재 세트 수정 (이름, 색상, 상위 세트 변경 지원)
  const handleUpdateSet = useCallback(async (setId: number, name: string, color: string, parentId?: number | null) => {
    try {
      await fontService.updateSet(setId, name, color, parentId);
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId
            ? { ...s, name, color, parent_id: parentId !== undefined ? parentId : s.parent_id }
            : s
        )
      );
      return true;
    } catch (err) {
      console.error("세트 수정 실패:", err);
      return false;
    }
  }, []);

  // 서재 세트 부모 변경 (드래그 앤 드롭 계층 이동 전용)
  const handleUpdateSetParent = useCallback(async (setId: number, parentId: number | null) => {
    try {
      await fontService.updateSetParent(setId, parentId);
      setSets((prev) =>
        prev.map((s) => (s.id === setId ? { ...s, parent_id: parentId } : s))
      );
      return true;
    } catch (err) {
      console.error("세트 부모 변경 실패:", err);
      return false;
    }
  }, []);

  // 서재 세트 색상 변경
  const handleUpdateSetColor = useCallback(async (setId: number, color: string) => {
    try {
      await fontService.updateSetColor(setId, color);
      setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, color } : s)));
      return true;
    } catch (err) {
      console.error("세트 색상 변경 실패:", err);
      return false;
    }
  }, []);

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

  // 서재 세트 신규 생성 (색상 및 상위 세트 지원)
  const handleCreateSet = useCallback(async (name: string, color?: string, parentId?: number | null) => {
    try {
      const newSet = await fontService.createSet(name, color, parentId);
      setSets((prev) => [newSet, ...prev]);
      return newSet;
    } catch (err) {
      console.error("세트 생성 실패:", err);
      throw err;
    }
  }, []);

  // 전체 리스트 및 상태 통합 갱신 (DB + 시스템/폴더 폰트)
  const refreshList = useCallback(async () => {
    await loadDbState();
  }, [loadDbState]);

  return {
    fonts,
    setFonts,
    filteredFonts,
    unpluggedFonts,
    isLoading,
    setIsLoading,
    scanProgress,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    customFolders: enrichedCustomFolders,
    setCustomFolders,
    customFoldersRef,
    sets: enrichedSets,
    setSets,
    favoriteIds,
    setFavoriteIds,
    activatedFontIds,
    setActivatedFontIds,
    setFontIds,
    setMap,
    duplicateFontIds,
    categoryCounts,
    loadSystemFonts,
    loadDbState,
    refreshSets,
    refreshList,
    handleSelectSet,
    handleRelinkFolder,
    handleRemoveFolderWithData,
    handleUpdateSet,
    handleUpdateSetParent,
    handleUpdateSetColor,
    handleUpdateFolderColor,
    handleCreateSet,
  };
}
