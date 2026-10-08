import { useState, useCallback, useMemo } from "react";
import { FontSet } from "../../types/font";
import { fontService } from "../../services/fontService";

/**
 * 서재 세트 목록의 실시간 카운트 계산
 * - 자식이 있는 1depth 세트: 자기 자신 직접 등록 수 + 직속 2depth 자식 세트들의 카운트 합계
 * - 자식이 없는 1depth 세트 및 2depth 하위 세트: 해당 세트 자체에 직접 등록된 DB 폰트 수
 * - setMap이 제공되면 Set 크기를 우선 참조하여 상태 누적 오염을 원천 방지
 */
function calculateSetCounts(sets: FontSet[], setMap?: Map<number, Set<number>>): FontSet[] {
  const directMap = new Map<number, number>();
  for (const s of sets) {
    const directCount = setMap?.get(s.id)?.size ?? s.count ?? 0;
    directMap.set(s.id, directCount);
  }

  return sets.map((s) => {
    const isParent = s.parent_id == null;
    const childSets = isParent ? sets.filter((c) => c.parent_id === s.id) : [];

    if (isParent && childSets.length > 0) {
      const ownCount = directMap.get(s.id) ?? 0;
      const sum = ownCount + childSets.reduce((acc, child) => acc + (directMap.get(child.id) ?? 0), 0);
      return { ...s, count: sum };
    }
    return { ...s, count: directMap.get(s.id) ?? 0 };
  });
}

interface UseSetLibraryProps {
  activeCategoryRef: React.MutableRefObject<string>;
  setActiveCategory: (category: string) => void;
}

export function useSetLibrary({ activeCategoryRef, setActiveCategory }: UseSetLibraryProps) {
  const [sets, setSets] = useState<FontSet[]>([]);
  const [setMap, setSetMap] = useState<Map<number, Set<number>>>(new Map());
  const [setFontIds, setSetFontIds] = useState<Set<number>>(new Set());

  // 서재(세트) 목록 및 폰트 매핑 즉각 동기화 (개수 및 리스트 즉시 갱신)
  const refreshSets = useCallback(async () => {
    try {
      const fetchedSets = await fontService.getSets();
      // DB 원본 sets는 순수 direct count 상태로 보관 (오염 및 누적 합산 방지)
      setSets(fetchedSets);

      // 모든 세트의 폰트 ID 목록을 단일 쿼리로 일괄 로드하여 1+N 쿼리/IPC 방지
      const allSetFontsMap = await fontService.getAllSetFontIdsMap().catch(() => new Map<number, number[]>());
      const newSetMap = new Map<number, Set<number>>();
      for (const s of fetchedSets) {
        const ids = allSetFontsMap.get(s.id) ?? [];
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
  }, [activeCategoryRef]);

  // 서재 세트 폰트 갯수 갱신 전용 핸들러
  const refreshSetCount = useCallback(
    async (targetSetId?: number) => {
      try {
        if (targetSetId !== undefined) {
          const ids = await fontService.getSetFontIds(targetSetId);
          const idSet = new Set(ids);

          setSetMap((prev) => {
            const next = new Map(prev);
            next.set(targetSetId, idSet);
            return next;
          });

          if (activeCategoryRef.current === `set:${targetSetId}`) {
            setSetFontIds(idSet);
          }

          setSets((prevSets) =>
            prevSets.map((s) =>
              s.id === targetSetId ? { ...s, count: ids.length } : s
            )
          );
          return;
        }

        await refreshSets();
      } catch (err) {
        console.error(`서재 폰트 갯수 갱신 실패 (setId: ${targetSetId}):`, err);
      }
    },
    [activeCategoryRef, refreshSets]
  );

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
  }, [setActiveCategory]);

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

  // 서재 세트 신규 생성
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

  // 서재 세트 목록 (부모 세트는 자기 자신 + 하위 자식 세트들의 카운트를 실시간 합산하여 제공)
  const enrichedSets = useMemo(() => {
    return calculateSetCounts(sets, setMap);
  }, [sets, setMap]);

  return {
    sets,
    setSets,
    setMap,
    setSetMap,
    setFontIds,
    setSetFontIds,
    enrichedSets,
    refreshSets,
    refreshSetCount,
    handleSelectSet,
    handleUpdateSet,
    handleUpdateSetParent,
    handleUpdateSetColor,
    handleCreateSet,
  };
}
