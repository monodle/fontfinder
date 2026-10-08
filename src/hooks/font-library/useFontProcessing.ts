import { useState, useEffect, useMemo } from "react";
import {
  FontMetadata,
  FontSet,
  CustomFolder,
  FontLibraryTag,
  FontInstallStatus,
  FontVersionStatus,
} from "../../types/font";
import { fontService } from "../../services/fontService";
import { isPathInFolder } from "../../utils/pathUtils";
import { getFontUniqueKey } from "../../utils/fontDeduplication";
import { getFolderFontCount } from "../../utils/fontQueryEngine";
import { DEFAULT_SET_COLOR, DEFAULT_FOLDER_COLOR } from "../../config/colorPresets";

interface UseFontProcessingProps {
  fonts: FontMetadata[];
  customFolders: CustomFolder[];
  sets: FontSet[];
  setMap: Map<number, Set<number>>;
  favoriteIds: Set<number>;
  activatedFontIds: Set<number>;
}

export function useFontProcessing({
  fonts,
  customFolders,
  sets,
  setMap,
  favoriteIds,
  activatedFontIds,
}: UseFontProcessingProps) {
  const [unpluggedFonts, setUnpluggedFonts] = useState<FontMetadata[]>([]);

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
              color: s.color || DEFAULT_SET_COLOR,
            });
          }
        }

        // 해당 폰트가 위치했던 폴더 검사 (unplugged vs deleted 판정)
        const relatedFolders = customFolders.filter((cf) =>
          isPathInFolder(cm.file_path, cf.path)
        );

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
    const hashToFolderKeysMap = new Map<string, Set<string | number>>();
    for (const f of fonts) {
      const key = f.fast_hash || f.file_path;
      if (!hashToFolderKeysMap.has(key)) {
        hashToFolderKeysMap.set(key, new Set());
      }
      const folderKeySet = hashToFolderKeysMap.get(key)!;
      for (const folder of customFolders) {
        if (isPathInFolder(f.file_path, folder.path)) {
          folderKeySet.add(folder.id ?? folder.path);
        }
      }
    }

    const systemMap = new Map<string, FontMetadata>();
    for (const f of fonts) {
      if (f.source === "system" || f.source === "user") {
        const key = (f.postscript_name || f.full_name).toLowerCase();
        systemMap.set(key, f);
      }
    }

    return fonts.map((font): FontMetadata => {
      const libraries: FontLibraryTag[] = [];

      const folderKey = font.fast_hash || font.file_path;
      const matchedFolderKeys = hashToFolderKeysMap.get(folderKey);
      if (matchedFolderKeys && matchedFolderKeys.size > 0) {
        for (const folder of customFolders) {
          const key = folder.id ?? folder.path;
          if (matchedFolderKeys.has(key)) {
            libraries.push({
              id: key,
              name: folder.name,
              type: "folder",
              color: folder.color || DEFAULT_FOLDER_COLOR,
            });
          }
        }
      } else {
        for (const folder of customFolders) {
          if (isPathInFolder(font.file_path, folder.path)) {
            libraries.push({
              id: folder.id ?? folder.path,
              name: folder.name,
              type: "folder",
              color: folder.color || DEFAULT_FOLDER_COLOR,
            });
          }
        }
      }

      for (const set of sets) {
        const fontIdsInSet = setMap.get(set.id);
        if (fontIdsInSet && fontIdsInSet.has(font.id)) {
          libraries.push({
            id: set.id,
            name: set.name,
            type: "set",
            color: set.color || DEFAULT_SET_COLOR,
          });
        }
      }

      const isActivated = activatedFontIds.has(font.id);

      if (font.source === "system" || font.source === "user") {
        return {
          ...font,
          duplicate_count: undefined,
          install_status: font.source === "system" ? "installed_system" : "installed_user",
          version_status: "up_to_date",
          libraries,
        };
      }

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

  // 등록 폴더별 실시간 폰트 수 동적 계산 (SSOT: getFolderFontCount)
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of customFolders) {
      map.set(folder.path, getFolderFontCount(processedFonts, folder.path));
    }
    return map;
  }, [customFolders, processedFonts]);

  return {
    processedFonts,
    unpluggedFonts,
    duplicateFontIds,
    duplicateGroupCount,
    nonSystemDupCounts,
    folderCounts,
  };
}
