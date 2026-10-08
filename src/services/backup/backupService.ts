import { fontService } from "../fontService";
import { normalizePath } from "../../utils/pathUtils";
import { settingsService } from "../settingsService";
import type { FontSet } from "../../types/font";
import type {
  AppBackupData,
  BackupCategorySelection,
  BackupFontHashRef,
  BackupSummary,
} from "../../types/backup";
import { saveBackupToFile, selectAndReadBackupFile } from "./backupIO";

export { summarizeBackupData } from "./backupValidator";

const EMPTY_SET_FONTS: Record<number, number[]> = {};
const EMPTY_FONT_SETS: FontSet[] = [];

export const backupService = {
  /**
   * 현재 상태 요약 정보 조회 (내보내기 모달 개수 표시용)
   */
  async getCurrentSummary(): Promise<BackupSummary> {
    try {
      const [folders, sets] = await Promise.all([
        fontService.getFolders().catch(() => []),
        fontService.getSets().catch(() => EMPTY_FONT_SETS),
      ]);
      return {
        hasSettings: true,
        foldersCount: folders.length,
        setsCount: sets.length,
      };
    } catch {
      return {
        hasSettings: true,
        foldersCount: 0,
        setsCount: 0,
      };
    }
  },

  /**
   * 선택된 항목들을 기반으로 내보낼 JSON 데이터 객체 생성 (메타데이터 제거된 간결한 구조)
   */
  async createExportPayload(selection: BackupCategorySelection): Promise<AppBackupData> {
    const payload: AppBackupData = {};

    if (selection.settings) {
      payload.settings = await settingsService.loadSettings();
    }

    if (selection.folders) {
      const folders = await fontService.getFolders();
      payload.folders = folders.map((f) => ({
        path: f.path,
        name: f.name,
        color: f.color,
        sortOrder: f.sort_order,
      }));
    }

    if (selection.sets) {
      const [sets, allSetFonts, cachedFonts] = await Promise.all([
        fontService.getSets().catch(() => EMPTY_FONT_SETS),
        fontService.getAllSetFontIds().catch(() => EMPTY_SET_FONTS),
        fontService.getCachedFonts().catch(() => []),
      ]);

      const fontHashMap = new Map<number, BackupFontHashRef>();
      for (const font of cachedFonts) {
        if (font.id && font.fast_hash) {
          fontHashMap.set(font.id, {
            fastHash: font.fast_hash,
            deepHash: font.deep_hash || null,
          });
        }
      }

      const setById = new Map(sets.map((s) => [s.id, s]));

      payload.sets = sets.map((s) => {
        const ids = allSetFonts[s.id] ?? [];
        const hashes: BackupFontHashRef[] = [];
        for (const id of ids) {
          const hashRef = fontHashMap.get(id);
          if (hashRef) {
            hashes.push(hashRef);
          }
        }

        const parentSet = s.parent_id != null ? setById.get(s.parent_id) : null;

        return {
          id: s.id,
          name: s.name,
          color: s.color,
          parentId: s.parent_id ?? null,
          parentName: parentSet ? parentSet.name : null,
          sortOrder: s.sort_order,
          fontHashes: hashes,
          fontIds: ids,
        };
      });
    }

    return payload;
  },

  /**
   * 백업 데이터를 JSON 파일로 저장
   */
  async saveBackupToFile(data: AppBackupData): Promise<boolean> {
    return saveBackupToFile(data);
  },

  /**
   * JSON 백업 파일 선택 및 엄격 검증 파싱
   */
  async selectAndReadBackupFile(): Promise<AppBackupData | null> {
    return selectAndReadBackupFile();
  },

  /**
   * 선택된 항목 복원/가져오기 실행 (정제된 데이터만 안전하게 주입)
   */
  async importBackupData(
    backup: AppBackupData,
    selection: BackupCategorySelection
  ): Promise<{ settings: boolean; foldersAdded: number; setsAdded: number }> {
    let settingsApplied = false;
    let foldersAdded = 0;
    let setsAdded = 0;

    // 1. 시스템 설정 복원
    if (selection.settings && backup.settings) {
      await settingsService.saveSettings(backup.settings);
      settingsApplied = true;
    }

    // 2. 폴더 복원 (기존 등록 폴더는 패스, 신규 폴더는 추가 + 스캔 + 감시 활성화)
    if (selection.folders && backup.folders && backup.folders.length > 0) {
      const currentFolders = await fontService.getFolders().catch(() => []);
      const existingNormalizedPaths = new Set(
        currentFolders.map((f) => normalizePath(f.path).toLowerCase())
      );

      for (const folder of backup.folders) {
        if (!folder.path) continue;
        const normPath = normalizePath(folder.path).toLowerCase();
        // 이미 등록된 폴더는 패스
        if (existingNormalizedPaths.has(normPath)) continue;

        try {
          // 1) DB 폴더 등록
          await fontService.addFolder(folder.path, folder.name, folder.color, folder.sortOrder);
          existingNormalizedPaths.add(normPath);
          foldersAdded++;

          // 2) 신규 폴더 추가와 동일하게 즉시 폰트 스캔 & DB 캐시 적재 (세트 복원을 위한 필수 선행 작업)
          await fontService.scanDirectory(folder.path).catch((err) => {
            console.warn(`폴더 스캔 실패 (${folder.path}):`, err);
          });

          // 3) 파일 시스템 감시 등록
          await fontService.watchFolder(folder.path).catch(() => {});
        } catch (e) {
          console.warn(`폴더 추가 실패 (${folder.path}):`, e);
        }
      }
    }

    // 3. 서재 세트 복원 (사전 일괄 조회, 2-Pass 부모/자식 계층 복원 및 덮어쓰기)
    if (selection.sets && backup.sets && backup.sets.length > 0) {
      const [currentSets, allSetFonts] = await Promise.all([
        fontService.getSets().catch(() => EMPTY_FONT_SETS),
        fontService.getAllSetFontIds().catch(() => EMPTY_SET_FONTS),
      ]);
      const setNameToIdMap = new Map<string, number>(currentSets.map((s) => [s.name, s.id]));
      const existingSetFontsMap = new Map<number, Set<number>>(
        Object.entries(allSetFonts).map(([k, v]) => [Number(k), new Set(v)])
      );

      // 백업 파일의 모든 fontHashes 수집
      const allHashesToLookup = new Set<string>();
      for (const setItem of backup.sets) {
        if (Array.isArray(setItem.fontHashes)) {
          for (const ref of setItem.fontHashes) {
            if (ref.deepHash) allHashesToLookup.add(ref.deepHash);
            if (ref.fastHash) allHashesToLookup.add(ref.fastHash);
          }
        }
      }

      // 현재 PC의 로컬 폰트 캐시에서 해시 매칭 (방금 스캔된 신규 폴더의 폰트 포함)
      const matchedFonts = allHashesToLookup.size > 0
        ? await fontService.getCachedFontsByHashes(Array.from(allHashesToLookup)).catch(() => [])
        : [];

      // hash -> 현재 PC의 로컬 font.id 매핑 테이블 구축
      const hashToLocalIdMap = new Map<string, number>();
      for (const font of matchedFonts) {
        if (font.deep_hash) {
          hashToLocalIdMap.set(font.deep_hash, font.id);
        }
        if (font.fast_hash && !hashToLocalIdMap.has(font.fast_hash)) {
          hashToLocalIdMap.set(font.fast_hash, font.id);
        }
        if (font.file_hash && !hashToLocalIdMap.has(font.file_hash)) {
          hashToLocalIdMap.set(font.file_hash, font.id);
        }
      }

      // 백업 파일의 원본 세트 ID -> 복원된 신규 세트 ID 매핑 테이블 (정확한 부모-자식 트리 복원)
      const backupIdToNewIdMap = new Map<number, number>();

      // 기존 세트 중 동일 부모 아래 동일 이름을 가진 세트 매칭
      const findExistingSet = (name: string, parentId: number | null): FontSet | undefined => {
        return currentSets.find(
          (s) => s.name === name && (s.parent_id ?? null) === (parentId ?? null)
        );
      };

      // 2뎁스 계층 보존을 위해 1단계: 부모 세트(!parentName && !parentId) 우선, 2단계: 자식 세트 순으로 정렬
      const parentSets = backup.sets.filter((s) => !s.parentName && !s.parentId);
      const childSets = backup.sets.filter((s) => Boolean(s.parentName || s.parentId));
      const orderedSets = [...parentSets, ...childSets];

      for (const setItem of orderedSets) {
        if (!setItem.name) continue;
        try {
          let targetSetId: number;

          // 부모 세트 ID 확인:
          // 1순위: backupIdToNewIdMap (setItem.parentId가 있는 경우)
          // 2순위: setNameToIdMap (setItem.parentName이 있는 경우)
          let targetParentId: number | null = null;
          if (setItem.parentId != null && backupIdToNewIdMap.has(setItem.parentId)) {
            targetParentId = backupIdToNewIdMap.get(setItem.parentId) ?? null;
          } else if (setItem.parentName) {
            targetParentId = setNameToIdMap.get(setItem.parentName) ?? null;
          }

          const existingSet = findExistingSet(setItem.name, targetParentId);

          if (existingSet) {
            // [덮어쓰기 정책] 기존 동일 이름 & 동일 부모 세트: 속성(색상, 부모) 갱신 및 기존 폰트 목록 덮어쓰기
            targetSetId = existingSet.id;
            await fontService
              .updateSet(targetSetId, setItem.name, setItem.color || existingSet.color, targetParentId)
              .catch(() => {});
            if (setItem.sortOrder) {
              await fontService
                .updateSetPosition(targetSetId, targetParentId, setItem.sortOrder)
                .catch(() => {});
            }

            // 기존에 담겨있던 폰트 관계 제거
            const oldFontIds = existingSetFontsMap.get(targetSetId);
            if (oldFontIds && oldFontIds.size > 0) {
              await fontService.removeFontsFromSetBulk(targetSetId, Array.from(oldFontIds)).catch(() => {});
            }
            existingSetFontsMap.set(targetSetId, new Set());
          } else {
            // 신규 세트 생성
            const created = await fontService.createSet(setItem.name, setItem.color, targetParentId, setItem.sortOrder);
            targetSetId = created.id;
            currentSets.push(created);
            existingSetFontsMap.set(targetSetId, new Set());
            setsAdded++;
          }

          if (setItem.id != null) {
            backupIdToNewIdMap.set(setItem.id, targetSetId);
          }
          setNameToIdMap.set(setItem.name, targetSetId);

          const existingFontIds = existingSetFontsMap.get(targetSetId) ?? new Set<number>();
          const candidateFontIds: number[] = [];

          if (Array.isArray(setItem.fontHashes) && setItem.fontHashes.length > 0) {
            // 1순위: 해시 기반 로컬 ID 매핑 (기기/OS/PK 불일치 완벽 방어)
            for (const ref of setItem.fontHashes) {
              const localId = (ref.deepHash && hashToLocalIdMap.get(ref.deepHash))
                || (ref.fastHash && hashToLocalIdMap.get(ref.fastHash));
              if (localId && !existingFontIds.has(localId)) {
                candidateFontIds.push(localId);
              }
            }
          } else if (Array.isArray(setItem.fontIds) && setItem.fontIds.length > 0) {
            // 2순위 (레거시 백업 호환): fontIds 직접 사용
            for (const fontId of setItem.fontIds) {
              if (!existingFontIds.has(fontId)) {
                candidateFontIds.push(fontId);
              }
            }
          }

          if (candidateFontIds.length > 0) {
            const uniqueToAdd = Array.from(new Set(candidateFontIds));
            await fontService.addFontsToSetBulk(targetSetId, uniqueToAdd).catch(() => {});
            uniqueToAdd.forEach((id) => existingFontIds.add(id));
          }
        } catch (e) {
          console.warn(`세트 복원 실패 (${setItem.name}):`, e);
        }
      }
    }

    return {
      settings: settingsApplied,
      foldersAdded,
      setsAdded,
    };
  },
};
