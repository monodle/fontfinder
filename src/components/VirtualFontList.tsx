import { useRef, useState, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FontMetadata, PreviewSettings, FontLibraryTag } from "../types/font";
import { FontItem } from "./FontItem";
import { appConfig } from "../config/appConfig";
import { isFontFavorite } from "../utils/fontSortUtils";

import { FontDetailMode } from "./font-card/types";

interface VirtualFontListProps {
  fonts: FontMetadata[];
  previewText?: string;
  fontSize?: number;
  previewSettings?: PreviewSettings;
  viewMode: "list" | "grid";
  detailMode?: FontDetailMode;
  gridColumns?: number;
  selectedFontIds: Set<number>;
  favoriteIds?: Set<number>;
  activatedFontIds?: Set<number>;
  onSelectFont: (font: FontMetadata, e: React.MouseEvent) => void;
  onSelectionChange?: (selectedIds: Set<number>) => void;
  onToggleFavorite?: (fontId: number) => void;
  onToggleActivate?: (font: FontMetadata) => void;
  onContextMenu?: (e: React.MouseEvent, font: FontMetadata) => void;
  onSelectLibrary?: (tag: FontLibraryTag, e: React.MouseEvent) => void;
}

const gridColsMap: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function VirtualFontList({
  fonts,
  previewText,
  fontSize,
  previewSettings,
  viewMode,
  detailMode = "detailed",
  gridColumns = 2,
  selectedFontIds,
  favoriteIds,
  activatedFontIds,
  onSelectFont,
  onSelectionChange,
  onToggleFavorite,
  onToggleActivate,
  onContextMenu,
  onSelectLibrary,
}: VirtualFontListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 드래그 선택 상태
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const didDragRef = useRef(false);
  const isMouseDownRef = useRef(false);
  const startPosRef = useRef<{ contentX: number; contentY: number; modifier: "none" | "toggle" | "extend" }>({
    contentX: 0,
    contentY: 0,
    modifier: "none",
  });
  const lastClientPosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const autoScrollAnimRef = useRef<number | null>(null);
  const initialSelectedIdsRef = useRef<Set<number>>(new Set());

  // 리스트 모드일 때는 1열, 그리드 모드일 때는 설정된 gridColumns (2~5) 배치
  const columns = viewMode === "grid" ? gridColumns : 1;
  const rowCount = Math.ceil(fonts.length / columns);

  const effectiveText = previewSettings?.text ?? previewText ?? "";
  const effectiveFontSize = previewSettings?.fontSize ?? fontSize ?? 24;
  const effectiveLineHeight = previewSettings?.lineHeight ?? 1.45;

  // 아이템 대략적 높이: 줄 수와 폰트 크기 및 줄간격에 따라 정밀 추정 (간단 모드/상세 모드 구분)
  const estimateSize = useCallback(() => {
    const lineCount = (effectiveText.match(/\n/g) || []).length + 1;
    const baseOffset = detailMode === "simple" ? 50 : 80;
    const minHeight = detailMode === "simple" ? 105 : 130;
    return Math.max(minHeight, effectiveFontSize * effectiveLineHeight * lineCount + baseOffset);
  }, [detailMode, effectiveFontSize, effectiveLineHeight, effectiveText]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: appConfig.performance.virtualScrollOverscan,
  });

  // 각 행의 [start, end] 컨텐츠 세로 오프셋 계산 (상단 패딩 16px 포함)
  const getRowBounds = useCallback(
    (rowIndex: number) => {
      const PADDING_TOP = 16;
      const cached = rowVirtualizer.measurementsCache[rowIndex];
      if (cached) {
        return {
          start: PADDING_TOP + cached.start,
          end: PADDING_TOP + cached.end,
        };
      }
      // 캐시가 아직 없는 행은 직전 캐시 위치 또는 추정치로 계산
      let baseEnd = 0;
      let lastCachedIndex = -1;
      for (let i = rowIndex - 1; i >= 0; i--) {
        if (rowVirtualizer.measurementsCache[i]) {
          baseEnd = rowVirtualizer.measurementsCache[i].end;
          lastCachedIndex = i;
          break;
        }
      }
      const est = estimateSize();
      const start =
        PADDING_TOP +
        (lastCachedIndex >= 0 ? baseEnd + (rowIndex - lastCachedIndex - 1) * est : rowIndex * est);
      return {
        start,
        end: start + est,
      };
    },
    [estimateSize, rowVirtualizer.measurementsCache]
  );

  // 선택 박스 및 폰트 교차 선택 업데이트
  const updateSelection = useCallback(
    (clientX: number, clientY: number) => {
      const container = parentRef.current;
      if (!container || !isMouseDownRef.current) return;

      const rect = container.getBoundingClientRect();
      const rawContentX = clientX - rect.left + container.scrollLeft;
      const rawContentY = clientY - rect.top + container.scrollTop;

      // 전체 컨텐츠 한도 내로 clamp (불필요한 무한 확장 방지)
      const totalContentHeight = Math.max(
        container.clientHeight,
        rowVirtualizer.getTotalSize() + 32
      );
      const totalContentWidth = Math.max(container.clientWidth, container.scrollWidth);

      const contentX = Math.max(0, Math.min(totalContentWidth, rawContentX));
      const contentY = Math.max(0, Math.min(totalContentHeight, rawContentY));

      const startX = startPosRef.current.contentX;
      const startY = startPosRef.current.contentY;

      const dx = Math.abs(contentX - startX);
      const dy = Math.abs(contentY - startY);

      // 6px 이상 이동 시 드래그 모드로 전환
      if (!isDragging && (dx > 6 || dy > 6)) {
        didDragRef.current = true;
        setIsDragging(true);
        window.getSelection()?.removeAllRanges();
      }

      if (isDragging || dx > 6 || dy > 6) {
        didDragRef.current = true;
        setSelectionBox({
          startX,
          startY,
          currentX: contentX,
          currentY: contentY,
        });

        const boxLeft = Math.min(startX, contentX);
        const boxRight = Math.max(startX, contentX);
        const boxTop = Math.min(startY, contentY);
        const boxBottom = Math.max(startY, contentY);

        // 컬럼 교차 검사 파라미터 (좌우 패딩 16px, 갭 12px)
        const availableWidth = Math.max(0, container.clientWidth - 32);
        const gap = 12;
        const colWidth =
          columns > 1
            ? Math.max(0, (availableWidth - (columns - 1) * gap) / columns)
            : availableWidth;

        const isColIntersecting = (c: number) => {
          const cLeft = 16 + c * (colWidth + gap);
          const cRight = cLeft + colWidth;
          return boxLeft <= cRight && boxRight >= cLeft;
        };

        const draggedFontIds = new Set<number>();

        // 가상화로 DOM에서 제거된 항목도 정확하게 판정되도록 행 기반 수학적 교차 검사
        for (let r = 0; r < rowCount; r++) {
          const { start: rStart, end: rEnd } = getRowBounds(r);

          if (boxTop <= rEnd && boxBottom >= rStart) {
            for (let c = 0; c < columns; c++) {
              if (isColIntersecting(c)) {
                const fontIndex = r * columns + c;
                if (fontIndex < fonts.length) {
                  const targetFont = fonts[fontIndex];
                  const isUnplugged =
                    targetFont.isMissing ||
                    targetFont.install_status === "unplugged" ||
                    targetFont.install_status === "deleted";
                  if (!isUnplugged) {
                    draggedFontIds.add(targetFont.id);
                  }
                }
              }
            }
          } else if (rStart > boxBottom + 300) {
            // 박스 아래를 크게 벗어나면 루프 조기 종료
            break;
          }
        }

        if (onSelectionChange) {
          const modifier = startPosRef.current.modifier;
          if (modifier === "toggle") {
            const next = new Set(initialSelectedIdsRef.current);
            draggedFontIds.forEach((id) => {
              if (initialSelectedIdsRef.current.has(id)) next.delete(id);
              else next.add(id);
            });
            onSelectionChange(next);
          } else if (modifier === "extend") {
            const next = new Set(initialSelectedIdsRef.current);
            draggedFontIds.forEach((id) => next.add(id));
            onSelectionChange(next);
          } else {
            onSelectionChange(draggedFontIds);
          }
        }
      }
    },
    [columns, fonts, getRowBounds, isDragging, onSelectionChange, rowCount]
  );

  // 최신 updateSelection 함수를 참조하기 위한 ref (rAF 루프 및 이벤트 핸들러의 안정성 보장)
  const updateSelectionRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  updateSelectionRef.current = updateSelection;

  // 부드럽고 끊김 없는 경계 오토스크롤 루프
  const stopAutoScroll = useCallback(() => {
    if (autoScrollAnimRef.current !== null) {
      cancelAnimationFrame(autoScrollAnimRef.current);
      autoScrollAnimRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(() => {
    if (autoScrollAnimRef.current !== null) return;

    const EDGE_THRESHOLD = 70; // 감지 임계 영역 (상하 70px)

    const scrollLoop = () => {
      const container = parentRef.current;
      if (!isMouseDownRef.current || !container) {
        stopAutoScroll();
        return;
      }

      const rect = container.getBoundingClientRect();
      const currClientY = lastClientPosRef.current.clientY;
      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxScroll <= 0) {
        stopAutoScroll();
        return;
      }

      let delta = 0;
      // 상단 경계 근처 또는 상단 바깥으로 벗어났을 때 (위로 스크롤)
      if (currClientY < rect.top + EDGE_THRESHOLD && container.scrollTop > 0) {
        const dist = Math.max(0, rect.top + EDGE_THRESHOLD - currClientY);
        // 마우스가 창 밖으로 멀리 나갈수록 더 빠르게 스크롤 (최대 35px/frame)
        delta = -Math.min(35, Math.max(5, dist * 0.45));
      }
      // 하단 경계 근처 또는 하단 바깥으로 벗어났을 때 (아래로 스크롤)
      else if (currClientY > rect.bottom - EDGE_THRESHOLD && container.scrollTop < maxScroll) {
        const dist = Math.max(0, currClientY - (rect.bottom - EDGE_THRESHOLD));
        delta = Math.min(35, Math.max(5, dist * 0.45));
      }

      if (delta !== 0) {
        container.scrollTop = Math.max(0, Math.min(maxScroll, container.scrollTop + delta));

        // 스크롤 변경에 따른 선택 영역 실시간 동기화
        updateSelectionRef.current(
          lastClientPosRef.current.clientX,
          lastClientPosRef.current.clientY
        );

        // 계속해서 다음 프레임 루프 지속
        autoScrollAnimRef.current = requestAnimationFrame(scrollLoop);
      } else {
        // 경계를 벗어나 중앙으로 돌아왔거나 스크롤 끝에 도달한 경우 정지
        stopAutoScroll();
      }
    };

    autoScrollAnimRef.current = requestAnimationFrame(scrollLoop);
  }, [stopAutoScroll]);

  // 마우스 드래그 선택 시작
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 좌클릭만 허용
    if (e.button !== 0) return;

    // 인터랙티브 요소(버튼, 링크, 입력창 등) 또는 언플러그드 폰트 클릭 시에는 드래그 선택 시작하지 않음
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("a") ||
      target.closest("[data-unplugged='true']")
    ) {
      return;
    }

    if (!parentRef.current) return;
    const rect = parentRef.current.getBoundingClientRect();
    const contentX = e.clientX - rect.left + parentRef.current.scrollLeft;
    const contentY = e.clientY - rect.top + parentRef.current.scrollTop;

    let modifier: "none" | "toggle" | "extend" = "none";
    if (e.metaKey || e.ctrlKey) modifier = "toggle";
    else if (e.shiftKey) modifier = "extend";

    didDragRef.current = false;
    isMouseDownRef.current = true;
    lastClientPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    startPosRef.current = { contentX, contentY, modifier };
    initialSelectedIdsRef.current = new Set(selectedFontIds);
  };

  // 마우스/포인터 이동, 마우스 업, 휠 스크롤 및 엣지 자동 스크롤 등록
  useEffect(() => {
    const checkEdgeAndAutoScroll = (clientY: number) => {
      const container = parentRef.current;
      if (!container || !isMouseDownRef.current) return;

      const rect = container.getBoundingClientRect();
      const EDGE_THRESHOLD = 70;
      const maxScroll = container.scrollHeight - container.clientHeight;

      const canScrollUp = maxScroll > 0 && container.scrollTop > 0;
      const canScrollDown = maxScroll > 0 && container.scrollTop < maxScroll;

      const isNearEdge =
        (canScrollUp && clientY < rect.top + EDGE_THRESHOLD) ||
        (canScrollDown && clientY > rect.bottom - EDGE_THRESHOLD);

      if (isNearEdge) {
        startAutoScroll();
      }
    };

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      if (!isMouseDownRef.current || !parentRef.current) return;

      lastClientPosRef.current = { clientX: e.clientX, clientY: e.clientY };
      updateSelectionRef.current(e.clientX, e.clientY);
      checkEdgeAndAutoScroll(e.clientY);
    };

    const handlePointerUp = () => {
      if (!isMouseDownRef.current) return;
      isMouseDownRef.current = false;
      setIsDragging(false);
      setSelectionBox(null);
      stopAutoScroll();
    };

    // 드래그 중 마우스 휠 스크롤 지원 (Windows 등에서 마우스 클릭 상태로 휠 회전 시)
    const handleWheel = (e: WheelEvent) => {
      if (!isMouseDownRef.current || !parentRef.current) return;
      const container = parentRef.current;
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;

      e.preventDefault();
      container.scrollTop = Math.max(0, Math.min(maxScroll, container.scrollTop + e.deltaY));
      updateSelectionRef.current(
        lastClientPosRef.current.clientX,
        lastClientPosRef.current.clientY
      );
      checkEdgeAndAutoScroll(lastClientPosRef.current.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("wheel", handleWheel);
      stopAutoScroll();
    };
  }, [startAutoScroll, stopAutoScroll]);

  // 컨테이너 스크롤 시(휠 등으로 직접 스크롤할 때) 드래그 선택 영역 즉각 동기화
  const handleScroll = () => {
    if (isMouseDownRef.current && (isDragging || didDragRef.current)) {
      updateSelection(lastClientPosRef.current.clientX, lastClientPosRef.current.clientY);
    }
  };

  // 드래그 박스 렌더링 스타일 계산 (외벽 뷰포트 상대 좌표)
  const getBoxStyle = () => {
    if (!selectionBox || !parentRef.current) return null;
    const container = parentRef.current;

    const minContentX = Math.min(selectionBox.startX, selectionBox.currentX);
    const minContentY = Math.min(selectionBox.startY, selectionBox.currentY);
    const width = Math.abs(selectionBox.currentX - selectionBox.startX);
    const height = Math.abs(selectionBox.currentY - selectionBox.startY);

    // 스크롤 컨텐츠 좌표 -> 뷰포트 오버레이 좌표로 변환
    const left = minContentX - container.scrollLeft;
    const top = minContentY - container.scrollTop;

    return { left, top, width, height };
  };

  const boxStyle = getBoxStyle();

  // 빈 배경 클릭 시 선택 해제
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    // 폰트 카드 또는 인터랙티브 요소 내부 클릭이 아니면 전체 선택 해제
    if (
      !target.closest("[data-font-card-id]") &&
      !target.closest("button") &&
      !target.closest("input") &&
      !target.closest("select") &&
      !target.closest("a")
    ) {
      onSelectionChange?.(new Set());
    }
  };

  // 드래그 직후 발생하는 자식 컴포넌트 click 이벤트 가로채기 방지
  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) {
      e.stopPropagation();
      setTimeout(() => {
        didDragRef.current = false;
      }, 50);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Scrollable Container */}
      <div
        ref={parentRef}
        onMouseDown={handleMouseDown}
        onClick={handleContainerClick}
        onClickCapture={handleClickCapture}
        onScroll={handleScroll}
        className={`h-full w-full overflow-y-auto overflow-x-hidden p-4 min-w-0 ${
          isDragging ? "cursor-crosshair" : ""
        }`}
      >
        <div
          className="w-full relative"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columns;
            const rowFonts = fonts.slice(startIndex, startIndex + columns);

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className={`pb-2.5 ${
                    columns > 1 ? `grid ${gridColsMap[columns] || "grid-cols-2"} gap-3` : "flex flex-col"
                  }`}
                >
                  {rowFonts.map((font) => {
                    const isUnplugged =
                      font.isMissing ||
                      font.install_status === "unplugged" ||
                      font.install_status === "deleted";
                    return (
                      <div
                        key={font.id}
                        data-font-card-id={font.id}
                        data-unplugged={isUnplugged ? "true" : undefined}
                        className="min-w-0 h-full"
                      >
                      <FontItem
                        font={font}
                        previewText={previewText}
                        fontSize={fontSize}
                        previewSettings={previewSettings}
                        detailMode={detailMode}
                        columns={columns}
                        isSelected={selectedFontIds.has(font.id)}
                        isFavorite={favoriteIds ? isFontFavorite(font, favoriteIds) : false}
                        isActivated={activatedFontIds?.has(font.id)}
                        onSelect={onSelectFont}
                        onToggleFavorite={onToggleFavorite}
                        onToggleActivate={onToggleActivate}
                        onContextMenu={onContextMenu}
                        onSelectLibrary={onSelectLibrary}
                      />
                    </div>
                  );
                })}
              </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rubberband Selection Box (스크롤 컨테이너 scrollHeight에 영향을 주지 않는 독립 오버레이) */}
      {isDragging && boxStyle && (
        <div
          className="absolute z-30 pointer-events-none rounded border border-theme-accent shadow-xs"
          style={{
            left: `${boxStyle.left}px`,
            top: `${boxStyle.top}px`,
            width: `${boxStyle.width}px`,
            height: `${boxStyle.height}px`,
            backgroundColor: "color-mix(in srgb, var(--theme-accent) 18%, transparent)",
          }}
        />
      )}
    </div>
  );
}
