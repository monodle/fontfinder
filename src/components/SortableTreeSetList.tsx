import React, { useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontSet } from "../types/font";

export interface FlatSetItem {
  set: FontSet;
  depth: 1 | 2;
  parentId: number | null;
  hasChildren: boolean;
  isCollapsed: boolean;
}

type DropMode = "before" | "inside" | "after";

export interface TreeDropState {
  targetIndex: number;
  mode: DropMode;
  resolvedDepth: 1 | 2;
  resolvedParentId: number | null;
  resolvedParentName?: string;
}

interface SortableTreeSetListProps {
  items: FlatSetItem[];
  onDropItem: (movedSetId: number, newParentId: number | null, newFlatList: FlatSetItem[]) => void;
  onItemClick: (set: FontSet) => void;
  renderItem: (
    item: FlatSetItem,
    state: {
      isDragging: boolean;
      isInsideTarget: boolean;
      dropIndicator: {
        position: "before" | "after";
        targetDepth: 1 | 2;
        targetParentName?: string;
      } | null;
    }
  ) => ReactNode;
  className?: string;
}

interface DragInfo {
  startIndex: number;
  startX: number;
  startY: number;
  isDragging: boolean;
  targetIndex: number;
  mode: DropMode;
  resolvedDepth: 1 | 2;
  resolvedParentId: number | null;
  resolvedParentName?: string;
}

