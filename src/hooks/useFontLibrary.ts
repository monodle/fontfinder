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
import { isPathInFolder } from "../utils/pathUtils";
import { sortFonts } from "../utils/fontSortUtils";
import { deduplicateFonts, getFontUniqueKey } from "../utils/fontDeduplication";
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
  const { t } = useTranslation();
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
  const [setMap, setSetMap] = useState<Map<number, Set<string>>>(new Map());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [activatedFontIds, setActivatedFontIds] = useState<Set<string>>(new Set());
  const [setFontIds, setSetFontIds] = useState<Set<string>>(new Set());
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

      if (targetFolders.length > 0) {
        const updatedFolders = targetFolders.map((folder) => {
          if (folder.isMissing) {
            return { ...folder, count: 0 };
          }
          const folderFonts = syncedFonts.filter((f) => isPathInFolder(f.file_path, folder.path));
          const uniqueFolderFonts = deduplicateFonts(folderFonts);
          return { ...folder, count: uniqueFolderFonts.length, isMissing: false };
        });
        setCustomFolders(updatedFolders);
      }

      setFonts(syncedFonts);
      return syncedFonts;
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

      // 각 세트의 폰트 ID 목록 병렬 로드
      const setFontEntries = await Promise.all(
        fetchedSets.map(async (s) => {
          const ids = await fontService.getSetFontIds(s.id).catch(() => []);
          return [s.id, new Set(ids)] as const;
        })
      );
      const newSetMap = new Map(setFontEntries);
      setSetMap(newSetMap);

      // 현재 활성화된 카테고리가 세트인 경우 폰트 ID 목록 즉시 갱신
      const curCategory = activeCategoryRef.current;
      if (curCategory.startsWith("set:")) {
        const currentSetId = Number(curCategory.replace("set:", ""));
        const currentIds = newSetMap.get(currentSetId) ?? new Set<string>();
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
    // 1. 캐시된 폰트가 있으면 첫 화면을 즉시 렌더링 (SWR)
    try {
      const cached = await fontService.getCachedFonts();
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
        dbFolders,
        folderStatuses,
        activatedRecords,
        folderOrderJson,
      ] = await Promise.all([
        refreshSets(),
        fontService.getFavoriteFontIds(),
        fontService.getFolders(),
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

      // 등록 폴더 동기화 및 마이그레이션
      const statusMap = new Map(folderStatuses.map((s) => [s.path, s.exists]));
      let targetFolders: CustomFolder[] = [];
      if (dbFolders && dbFolders.length > 0) {
        targetFolders = dbFolders.map((df) => ({
          id: df.id,
          path: df.path,
          name: df.name,
          color: df.color || "#0ea5e9",
          count: 0,
          isMissing: statusMap.has(df.path) ? !statusMap.get(df.path) : false,
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
        if (!folder.isMissing) {
          fontService.watchFolder(folder.path).catch((err) => {
            console.warn(`폴더 감시 등록 실패 (${folder.path}):`, err);
          });
        }
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
            f.path === path
              ? {
                  ...f,
                  isScanning: total > 0 && current < total,
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
        const updated = await fontService.scanDirectory(changedPath);
        const uniqueCount = deduplicateFonts(updated).length;
        setCustomFolders((prev) =>
          prev.map((f) =>
            f.path === changedPath ? { ...f, count: uniqueCount, isMissing: false } : f
          )
        );

        setFonts((prev) => {
          const existingInFolder = prev.filter((f) => isPathInFolder(f.file_path, changedPath));
          const updatedIds = new Set(updated.map((u) => u.id));
          const removedFonts = existingInFolder.filter((f) => !updatedIds.has(f.id));

          // 개별 삭제된 폰트 중 임시 활성화 상태였던 것 자동 해제
          if (removedFonts.length > 0) {
            setActivatedFontIds((prevIds) => {
              const next = new Set(prevIds);
              for (const rf of removedFonts) {
                if (next.has(rf.id)) {
                  void fontService.deactivateFont(rf.file_path, rf.id);
                  next.delete(rf.id);
                }
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
      }
    });

    // 2. 폴더 자체 부재 / 외장 드라이브 언마운트 이벤트
    const unlistenMissingPromise = listen<string>("folder-missing", (event) => {
      const missingPath = event.payload;
      setCustomFolders((prev) =>
        prev.map((f) => (f.path === missingPath ? { ...f, count: 0, isMissing: true } : f))
      );

      setFonts((prev) => prev.filter((f) => !isPathInFolder(f.file_path, missingPath)));

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

    const currentFontKeys = new Set<string>();
    for (const f of fonts) {
      // 시스템/사용자 폰트이거나 현재 등록된 감시 폴더(customFolders)에 실제로 속한 외부 폰트만 유효 활성 키로 간주
      const isValidActive =
        f.source === "system" ||
        f.source === "user" ||
        customFolders.some((cf) => !cf.isMissing && isPathInFolder(f.file_path, cf.path));

      if (isValidActive) {
        currentFontKeys.add(f.id);
        if (f.file_hash) {
          currentFontKeys.add(`${f.file_hash}:${f.font_index}`);
          currentFontKeys.add(f.file_hash);
        }
      }
    }

    const allPreservedKeys = new Set<string>();
    setMap.forEach((idSet) => {
      idSet.forEach((id) => allPreservedKeys.add(id));
    });
    favoriteIds.forEach((id) => allPreservedKeys.add(id));

    const missingKeys = Array.from(allPreservedKeys).filter((k) => !currentFontKeys.has(k));
    if (missingKeys.length === 0) {
      setUnpluggedFonts([]);
      return;
    }

    const searchKeys = Array.from(
      new Set(
        missingKeys.flatMap((k) => {
          const idx = k.lastIndexOf(":");
          const base = idx > 0 ? k.substring(0, idx) : k;
          return [k, base];
        })
      )
    );

    void fontService.getCachedFontsByHashes(searchKeys).then((cached) => {
      const seenGhostHashes = new Set<string>();
      const ghostFonts: FontMetadata[] = [];
      for (const cm of cached) {
        const hashKey = cm.file_hash ? `${cm.file_hash}:${cm.font_index}` : cm.id;
        if (seenGhostHashes.has(hashKey)) continue;
        seenGhostHashes.add(hashKey);

        const matchedSets: FontLibraryTag[] = [];
        for (const s of sets) {
          const idsInSet = setMap.get(s.id);
          if (
            idsInSet &&
            (idsInSet.has(hashKey) ||
              idsInSet.has(cm.id) ||
              (cm.file_hash && idsInSet.has(cm.file_hash)))
          ) {
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
        // 폴더 목록에 해당 폴더가 여전히 등록되어 있는 경우(외장하드 분리 등) -> unplugged ("연결 끊김")
        // 폴더 목록에서 해당 폴더가 완전히 제거된 경우 -> deleted ("폴더 제거됨")
        const install_status: "unplugged" | "deleted" =
          relatedFolders.length > 0 ? "unplugged" : "deleted";

        ghostFonts.push({
          ...cm,
          id: hashKey,
          isMissing: true,
          install_status,
          version_status: "none" as const,
          libraries: matchedSets,
        });
      }
      setUnpluggedFonts(ghostFonts);
    });
  }, [fonts, sets, setMap, favoriteIds, customFolders]);

  // 중복 폰트 식별 (고유 키 기준으로 동일한 폰트가 둘 이상의 물리 파일에 존재하는 경우)
  const duplicateFontIds = useMemo(() => {
    const keyMap = new Map<string, string[]>();
    for (const font of fonts) {
      const key = getFontUniqueKey(font);
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(font.id);
    }
    const duplicates = new Set<string>();
    for (const ids of keyMap.values()) {
      if (ids.length > 1) {
        ids.forEach((id) => duplicates.add(id));
      }
    }
    return duplicates;
  }, [fonts]);

  // 중복 폰트 그룹(고유 폰트) 수
  const duplicateGroupCount = useMemo(() => {
    const keyMap = new Map<string, number>();
    for (const font of fonts) {
      const key = getFontUniqueKey(font);
      keyMap.set(key, (keyMap.get(key) || 0) + 1);
    }
    let count = 0;
    for (const c of keyMap.values()) {
      if (c > 1) count++;
    }
    return count;
  }, [fonts]);

  // 폰트 상태(설치, 임시활성화, 미설치, 버전상태) 및 소속 서재(libraries) 동적 매핑
  const processedFonts = useMemo(() => {
    // 1. 동일 해시(hashKey)가 위치한 모든 등록 폴더를 중복 없이 수집
    const hashToFoldersMap = new Map<string, Set<CustomFolder>>();
    for (const f of fonts) {
      const hashKey = f.file_hash ? `${f.file_hash}:${f.font_index}` : f.id;
      if (!hashToFoldersMap.has(hashKey)) {
        hashToFoldersMap.set(hashKey, new Set());
      }
      const folderSet = hashToFoldersMap.get(hashKey)!;
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
      const hashKey = font.file_hash ? `${font.file_hash}:${font.font_index}` : font.id;

      // 1. 소속 서재(세트 & 감시 폴더) 계산
      const libraries: FontLibraryTag[] = [];

      // 세트 매핑 (해시 키 및 id 동시 지원)
      for (const set of sets) {
        const fontIdsInSet = setMap.get(set.id);
        if (
          fontIdsInSet &&
          (fontIdsInSet.has(hashKey) ||
            fontIdsInSet.has(font.id) ||
            (font.file_hash && fontIdsInSet.has(font.file_hash)))
        ) {
          libraries.push({
            id: set.id,
            name: set.name,
            type: "set",
            color: set.color || "#6366f1",
          });
        }
      }

      // 등록 폴더 매핑 (동일 폰트가 위치한 모든 등록 폴더 표시)
      const matchedFolders = hashToFoldersMap.get(hashKey);
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

      // 시스템/사용자 폰트인 경우
      if (font.source === "system" || font.source === "user") {
        return {
          ...font,
          install_status: font.source === "system" ? "installed_system" : "installed_user",
          version_status: "up_to_date",
          libraries,
        };
      }

      // 외부 폰트인 경우 (source === "external")
      // 등록된 감시 폴더(customFolders)에 속하지 않는 경우 -> 출처 폴더 제거됨
      const isBelongingToAnyFolder = customFolders.some((cf) => isPathInFolder(font.file_path, cf.path));
      if (!isBelongingToAnyFolder) {
        return {
          ...font,
          isMissing: true,
          install_status: "deleted",
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
        install_status,
        version_status,
        installed_path,
        installed_version,
        libraries,
      };
    });
  }, [fonts, sets, setMap, customFolders, activatedFontIds]);

  // 카테고리별 고유(Unique) 폰트 카운트
  const categoryCounts = useMemo(() => {
    const activeFonts = processedFonts.filter((f) => f.install_status !== "deleted");
    const uniqueAll = deduplicateFonts(activeFonts, activatedFontIds);
    const uniqueSystem = deduplicateFonts(
      processedFonts.filter((f) => f.source === "system"),
      activatedFontIds
    );
    const uniqueUser = deduplicateFonts(
      processedFonts.filter((f) => f.source === "user"),
      activatedFontIds
    );
    const uniqueActivated = deduplicateFonts(
      processedFonts.filter(
        (f) => activatedFontIds.has(f.id) && f.source !== "system" && f.source !== "user"
      ),
      activatedFontIds
    );

    return {
      total: uniqueAll.length,
      system: uniqueSystem.length,
      user: uniqueUser.length,
      activated: uniqueActivated.length,
      favorites: favoriteIds.size,
      duplicates: duplicateFontIds.size,
      duplicateGroups: duplicateGroupCount,
    };
  }, [processedFonts, activatedFontIds, favoriteIds, duplicateFontIds, duplicateGroupCount]);

  // 1. 등록 폴더별 실시간 고유(Unique) 폰트 수 동적 계산
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of customFolders) {
      if (folder.isMissing) {
        map.set(folder.path, 0);
        continue;
      }
      const folderFonts = processedFonts.filter((f) => isPathInFolder(f.file_path, folder.path));
      const uniqueFolderFonts = deduplicateFonts(folderFonts, activatedFontIds);
      map.set(folder.path, uniqueFolderFonts.length);
    }
    return map;
  }, [customFolders, processedFonts, activatedFontIds]);

  // 2. 서재 세트별 실시간 고유(Unique) 폰트 수 동적 계산
  const setCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const set of sets) {
      const idsInSet = setMap.get(set.id);
      if (!idsInSet || idsInSet.size === 0) {
        map.set(set.id, 0);
        continue;
      }
      const matchesSet = (font: FontMetadata) => {
        const hashKey = font.file_hash ? `${font.file_hash}:${font.font_index}` : font.id;
        if (idsInSet.has(hashKey) || idsInSet.has(font.id)) return true;
        if (font.file_hash) {
          if (idsInSet.has(font.file_hash)) return true;
          for (const id of idsInSet) {
            if (id.startsWith(font.file_hash)) return true;
          }
        }
        return false;
      };

      const activeInSet = processedFonts.filter(matchesSet);
      const unpluggedInSet = unpluggedFonts.filter(matchesSet);
      const uniqueInSet = deduplicateFonts([...activeInSet, ...unpluggedInSet], activatedFontIds);
      map.set(set.id, uniqueInSet.length);
    }
    return map;
  }, [sets, setMap, processedFonts, unpluggedFonts, activatedFontIds]);

  // 실시간 계산된 고유 폰트 수가 반영된 폴더 및 서재 세트 목록
  const enrichedCustomFolders = useMemo(() => {
    return customFolders.map((folder) => ({
      ...folder,
      count: folderCounts.get(folder.path) ?? folder.count ?? 0,
    }));
  }, [customFolders, folderCounts]);

  const enrichedSets = useMemo(() => {
    return sets.map((set) => ({
      ...set,
      count: setCounts.get(set.id) ?? set.count ?? 0,
    }));
  }, [sets, setCounts]);

  // 필터링된 폰트 목록 (모든 뷰에서 고유 폰트 대표 1개씩 집약 렌더링)
  const filteredFonts = useMemo(() => {
    let result: FontMetadata[] = [];

    if (activeCategory === "all") {
      const activeFonts = processedFonts.filter((f) => f.install_status !== "deleted");
      result = deduplicateFonts(activeFonts, activatedFontIds);
    } else if (activeCategory === "system") {
      const systemFonts = processedFonts.filter((f) => f.source === "system");
      result = deduplicateFonts(systemFonts, activatedFontIds);
    } else if (activeCategory === "user") {
      const userFonts = processedFonts.filter((f) => f.source === "user");
      result = deduplicateFonts(userFonts, activatedFontIds);
    } else if (activeCategory === "activated") {
      const activatedFonts = processedFonts.filter(
        (f) => activatedFontIds.has(f.id) && f.source !== "system" && f.source !== "user"
      );
      result = deduplicateFonts(activatedFonts, activatedFontIds);
    } else if (activeCategory === "favorites") {
      const matchesFavorite = (f: FontMetadata) => {
        const hashKey = f.file_hash ? `${f.file_hash}:${f.font_index}` : f.id;
        if (favoriteIds.has(f.id) || favoriteIds.has(hashKey)) return true;
        if (f.file_hash && favoriteIds.has(f.file_hash)) return true;
        return false;
      };

      const activeFavs = processedFonts.filter(matchesFavorite);
      const unpluggedFavs = unpluggedFonts.filter(matchesFavorite);
      result = deduplicateFonts([...activeFavs, ...unpluggedFavs], activatedFontIds);
    } else if (activeCategory === "duplicates") {
      // 중복 폰트 탭에서는 사용자가 원본 복사본들을 직접 비교할 수 있도록 중복된 파일 목록을 노출
      result = processedFonts.filter((f) => duplicateFontIds.has(f.id));
    } else if (activeCategory.startsWith("set:")) {
      const setId = Number(activeCategory.replace("set:", ""));
      const setMapIds = setMap.get(setId);
      const idsInSet = setMapIds ?? setFontIds ?? new Set<string>();

      const matchesSet = (font: FontMetadata) => {
        const hashKey = font.file_hash ? `${font.file_hash}:${font.font_index}` : font.id;
        if (idsInSet.has(hashKey) || idsInSet.has(font.id)) return true;
        if (font.file_hash) {
          if (idsInSet.has(font.file_hash)) return true;
          for (const id of idsInSet) {
            if (id.startsWith(font.file_hash)) return true;
          }
        }
        return false;
      };

      const activeInSet = processedFonts.filter(matchesSet);
      const unpluggedInSet = unpluggedFonts.filter(matchesSet);
      result = deduplicateFonts([...activeInSet, ...unpluggedInSet], activatedFontIds);
    } else if (activeCategory.startsWith("folder:")) {
      const folderPath = activeCategory.replace("folder:", "");
      const folderFonts = processedFonts.filter((f) => isPathInFolder(f.file_path, folderPath));
      result = deduplicateFonts(folderFonts, activatedFontIds);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.family_name.toLowerCase().includes(query) ||
          f.subfamily_name.toLowerCase().includes(query) ||
          f.full_name.toLowerCase().includes(query) ||
          f.postscript_name.toLowerCase().includes(query)
      );
    }

    return sortFonts(
      result,
      {
        favoriteIds,
        activatedFontIds,
      },
      sortSettings
    );
  }, [
    processedFonts,
    activeCategory,
    searchQuery,
    favoriteIds,
    setFontIds,
    setMap,
    unpluggedFonts,
    duplicateFontIds,
    activatedFontIds,
    sortSettings,
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

  // 서재 세트 수정 (이름 및 색상 동시 변경)
  const handleUpdateSet = useCallback(async (setId: number, name: string, color: string) => {
    try {
      await fontService.updateSet(setId, name, color);
      setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, name, color } : s)));
      return true;
    } catch (err) {
      console.error("세트 수정 실패:", err);
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

  // 서재 세트 신규 생성 (색상 지원)
  const handleCreateSet = useCallback(async (name: string, color?: string) => {
    try {
      const newSet = await fontService.createSet(name, color);
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
    handleUpdateSetColor,
    handleUpdateFolderColor,
    handleCreateSet,
  };
}
