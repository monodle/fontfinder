import { useTranslation } from "react-i18next";
import { GripVertical, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { DIFF_SLOT_CONFIGS, DiffSlotState } from "../../types/diff";
import { SortableSidebarList } from "../common";

interface VerticalDepthRailProps {
  slots: DiffSlotState[];
  depthOrder: number[]; // 슬롯 인덱스 배열 (예: [0, 1, 2, 3, 4])
  activeFocusSlot: number | null;
  onDepthOrderChange: (newOrder: number[]) => void;
  onSelectFocusSlot: (slotIndex: number) => void;
  onHoverSlot: (slotIndex: number | null) => void;
  onToggleVisibility: (slotIndex: number) => void;
}

export function VerticalDepthRail({
  slots,
  depthOrder,
  activeFocusSlot,
  onDepthOrderChange,
  onSelectFocusSlot,
  onHoverSlot,
  onToggleVisibility,
}: VerticalDepthRailProps) {
  const { t } = useTranslation();
  // 등록된 폰트가 있는 슬롯만 필터링
  const filledSlots = depthOrder.filter((idx) => slots[idx]?.font !== null);

  // 위/아래 수동 스왑 핸들러 (버튼 클릭용)
  const handleMove = (currentFilledPos: number, direction: "up" | "down") => {
    const targetFilledPos = direction === "up" ? currentFilledPos - 1 : currentFilledPos + 1;
    if (targetFilledPos < 0 || targetFilledPos >= filledSlots.length) return;

    const slotA = filledSlots[currentFilledPos];
    const slotB = filledSlots[targetFilledPos];

    // 전체 depthOrder에서 두 슬롯의 위치를 교환
    const newOrder = [...depthOrder];
    const posA = newOrder.indexOf(slotA);
    const posB = newOrder.indexOf(slotB);
    if (posA !== -1 && posB !== -1) {
      newOrder[posA] = slotB;
      newOrder[posB] = slotA;
      onDepthOrderChange(newOrder);
    }
  };

  // SortableSidebarList 기반 드래그 앤 드롭 순서 변경 핸들러
  const handleReorder = (newFilledSlots: number[]) => {
    let filledCursor = 0;
    const newOrder = depthOrder.map((idx) => {
      if (slots[idx]?.font !== null) {
        return newFilledSlots[filledCursor++];
      }
      return idx;
    });
    onDepthOrderChange(newOrder);
  };

  if (filledSlots.length === 0) {
    return (
      <div className="w-16 border-r border-theme-border bg-theme-sidebar/50 p-2 flex flex-col items-center justify-center text-center select-none text-[11px] text-theme-text-muted">
        <span className="writing-vertical-lr tracking-wider opacity-60">
          {t("diff.slot_empty")}
        </span>
      </div>
    );
  }

  return (
    <aside
      className="w-48 sm:w-56 border-r border-theme-border bg-theme-sidebar/60 flex flex-col shrink-0 select-none overflow-y-auto"
      aria-label={t("diff.depth_rail_aria")}
    >
      {/* 헤더 */}
      <div className="p-3 border-b border-theme-border/70 flex items-center justify-between">
        <span className="text-[11px] font-bold text-theme-text-secondary tracking-wider uppercase">
          {t("diff.depth_rail_title")}
        </span>
        <span className="text-[10px] text-theme-text-muted font-mono">
          {t("diff.layers_count", { count: filledSlots.length })}
        </span>
      </div>

      {/* 레일 트랙 및 라벨 목록 (SortableSidebarList 기반 포인터 드래그 앤 드롭) */}
      <div className="flex-1 p-2.5 flex flex-col gap-2">
        <div className="text-[10px] text-theme-text-muted px-1 flex items-center justify-between font-mono">
          <span>{t("diff.top_layer")}</span>
          <span>(3200)</span>
        </div>

        <SortableSidebarList
          items={filledSlots}
          getId={(slotIdx) => slotIdx}
          onReorder={handleReorder}
          onItemClick={(slotIdx) => onSelectFocusSlot(slotIdx)}
          className="space-y-1.5"
          renderItem={(slotIdx, { isDragging, dropPosition }) => {
            const filledPos = filledSlots.indexOf(slotIdx);
            const slot = slots[slotIdx];
            const config = DIFF_SLOT_CONFIGS[slotIdx];
            const isFocused = activeFocusSlot === slotIdx;
            // z-index: 위쪽 항목일수록 더 높은 z-index 부여 (최하위 3000, 10단위)
            const calculatedZIndex = 3000 + (filledSlots.length - 1 - filledPos) * 10;

            return (
              <div
                onMouseEnter={() => onHoverSlot(slotIdx)}
                onMouseLeave={() => onHoverSlot(null)}
                className={`group relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                  isFocused
                    ? `${config.bgActive} bg-theme-card shadow-sm`
                    : "bg-theme-card/80 border-theme-border/80 hover:bg-theme-card hover:border-theme-border"
                } ${
                  isDragging ? "opacity-30 scale-[0.98] bg-theme-active border-dashed" : ""
                } ${
                  dropPosition === "before"
                    ? "border-t-2 border-theme-accent bg-theme-accent-subtle/50"
                    : dropPosition === "after"
                    ? "border-b-2 border-theme-accent bg-theme-accent-subtle/50"
                    : ""
                }`}
              >
                {/* 드래그 핸들 */}
                <div
                  className="text-theme-text-muted group-hover:text-theme-accent transition-colors p-0.5 pointer-events-none"
                  title={t("diff.drag_to_reorder")}
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* 고정 색상 칩 & 서체 정보 */}
                <div className="flex-1 min-w-0 pointer-events-none">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: config.color }}
                    />
                    <span
                      className="text-xs font-semibold text-theme-text truncate"
                      title={slot?.font?.full_name || slot?.font?.family_name}
                    >
                      {slot?.font?.family_name || slot?.font?.full_name}
                    </span>
                    <span className="text-[10px] text-theme-text-muted font-mono ml-auto shrink-0">
                      z:{calculatedZIndex}
                    </span>
                  </div>
                </div>

                {/* 가시성 토글 & 순서 이동 버튼들 */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(slotIdx);
                    }}
                    className="p-1 rounded text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                    title={
                      slot?.visible
                        ? t("diff.hide_layer")
                        : t("diff.show_layer")
                    }
                  >
                    {slot?.visible ? (
                      <Eye className="w-3.5 h-3.5 text-theme-text-secondary" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                    )}
                  </button>

                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={filledPos === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(filledPos, "up");
                      }}
                      className="p-0.5 rounded text-theme-text-muted hover:text-theme-text hover:bg-theme-hover disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title={t("diff.move_up")}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={filledPos === filledSlots.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(filledPos, "down");
                      }}
                      className="p-0.5 rounded text-theme-text-muted hover:text-theme-text hover:bg-theme-hover disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title={t("diff.move_down")}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        />

        <div className="text-[10px] text-theme-text-muted px-1 flex items-center justify-between font-mono mt-auto pt-2">
          <span>{t("diff.bottom_layer")}</span>
          <span>(3000)</span>
        </div>
      </div>
    </aside>
  );
}
