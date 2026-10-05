import { useState, useRef, useEffect, ReactNode, useCallback } from "react";

interface SortableItemState {
  isDragging: boolean;
  isOver: boolean;
  dropPosition: "before" | "after" | null;
}

interface SortableSidebarListProps<T> {
  items: T[];
  getId: (item: T) => string | number;
  onReorder: (newItems: T[]) => void;
  onItemClick: (item: T) => void;
  renderItem: (item: T, state: SortableItemState) => ReactNode;
  className?: string;
}

export function SortableSidebarList<T>({
  items,
  getId,
  onReorder,
  onItemClick,
  renderItem,
  className = "space-y-0.5",
}: SortableSidebarListProps<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overState, setOverState] = useState<{ index: number; position: "before" | "after" } | null>(null);

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const dragInfoRef = useRef<{
    startIndex: number;
    startY: number;
    isDragging: boolean;
    overIndex: number;
    dropPosition: "before" | "after";
  } | null>(null);

  const cleanUpListeners = useCallback(() => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handlePointerMove = (e: PointerEvent) => {
    const dragInfo = dragInfoRef.current;
    if (!dragInfo) return;

    const diffY = Math.abs(e.clientY - dragInfo.startY);

    // 4px 이상 움직였을 때 드래그 모드로 돌입
    if (!dragInfo.isDragging && diffY > 4) {
      dragInfo.isDragging = true;
      setDraggingIndex(dragInfo.startIndex);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    if (!dragInfo.isDragging) return;

    // 현재 마우스 Y 좌표가 위치한 아이템 검색
    let targetIndex = -1;
    let position: "before" | "after" = "before";

    const count = itemRefs.current.length;
    for (let i = 0; i < count; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetIndex = i;
        position = e.clientY > rect.top + rect.height / 2 ? "after" : "before";
        break;
      }
    }

    // 영역 밖일 경우 상/하단 클램핑
    if (targetIndex === -1 && count > 0) {
      const firstEl = itemRefs.current[0];
      const lastEl = itemRefs.current[count - 1];
      if (firstEl && e.clientY < firstEl.getBoundingClientRect().top) {
        targetIndex = 0;
        position = "before";
      } else if (lastEl && e.clientY > lastEl.getBoundingClientRect().bottom) {
        targetIndex = count - 1;
        position = "after";
      }
    }

    if (targetIndex !== -1) {
      dragInfo.overIndex = targetIndex;
      dragInfo.dropPosition = position;
      setOverState({ index: targetIndex, position });
    }
  };

  const handlePointerUp = (_e?: PointerEvent) => {
    cleanUpListeners();
    const dragInfo = dragInfoRef.current;
    dragInfoRef.current = null;

    if (!dragInfo) return;

    if (!dragInfo.isDragging) {
      // 드래그가 아니었으므로 일반 클릭 처리
      const item = itemsRef.current[dragInfo.startIndex];
      if (item !== undefined) {
        onItemClick(item);
      }
    } else {
      // 드래그 완료: 새로운 순서 계산
      const { startIndex, overIndex, dropPosition } = dragInfo;
      const currentItems = [...itemsRef.current];

      if (startIndex >= 0 && startIndex < currentItems.length) {
        const [movedItem] = currentItems.splice(startIndex, 1);

        // splice 이후의 overIndex 재계산
        let insertIndex = overIndex;
        if (startIndex < overIndex) {
          insertIndex = dropPosition === "after" ? overIndex : overIndex - 1;
        } else {
          insertIndex = dropPosition === "after" ? overIndex + 1 : overIndex;
        }

        insertIndex = Math.max(0, Math.min(insertIndex, currentItems.length));
        currentItems.splice(insertIndex, 0, movedItem);

        // 실제 순서 변경이 일어났을 때만 콜백 호출
        const oldIdList = itemsRef.current.map(getId).join(",");
        const newIdList = currentItems.map(getId).join(",");
        if (oldIdList !== newIdList) {
          onReorder(currentItems);
        }
      }
    }

    setDraggingIndex(null);
    setOverState(null);
  };

  const handleItemPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    // 마우스 좌클릭만 허용
    if (e.button !== 0) return;

    // 버튼이나 입력폼 등 자식 인터랙티브 요소를 클릭한 경우 드래그 시작 안 함
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) {
      return;
    }

    dragInfoRef.current = {
      startIndex: index,
      startY: e.clientY,
      isDragging: false,
      overIndex: index,
      dropPosition: "before",
    };

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
    <div className={className}>
      {items.map((item, index) => {
        const key = getId(item);
        const isDragging = draggingIndex === index;
        const isOver = overState?.index === index && draggingIndex !== null && draggingIndex !== index;
        const dropPosition = isOver ? overState.position : null;

        return (
          <div
            key={key}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onPointerDown={(e) => handleItemPointerDown(e, index)}
            className="touch-none select-none"
          >
            {renderItem(item, { isDragging, isOver, dropPosition })}
          </div>
        );
      })}
    </div>
  );
}
