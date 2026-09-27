import { useMemo } from "react";
import { DIFF_SLOT_CONFIGS, DiffMasterSettings, DiffSlotState } from "../../types/diff";

interface GlyphCanvasProps {
  slots: DiffSlotState[];
  depthOrder: number[]; // [slotIndex, ...]
  masterSettings: DiffMasterSettings;
  hoveredSlotIndex: number | null;
  activeFocusSlot: number | null;
}

export function GlyphCanvas({
  slots,
  depthOrder,
  masterSettings,
  hoveredSlotIndex,
  activeFocusSlot,
}: GlyphCanvasProps) {
  const characters = useMemo(() => {
    return Array.from(masterSettings.text.replace(/\s+/g, "")).slice(0, 4);
  }, [masterSettings.text]);

  // 등록된 폰트가 있는 슬롯 목록
  const activeSlots = depthOrder.filter(
    (idx) => slots[idx]?.font !== null && slots[idx]?.visible
  );


  // 글자가 없는 경우 빈 상태 표시
  if (characters.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--theme-bg-app)] select-none text-theme-text-muted">
        <div className="p-4 rounded-2xl border border-dashed border-theme-border flex flex-col items-center gap-2 max-w-sm text-center bg-[var(--theme-bg-card)]">
          <span className="text-sm font-medium text-theme-text-secondary">
            비교할 문자가 없습니다
          </span>
          <span className="text-xs text-theme-text-muted">
            상단 입력창에 글자를 입력하시면 글리프별 오버레이 캔버스가 표시됩니다.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 flex items-center justify-center bg-[var(--theme-bg-app)] select-none">
      {/* 2×2 그리드 레이아웃: 좌상단(#1), 우상단(#2), 좌하단(#3), 우하단(#4) 4분할 대형 영역 */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full max-w-5xl lg:max-w-6xl items-center justify-items-center my-auto">
        {characters.map((char, charIdx) => (
          <div
            key={charIdx}
            className="relative flex flex-col items-center bg-[var(--theme-bg-card)] rounded-2xl border border-theme-border shadow-md overflow-hidden shrink-0 w-full max-w-[380px] sm:max-w-[440px] lg:max-w-[480px] aspect-square"
          >
            {/* 글리프 박스 내부 정사각 모눈 격자 (Square Grid Pattern) */}
            {masterSettings.showGrid && (
              <div
                className="absolute inset-0 pointer-events-none opacity-45 dark:opacity-30 z-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, var(--color-theme-border, #cbd5e1) 1px, transparent 1px),
                    linear-gradient(to bottom, var(--color-theme-border, #cbd5e1) 1px, transparent 1px)
                  `,
                  backgroundSize: "20px 20px",
                }}
              />
            )}


            {/* 폰트들이 겹쳐지는 캔버스 영역 (정중앙 모눈 격자 정렬) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              {activeSlots.map((slotIdx, orderPos) => {
                const slot = slots[slotIdx];
                if (!slot || !slot.font) return null;

                const config = DIFF_SLOT_CONFIGS[slotIdx];
                const calculatedZIndex = 3000 + (activeSlots.length - 1 - orderPos) * 10;
                const isHovered = hoveredSlotIndex === slotIdx;
                const isAnotherHovered = hoveredSlotIndex !== null && !isHovered;
                const isFocused = activeFocusSlot === slotIdx;

                // Opacity 계산: 호버 시 비호버 레이어는 딤 처리 (0.2배)
                const baseOpacity = slot.opacity / 100;
                const effectiveOpacity = isAnotherHovered ? baseOpacity * 0.25 : baseOpacity;

                // Stroke vs Fill 스타일
                const isStroke = slot.renderMode === "stroke";

                return (
                  <span
                    key={slotIdx}
                    className="absolute transition-transform duration-75 select-none leading-none inline-block"
                    style={{
                      fontFamily: slot.fontFamily,
                      fontSize: `${slot.fontSize || masterSettings.fontSize}px`,
                      fontWeight: slot.isBold ? "bold" : "normal",
                      fontStyle: slot.isItalic ? "italic" : "normal",
                      color: isStroke ? "transparent" : config.color,
                      WebkitTextStroke: isStroke ? `2px ${config.color}` : undefined,
                      opacity: effectiveOpacity,
                      zIndex: calculatedZIndex,
                      transform: `translate(${slot.offsetX}px, ${slot.offsetY}px)`,
                      filter: isHovered
                        ? `drop-shadow(0 0 6px ${config.color}88)`
                        : isFocused
                          ? `drop-shadow(0 0 2px ${config.color}66)`
                          : undefined,
                    }}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