export function SortableTreeSetList({
  items,
  onDropItem,
  onItemClick,
  renderItem,
  className = "space-y-0.5",
}: SortableTreeSetListProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropState, setDropState] = useState<TreeDropState | null>(null);
  const { t } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const dragInfoRef = useRef<DragInfo | null>(null);
  const cleanUpListenersRef = useRef<() => void>(() => {});

  const findParentName = useCallback((parentId: number | null): string | undefined => {
    if (parentId == null) return undefined;
    const found = itemsRef.current.find((it) => it.set.id === parentId);
    return found?.set.name;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const dragInfo = dragInfoRef.current;
    if (!dragInfo) return;

    const diffY = Math.abs(e.clientY - dragInfo.startY);
    const diffX = Math.abs(e.clientX - dragInfo.startX);

    // 4px 이상 이동 시 드래그 모드 활성화
    if (!dragInfo.isDragging && (diffY > 4 || diffX > 4)) {
      dragInfo.isDragging = true;
      const draggingItem = itemsRef.current[dragInfo.startIndex];
      if (draggingItem) {
        setDraggingId(draggingItem.set.id);
      }
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    if (!dragInfo.isDragging) return;

    const container = containerRef.current;
    if (!container) return;

    // 1. 현재 Y 좌표가 위치한 타겟 아이템 및 내부 비율(ratioY) 계산
    let targetIndex = -1;
    let ratioY = 0.5;
    const count = itemRefs.current.length;

    for (let i = 0; i < count; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetIndex = i;
        ratioY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
        break;
      }
    }

    // 영역 밖 클램핑
    if (targetIndex === -1 && count > 0) {
      const firstEl = itemRefs.current[0];
      const lastEl = itemRefs.current[count - 1];
      if (firstEl && e.clientY < firstEl.getBoundingClientRect().top) {
        targetIndex = 0;
        ratioY = 0.0;
      } else if (lastEl && e.clientY > lastEl.getBoundingClientRect().bottom) {
        targetIndex = count - 1;
        ratioY = 1.0;
      }
    }

    if (targetIndex === -1) {
      dragInfo.targetIndex = -1;
      setDropState(null);
      return;
    }

    const draggingItem = itemsRef.current[dragInfo.startIndex];
    const targetItem = itemsRef.current[targetIndex];
    if (!draggingItem || !targetItem) return;

    // 2. 맥 파인더 / 탐색기 스타일 드롭 모드 판별:
    // - 폴더 본체 위 (25% ~ 75%): "inside" (폴더 안으로 쏙 넣기)
    // - 상단 25% 미만: "before" (위쪽 라인 삽입)
    // - 하단 75% 초과: "after" (아래쪽 라인 삽입)

    let mode: DropMode = "before";
    let resolvedDepth: 1 | 2 = 1;
    let resolvedParentId: number | null = null;
    let resolvedParentName: string | undefined = undefined;

    const isTarget1Depth = targetItem.depth === 1;
    const isTargetSelf = targetItem.set.id === draggingItem.set.id;
    // 자식이 있는 1depth 세트는 다른 폴더 안으로 들어갈 수 없음 (최대 2depth 제한)
    const canDropInside = isTarget1Depth && !isTargetSelf && !draggingItem.hasChildren;

    if (canDropInside && ratioY >= 0.25 && ratioY <= 0.75) {
      // [탐색기 폴더 안으로 넣기 모드]
      mode = "inside";
      resolvedDepth = 2;
      resolvedParentId = targetItem.set.id;
      resolvedParentName = targetItem.set.name;
    } else {
      // [라인 끼워넣기 모드 (before / after)]
      mode = ratioY < 0.5 ? "before" : "after";

      if (isTarget1Depth) {
        // 1depth 아이템의 위/아래 라인은 1depth 최상위 레벨로 삽입됨 (2depth에서 1depth로 꺼내기 가능)
        resolvedDepth = 1;
        resolvedParentId = null;
        resolvedParentName = undefined;
      } else {
        // 2depth 아이템의 위/아래 라인은 해당 2depth와 같은 부모 하위로 삽입됨
        resolvedDepth = 2;
        resolvedParentId = targetItem.parentId;
        resolvedParentName = findParentName(resolvedParentId);
      }
    }

    // ref에 최신 드래그 상태 즉시 기록
    dragInfo.targetIndex = targetIndex;
    dragInfo.mode = mode;
    dragInfo.resolvedDepth = resolvedDepth;
    dragInfo.resolvedParentId = resolvedParentId;
    dragInfo.resolvedParentName = resolvedParentName;

    setDropState({
      targetIndex,
      mode,
      resolvedDepth,
      resolvedParentId,
      resolvedParentName,
    });
  }, [findParentName]);

  const handlePointerUp = useCallback((_e?: PointerEvent) => {
    cleanUpListenersRef.current();

    const dragInfo = dragInfoRef.current;
    dragInfoRef.current = null;

    if (!dragInfo) return;

    if (!dragInfo.isDragging) {
      // 단순 클릭
      const item = itemsRef.current[dragInfo.startIndex];
      if (item) {
        onItemClick(item.set);
      }
    } else if (dragInfo.targetIndex !== -1) {
      const { startIndex, targetIndex, mode, resolvedDepth, resolvedParentId } = dragInfo;
      const currentList = [...itemsRef.current];

      if (startIndex >= 0 && startIndex < currentList.length) {
        const [moved] = currentList.splice(startIndex, 1);
        const updatedMoved: FlatSetItem = {
          ...moved,
          depth: resolvedDepth,
          parentId: resolvedParentId,
          set: {
            ...moved.set,
            parent_id: resolvedParentId,
          },
        };

        let insertIndex = targetIndex;

        if (mode === "inside") {
          // 탐색기 폴더 안으로 넣기: 대상 1depth 폴더 바로 뒤(자식 목록의 맨 처음)에 삽입
          const targetItemIndex = currentList.findIndex((it) => it.set.id === resolvedParentId);
          insertIndex = targetItemIndex !== -1 ? targetItemIndex + 1 : currentList.length;
        } else {
          // 라인 끼워넣기 (before / after)
          if (startIndex < targetIndex) {
            insertIndex = mode === "after" ? targetIndex : targetIndex - 1;
          } else if (startIndex > targetIndex) {
            insertIndex = mode === "after" ? targetIndex + 1 : targetIndex;
          } else {
            insertIndex = targetIndex;
          }
        }

        insertIndex = Math.max(0, Math.min(insertIndex, currentList.length));
        currentList.splice(insertIndex, 0, updatedMoved);

        onDropItem(moved.set.id, resolvedParentId, currentList);
      }
    }

    setDraggingId(null);
    setDropState(null);
  }, [onDropItem, onItemClick]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }

    cleanUpListenersRef.current();

    dragInfoRef.current = {
      startIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      targetIndex: index,
      mode: "before",
      resolvedDepth: itemsRef.current[index]?.depth ?? 1,
      resolvedParentId: itemsRef.current[index]?.parentId ?? null,
      resolvedParentName: findParentName(itemsRef.current[index]?.parentId ?? null),
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    cleanUpListenersRef.current = cleanup;

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  useEffect(() => {
    return () => {
      cleanUpListenersRef.current();
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative select-none touch-none ${className}`}>
      {items.map((item, index) => {
        const isDragging = draggingId === item.set.id;
        const isTarget = dropState?.targetIndex === index && !isDragging;

        // 맥 파인더 스타일: 폴더 안으로 넣기(inside) 활성화 여부
        const isInsideTarget = isTarget && dropState?.mode === "inside";

        // 라인 인디케이터 (before / after)
        const dropIndicator = isTarget && dropState?.mode !== "inside"
          ? {
              position: dropState.mode as "before" | "after",
              targetDepth: dropState.resolvedDepth,
              targetParentName: dropState.resolvedParentName,
            }
          : null;

        return (
          <div
            key={item.set.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onPointerDown={(e) => handlePointerDown(e, index)}
            className={`relative touch-none select-none transition-colors duration-150 ${
              isInsideTarget ? "rounded-lg ring-2 ring-theme-accent bg-theme-accent/15" : ""
            }`}
          >
            {/* 맥 파인더 스타일: 폴더 안으로 넣기 뱃지 */}
            {isInsideTarget && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center gap-1 bg-theme-accent text-theme-accent-text text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-md animate-bounce">
                <span>{t("sidebar.move_into_set", { name: item.set.name, defaultValue: `↳ ${item.set.name} 안으로 이동` })}</span>
              </div>
            )}

            {/* 위쪽 라인 끼워넣기 가이드 */}
            {dropIndicator && dropIndicator.position === "before" && (
              <div
                className={`absolute top-0 right-1 z-30 flex items-center gap-1.5 pointer-events-none -translate-y-1/2 transition-all ${
                  dropIndicator.targetDepth === 2 ? "left-7" : "left-1"
                }`}
              >
                <div className="h-0.5 flex-1 bg-theme-accent rounded-full shadow-sm ring-1 ring-theme-accent/50" />
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-theme-accent text-theme-accent-text shrink-0 shadow-xs">
                  {dropIndicator.targetDepth === 2 ? (
                    <span>
                      {t("sidebar.insert_child", {
                        parent: dropIndicator.targetParentName ? `(${dropIndicator.targetParentName})` : "",
                        defaultValue: `↳ 2depth ${dropIndicator.targetParentName ? `(${dropIndicator.targetParentName})` : ""}`,
                      })}
                    </span>
                  ) : (
                    <span>{t("sidebar.insert_root", "1depth 최상위로 끼워넣기")}</span>
                  )}
                </span>
              </div>
            )}

            {renderItem(item, { isDragging, isInsideTarget, dropIndicator })}

            {/* 아래쪽 라인 끼워넣기 가이드 */}
            {dropIndicator && dropIndicator.position === "after" && (
              <div
                className={`absolute bottom-0 right-1 z-30 flex items-center gap-1.5 pointer-events-none translate-y-1/2 transition-all ${
                  dropIndicator.targetDepth === 2 ? "left-7" : "left-1"
                }`}
              >
                <div className="h-0.5 flex-1 bg-theme-accent rounded-full shadow-sm ring-1 ring-theme-accent/50" />
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-theme-accent text-theme-accent-text shrink-0 shadow-xs">
                  {dropIndicator.targetDepth === 2 ? (
                    <span>
                      {t("sidebar.insert_child", {
                        parent: dropIndicator.targetParentName ? `(${dropIndicator.targetParentName})` : "",
                        defaultValue: `↳ 2depth ${dropIndicator.targetParentName ? `(${dropIndicator.targetParentName})` : ""}`,
                      })}
                    </span>
                  ) : (
                    <span>{t("sidebar.insert_root", "1depth 최상위로 끼워넣기")}</span>
                  )}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
