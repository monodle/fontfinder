import React, { useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { treeDropPositionSchema } from "../../schemas";

export type DropMode = "before" | "inside" | "after";

export interface TreeDropIndicator {
  position: "before" | "after";
  targetDepth: 1 | 2;
  targetParentName?: string;
}

export interface SortableItemState {
  isDragging: boolean;
  isOver: boolean;
  dropPosition: "before" | "after" | null;
  /** 2depth 계층 트리 모드 전용 상태 */
  isInsideTarget?: boolean;
  dropIndicator?: TreeDropIndicator | null;
}

/** 2depth 계층 구조(Tree) 드래그 앤 드롭 옵션 */
export interface TreeOptions<T> {
  /** 아이템의 현재 깊이 (1 | 2) */
  getDepth: (item: T) => 1 | 2;
  /** 아이템의 부모 식별자 */
  getParentId: (item: T) => number | string | null;
  /** 하위 자식을 가지고 있는지 여부 */
  hasChildren?: (item: T) => boolean;
  /** 부모 식별자로 부모 이름 조회 (인디케이터 라벨용) */
  getParentName?: (parentId: number | string | null) => string | undefined;
  /** 아이템 표시 이름 조회 (폴더 안으로 넣기 뱃지용) */
  getItemName?: (item: T) => string;
  /** 드롭 후 아이템의 깊이 및 부모 식별자 갱신 함수 */
  updateItemHierarchy?: (
    item: T,
    newDepth: 1 | 2,
    newParentId: number | string | null
  ) => T;
  /** 트리 아이템 이동 완료 콜백 */
  onDropTreeItem: (
    movedItem: T,
    newParentId: number | string | null,
    newItems: T[]
  ) => void;
  /** 1depth 루트와 2depth 자식 들여쓰기 분기 기준 픽셀 (기본값: 40px) */
  indentThreshold?: number;
}

export interface SortableSidebarListProps<T> {
  items: T[];
  getId: (item: T) => string | number;
  onItemClick: (item: T) => void;
  renderItem: (item: T, state: SortableItemState) => ReactNode;
  /** 1차원 평면 목록 재정렬 콜백 (treeOptions 미지정 시 사용) */
  onReorder?: (newItems: T[], movedItem?: T, newIndex?: number) => void;
  /** 2depth 계층 트리 지원 옵션 (지정 시 계층형 DnD 활성화) */
  treeOptions?: TreeOptions<T>;
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
  resolvedParentId: number | string | null;
  resolvedParentName?: string;
}

interface OverState {
  targetIndex: number;
  mode: DropMode;
  resolvedDepth: 1 | 2;
  resolvedParentId: number | string | null;
  resolvedParentName?: string;
}

export function SortableSidebarList<T>({
  items,
  getId,
  onReorder,
  onItemClick,
  renderItem,
  treeOptions,
  className = "space-y-0.5",
}: SortableSidebarListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [overState, setOverState] = useState<OverState | null>(null);
  const { t } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const dragInfoRef = useRef<DragInfo | null>(null);
  const cleanUpListenersRef = useRef<() => void>(() => {});

  const cleanUpListeners = useCallback(() => {
    cleanUpListenersRef.current();
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const dragInfo = dragInfoRef.current;
      if (!dragInfo) return;

      const diffY = Math.abs(e.clientY - dragInfo.startY);
      const diffX = Math.abs(e.clientX - dragInfo.startX);

      // 4px 이상 이동 시 드래그 모드 돌입
      if (!dragInfo.isDragging && (diffY > 4 || diffX > 4)) {
        dragInfo.isDragging = true;
        const draggingItem = itemsRef.current[dragInfo.startIndex];
        if (draggingItem !== undefined) {
          setDraggingId(getId(draggingItem));
        }
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }

      if (!dragInfo.isDragging) return;

      const container = containerRef.current;
      if (!container) return;

      // 1. 현재 포인터 Y 좌표가 위치한 타겟 아이템 및 비율(ratioY) 계산
      let targetIndex = -1;
      let ratioY = 0.5;
      const count = itemRefs.current.length;
      let isPastBottom = false;

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
          isPastBottom = true;
        }
      }

      // 마지막 아이템의 하단 25% 이하로 포인터가 내려가면 맨 끝 탈출 영역으로 판정
      if (targetIndex === count - 1 && ratioY > 0.75) {
        isPastBottom = true;
      }

      if (targetIndex === -1) {
        dragInfo.targetIndex = -1;
        setOverState(null);
        return;
      }

      const draggingItem = itemsRef.current[dragInfo.startIndex];
      const targetItem = itemsRef.current[targetIndex];
      if (draggingItem === undefined || targetItem === undefined) return;

      // [모드 A: 1차원 평면 목록]
      if (!treeOptions) {
        const position: DropMode = ratioY > 0.5 ? "after" : "before";
        dragInfo.targetIndex = targetIndex;
        dragInfo.mode = position;
        dragInfo.resolvedDepth = 1;
        dragInfo.resolvedParentId = null;

        setOverState({
          targetIndex,
          mode: position,
          resolvedDepth: 1,
          resolvedParentId: null,
        });
        return;
      }

      // [모드 B: 2depth 계층 트리 구조]
      const targetDepth = treeOptions.getDepth(targetItem);
      const targetParentId = treeOptions.getParentId(targetItem);
      const isTarget1Depth = targetDepth === 1;
      const isTargetSelf = getId(targetItem) === getId(draggingItem);
      const isDraggingHasChildren = Boolean(treeOptions.hasChildren?.(draggingItem));

      let mode: DropMode = "before";
      let resolvedDepth: 1 | 2 = 1;
      let resolvedParentId: number | string | null = null;
      let resolvedParentName: string | undefined = undefined;

      // 자식이 있는 1depth 세트는 다른 폴더 안으로 들어갈 수 없음
      const canDropInside = isTarget1Depth && !isTargetSelf && !isDraggingHasChildren;

      if (isDraggingHasChildren) {
        // 자식을 보유한 1depth 세트는 무조건 1depth 루트 계층 유지
        mode = ratioY < 0.5 ? "before" : "after";
        resolvedDepth = 1;
        resolvedParentId = null;
        resolvedParentName = undefined;
      } else if (canDropInside && ratioY >= 0.25 && ratioY <= 0.75) {
        // 폴더 안으로 넣기 모드 (inside)
        mode = "inside";
        resolvedDepth = 2;
        resolvedParentId = getId(targetItem);
        resolvedParentName = treeOptions.getItemName
          ? treeOptions.getItemName(targetItem)
          : treeOptions.getParentName?.(resolvedParentId);
      } else {
        // 라인 끼워넣기 모드 (before / after)
        mode = ratioY < 0.5 ? "before" : "after";

        if (isTarget1Depth) {
          resolvedDepth = 1;
          resolvedParentId = null;
          resolvedParentName = undefined;
        } else {
          // 2depth 아이템 위/아래 라인 삽입:
          // X축 들여쓰기 감지: 컨테이너 좌측 기준 포인터가 왼쪽(< threshold)이면 1depth 루트로 탈출,
          // 오른쪽(>= threshold)이면 해당 부모 하위의 2depth 유지
          const containerRect = container.getBoundingClientRect();
          const relativeX = e.clientX - containerRect.left;
          const indentThreshold = treeOptions.indentThreshold ?? 40;

          const isLastChildOfParent =
            targetIndex === count - 1 ||
            treeOptions.getDepth(itemsRef.current[targetIndex + 1]) === 1;

          // 'after' 위치이면서 해당 부모의 마지막 자식(또는 전체 목록의 맨 끝)인 경우:
          // 1) 아래로 더 내렸을 때 (isPastBottom): 직관적으로 맨 끝 1depth 루트로 이동!
          // 2) 포인터가 왼쪽 영역(relativeX < threshold)에 있을 때: 1depth 루트로 이동!
          if (mode === "after" && isLastChildOfParent && (isPastBottom || relativeX < indentThreshold)) {
            resolvedDepth = 1;
            resolvedParentId = null;
            resolvedParentName = undefined;
          } else {
            resolvedDepth = 2;
            resolvedParentId = targetParentId;
            resolvedParentName = treeOptions.getParentName?.(resolvedParentId);
          }
        }
      }

      dragInfo.targetIndex = targetIndex;
      dragInfo.mode = mode;
      dragInfo.resolvedDepth = resolvedDepth;
      dragInfo.resolvedParentId = resolvedParentId;
      dragInfo.resolvedParentName = resolvedParentName;

      setOverState({
        targetIndex,
        mode,
        resolvedDepth,
        resolvedParentId,
        resolvedParentName,
      });
    },
    [getId, treeOptions]
  );

  const handlePointerUp = useCallback(
    (_e?: PointerEvent) => {
      cleanUpListenersRef.current();

      const dragInfo = dragInfoRef.current;
      dragInfoRef.current = null;

      if (!dragInfo) return;

      if (!dragInfo.isDragging) {
        // 단순 클릭
        const item = itemsRef.current[dragInfo.startIndex];
        if (item !== undefined) {
          onItemClick(item);
        }
      } else if (dragInfo.targetIndex !== -1) {
        const { startIndex, targetIndex, mode, resolvedDepth, resolvedParentId } = dragInfo;
        const currentList = [...itemsRef.current];

        if (startIndex >= 0 && startIndex < currentList.length) {
          const [movedItem] = currentList.splice(startIndex, 1);

          if (treeOptions) {
            // [2depth 트리 모드 이동 완료]
            let updatedMoved: T;
            if (treeOptions.updateItemHierarchy) {
              updatedMoved = treeOptions.updateItemHierarchy(
                movedItem,
                resolvedDepth,
                resolvedParentId
              );
            } else {
              updatedMoved = {
                ...movedItem,
                depth: resolvedDepth,
                parentId: resolvedParentId,
              };
            }

            let insertIndex = targetIndex;
            if (mode === "inside") {
              const targetItemIndex = currentList.findIndex(
                (it) => String(getId(it)) === String(resolvedParentId)
              );
              insertIndex = targetItemIndex !== -1 ? targetItemIndex + 1 : currentList.length;
            } else {
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

            treeOptions.onDropTreeItem(movedItem, resolvedParentId, currentList);
          } else {
            // [1차원 평면 목록 모드 이동 완료]
            let insertIndex = targetIndex;
            if (startIndex < targetIndex) {
              insertIndex = mode === "after" ? targetIndex : targetIndex - 1;
            } else {
              insertIndex = mode === "after" ? targetIndex + 1 : targetIndex;
            }

            insertIndex = Math.max(0, Math.min(insertIndex, currentList.length));
            currentList.splice(insertIndex, 0, movedItem);

            const oldIdList = itemsRef.current.map(getId).join(",");
            const newIdList = currentList.map(getId).join(",");
            if (oldIdList !== newIdList) {
              onReorder?.(currentList, movedItem, insertIndex);
            }
          }
        }
      }

      setDraggingId(null);
      setOverState(null);
    },
    [getId, onItemClick, onReorder, treeOptions]
  );

  const handleItemPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("a")) {
      return;
    }

    cleanUpListenersRef.current();

    const currentItem = itemsRef.current[index];
    const initialDepth = treeOptions ? treeOptions.getDepth(currentItem) : 1;
    const initialParentId = treeOptions ? treeOptions.getParentId(currentItem) : null;
    const initialParentName = treeOptions?.getParentName?.(initialParentId);

    dragInfoRef.current = {
      startIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      targetIndex: index,
      mode: "before",
      resolvedDepth: initialDepth,
      resolvedParentId: initialParentId,
      resolvedParentName: initialParentName,
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
      cleanUpListeners();
    };
  }, [cleanUpListeners]);

  return (
    <div ref={containerRef} className={`relative select-none touch-none ${className}`}>
      {items.map((item, index) => {
        const itemId = getId(item);
        const isDragging = draggingId !== null && String(draggingId) === String(itemId);
        const isTarget = overState?.targetIndex === index && !isDragging;

        // 2depth 계층 트리 모드 상태
        const isInsideTarget = treeOptions && isTarget && overState?.mode === "inside";
        const dropIndicator: TreeDropIndicator | null =
          treeOptions && isTarget && overState?.mode !== "inside"
            ? {
                position: treeDropPositionSchema.parse(overState.mode),
                targetDepth: overState.resolvedDepth,
                targetParentName: overState.resolvedParentName,
              }
            : null;

        // 1차원 평면 목록 모드 상태
        const dropPosition: "before" | "after" | null =
          !treeOptions && isTarget && overState
            ? (overState.mode as "before" | "after")
            : null;

        return (
          <div
            key={itemId}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onPointerDown={(e) => handleItemPointerDown(e, index)}
            className={`relative touch-none select-none transition-colors duration-150 ${
              isInsideTarget ? "rounded-lg ring-2 ring-theme-accent bg-theme-accent/15" : ""
            }`}
          >
            {/* 트리 모드: 폴더 안으로 넣기(inside) 뱃지 */}
            {isInsideTarget && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center gap-1 bg-theme-accent text-theme-accent-text text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-md animate-bounce">
                <span>
                  {t("sidebar.move_into_set", {
                    name: treeOptions.getItemName
                      ? treeOptions.getItemName(item)
                      : String(itemId),
                  })}
                </span>
              </div>
            )}

            {/* 트리 모드: 위쪽 라인 가이드 */}
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
                        parent: dropIndicator.targetParentName
                          ? `(${dropIndicator.targetParentName})`
                          : "",
                      })}
                    </span>
                  ) : (
                    <span>{t("sidebar.insert_root")}</span>
                  )}
                </span>
              </div>
            )}

            {/* 일반 모드: 위쪽 한 줄 라인 가이드 (서재 세트와 동일한 라인 스타일) */}
            {!treeOptions && isTarget && dropPosition === "before" && (
              <div className="absolute top-0 left-1 right-1 z-30 pointer-events-none -translate-y-1/2 transition-all">
                <div className="h-0.5 w-full bg-theme-accent rounded-full shadow-sm ring-1 ring-theme-accent/50" />
              </div>
            )}

            {renderItem(item, {
              isDragging,
              isOver: isTarget,
              dropPosition,
              isInsideTarget: Boolean(isInsideTarget),
              dropIndicator,
            })}

            {/* 일반 모드: 아래쪽 한 줄 라인 가이드 (서재 세트와 동일한 라인 스타일) */}
            {!treeOptions && isTarget && dropPosition === "after" && (
              <div className="absolute bottom-0 left-1 right-1 z-30 pointer-events-none translate-y-1/2 transition-all">
                <div className="h-0.5 w-full bg-theme-accent rounded-full shadow-sm ring-1 ring-theme-accent/50" />
              </div>
            )}

            {/* 트리 모드: 아래쪽 라인 가이드 */}
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
                        parent: dropIndicator.targetParentName
                          ? `(${dropIndicator.targetParentName})`
                          : "",
                      })}
                    </span>
                  ) : (
                    <span>{t("sidebar.insert_root")}</span>
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
