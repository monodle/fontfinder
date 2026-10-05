import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata } from "../../types/font";
import {
  DIFF_SLOT_CONFIGS,
  DiffMasterSettings,
  DiffSlotState,
} from "../../types/diff";
import { loadFontIntoDocument } from "../../utils/fontLoader";
import { DiffMasterControl } from "./DiffMasterControl";
import { VerticalDepthRail } from "./VerticalDepthRail";
import { GlyphCanvas } from "./GlyphCanvas";
import { DiffSlotCard } from "./DiffSlotCard";

interface GlyphDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFonts: FontMetadata[];
  allFonts: FontMetadata[];
  fallbackText: string;
}

export function GlyphDiffModal({
  isOpen,
  onClose,
  initialFonts,
  allFonts,
  fallbackText,
}: GlyphDiffModalProps) {
  const { t } = useTranslation();
  // 1. 마스터 전역 설정 상태
  const [masterSettings, setMasterSettings] = useState<DiffMasterSettings>(() => {
    const raw = fallbackText?.trim() || "Rghe";
    const initialClean = Array.from(raw.replace(/\s+/g, "")).slice(0, 4).join("");
    return {
      text: initialClean || "Rghe",
      fontSize: 280,
      showGrid: true,
      isBold: false,
      isItalic: false,
      renderMode: "fill",
    };
  });

  // 2. 5개 고정 슬롯 상태
  const [slots, setSlots] = useState<DiffSlotState[]>(() => {
    return DIFF_SLOT_CONFIGS.map((_config, idx) => {
      const font = initialFonts[idx] || null;
      return {
        slotIndex: idx,
        font,
        fontFamily: "var(--font-system)",
        visible: true,
        opacity: 60,
        fontSize: 280,
        offsetX: 0,
        offsetY: 0,
        isBold: false,
        isItalic: false,
        renderMode: "fill",
      };
    });
  });

  // 3. 레이어 z-index 순서 (깊이 제어용 슬롯 인덱스 배열)
  const [depthOrder, setDepthOrder] = useState<number[]>([0, 1, 2, 3, 4]);

  // 4. 활성 포커스 슬롯 인덱스 (키보드 조작 대상)
  const [activeFocusSlot, setActiveFocusSlot] = useState<number | null>(() => {
    return initialFonts.length > 0 ? 0 : null;
  });

  // 5. 마우스 호버 슬롯 인덱스
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);

  // 모달이 열릴 때 초기 폰트 로드 및 상태 초기화
  useEffect(() => {
    if (!isOpen) return;

    // 초기 문구 세팅
    const raw = fallbackText?.trim() || "Rghe";
    const initialClean = Array.from(raw.replace(/\s+/g, "")).slice(0, 4).join("");
    setMasterSettings((prev) => ({
      ...prev,
      text: initialClean || "Rghe",
    }));

    // 슬롯 폰트 바인딩 및 폰트 파일 동적 로드
    const newSlots: DiffSlotState[] = DIFF_SLOT_CONFIGS.map((_config, idx) => {
      const font = initialFonts[idx] || null;
      return {
        slotIndex: idx,
        font,
        fontFamily: "var(--font-system)",
        visible: true,
        opacity: 60,
        fontSize: 280,
        offsetX: 0,
        offsetY: 0,
        isBold: false,
        isItalic: false,
        renderMode: "fill",
      };
    });

    setSlots(newSlots);
    setActiveFocusSlot(initialFonts.length > 0 ? 0 : null);
    setDepthOrder([0, 1, 2, 3, 4]);

    // 각 폰트 로딩
    initialFonts.forEach((font, idx) => {
      if (idx < 5 && font) {
        loadFontIntoDocument(font).then((familyName) => {
          setSlots((prev) =>
            prev.map((s) => (s.slotIndex === idx ? { ...s, fontFamily: familyName } : s))
          );
        });
      }
    });
  }, [isOpen, initialFonts, fallbackText]);

  // 마스터 서식 변경 시 등록된 모든 슬롯의 서식 및 크기 일괄 동기화
  const handleMasterSettingsChange = useCallback(
    (updater: (prev: DiffMasterSettings) => DiffMasterSettings) => {
      setMasterSettings((prev) => {
        const next = updater(prev);
        const isStyleChanged =
          next.isBold !== prev.isBold ||
          next.isItalic !== prev.isItalic ||
          next.renderMode !== prev.renderMode;
        const isSizeChanged = next.fontSize !== prev.fontSize;

        if (isStyleChanged || isSizeChanged) {
          setSlots((currentSlots) =>
            currentSlots.map((slot) => ({
              ...slot,
              isBold: next.isBold,
              isItalic: next.isItalic,
              renderMode: next.renderMode,
              fontSize: isSizeChanged ? next.fontSize : slot.fontSize,
            }))
          );
        }
        return next;
      });
    },
    []
  );

  // 전체 위치 초기화 [ ⟲ ]
  const handleResetAllPositions = useCallback(() => {
    setSlots((prev) =>
      prev.map((slot) => ({
        ...slot,
        offsetX: 0,
        offsetY: 0,
      }))
    );
  }, []);

  // 특정 슬롯 폰트 해제
  const handleRemoveFont = useCallback(
    (slotIndex: number) => {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.slotIndex === slotIndex
            ? {
                ...slot,
                font: null,
                fontFamily: "var(--font-system)",
                offsetX: 0,
                offsetY: 0,
              }
            : slot
        )
      );
      if (activeFocusSlot === slotIndex) {
        // 남은 활성 슬롯 중 첫 번째로 포커스 이동
        const remaining = slots.find((s) => s.slotIndex !== slotIndex && s.font !== null);
        setActiveFocusSlot(remaining ? remaining.slotIndex : null);
      }
    },
    [activeFocusSlot, slots]
  );

  // 특정 슬롯에 폰트 추가
  const handleAddFont = useCallback(
    (slotIndex: number, font: FontMetadata) => {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.slotIndex === slotIndex
            ? {
                ...slot,
                font,
                visible: true,
                fontSize: masterSettings.fontSize,
                offsetX: 0,
                offsetY: 0,
              }
            : slot
        )
      );
      setActiveFocusSlot(slotIndex);

      // 동적 폰트 로드
      loadFontIntoDocument(font).then((familyName) => {
        setSlots((prev) =>
          prev.map((s) => (s.slotIndex === slotIndex ? { ...s, fontFamily: familyName } : s))
        );
      });
    },
    [masterSettings.fontSize]
  );

  // 특정 슬롯 상태 업데이트
  const handleUpdateSlot = useCallback(
    (slotIndex: number, updater: (prev: DiffSlotState) => DiffSlotState) => {
      setSlots((prev) =>
        prev.map((slot) => (slot.slotIndex === slotIndex ? updater(slot) : slot))
      );
    },
    []
  );

  // 특정 슬롯 가시성 토글
  const handleToggleVisibility = useCallback((slotIndex: number) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.slotIndex === slotIndex ? { ...slot, visible: !slot.visible } : slot
      )
    );
  }, []);

  // 키보드 미세 위치 조절 및 단축키 핸들러
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 인풋 필드나 텍스트에어리어에 포커스가 있을 때는 단축키 무시
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // ESC: 모달 닫기
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (activeFocusSlot === null) return;
      const targetSlot = slots[activeFocusSlot];
      if (!targetSlot || !targetSlot.font) return;

      // 숫자 0: 원점 (0, 0) 복귀
      if (e.key === "0") {
        e.preventDefault();
        handleUpdateSlot(activeFocusSlot, (prev) => ({
          ...prev,
          offsetX: 0,
          offsetY: 0,
        }));
        return;
      }

      // 방향키 이동 거리 (Ctrl: 1px, Alt: 5px, Shift: 10px, 기본: 1px)
      let step = 1;
      if (e.shiftKey) {
        step = 10;
      } else if (e.altKey) {
        step = 5;
      } else if (e.ctrlKey || e.metaKey) {
        step = 1;
      }

      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowLeft") {
        dx = -step;
      } else if (e.key === "ArrowRight") {
        dx = step;
      } else if (e.key === "ArrowUp") {
        dy = -step;
      } else if (e.key === "ArrowDown") {
        dy = step;
      } else {
        return;
      }

      e.preventDefault();
      handleUpdateSlot(activeFocusSlot, (prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, activeFocusSlot, slots, onClose, handleUpdateSlot]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("diff.modal_aria")}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-[96vw] max-w-7xl h-[92vh] bg-[var(--theme-bg-app)] border border-theme-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* 1. 상단 컨트롤 패널 (마스터 공통 서식 제어) */}
        <DiffMasterControl
          settings={masterSettings}
          onSettingsChange={handleMasterSettingsChange}
          onResetAllPositions={handleResetAllPositions}
          onClose={onClose}
        />

        {/* 2. 중앙 메인: 좌측 세로 깊이 제어기 + 글리프 분할 오버레이 캔버스 */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative bg-[var(--theme-bg-app)]">
          <VerticalDepthRail
            slots={slots}
            depthOrder={depthOrder}
            activeFocusSlot={activeFocusSlot}
            onDepthOrderChange={setDepthOrder}
            onSelectFocusSlot={setActiveFocusSlot}
            onHoverSlot={setHoveredSlotIndex}
            onToggleVisibility={handleToggleVisibility}
          />

          <GlyphCanvas
            slots={slots}
            depthOrder={depthOrder}
            masterSettings={masterSettings}
            hoveredSlotIndex={hoveredSlotIndex}
            activeFocusSlot={activeFocusSlot}
          />
        </div>

        {/* 3. 하단 5개 슬롯 폰트 레이어 관리 바 (레이어 순서 depthOrder와 동기화) */}
        <footer className="p-3 sm:p-4 border-t border-theme-border bg-theme-header shrink-0 overflow-x-auto">
          <div className="flex items-center gap-3 min-w-[1050px]">
            {depthOrder.map((slotIdx) => {
              const config = DIFF_SLOT_CONFIGS[slotIdx];
              return (
                <DiffSlotCard
                  key={config.index}
                  slot={slots[slotIdx]}
                  slotIndex={slotIdx}
                  isFocused={activeFocusSlot === slotIdx}
                  allFonts={allFonts}
                  onSelectFocus={() => setActiveFocusSlot(slotIdx)}
                  onRemoveFont={() => handleRemoveFont(slotIdx)}
                  onAddFont={(font) => handleAddFont(slotIdx, font)}
                  onUpdateSlot={(updater) => handleUpdateSlot(slotIdx, updater)}
                  onResetPosition={() =>
                    handleUpdateSlot(slotIdx, (prev) => ({ ...prev, offsetX: 0, offsetY: 0 }))
                  }
                />
              );
            })}
          </div>
        </footer>
      </div>
    </div>
  );
}
