import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  X,
  Plus,
  Search,
  Bold,
  Italic,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { FontMetadata } from "../../types/font";
import { DIFF_SLOT_CONFIGS, DiffSlotState } from "../../types/diff";

interface DiffSlotCardProps {
  slot: DiffSlotState;
  slotIndex: number;
  isFocused: boolean;
  allFonts: FontMetadata[];
  onSelectFocus: () => void;
  onRemoveFont: () => void;
  onAddFont: (font: FontMetadata) => void;
  onUpdateSlot: (updater: (prev: DiffSlotState) => DiffSlotState) => void;
  onResetPosition: () => void;
}

export function DiffSlotCard({
  slot,
  slotIndex,
  isFocused,
  allFonts,
  onSelectFocus,
  onRemoveFont,
  onAddFont,
  onUpdateSlot,
  onResetPosition,
}: DiffSlotCardProps) {
  const { t } = useTranslation();
  const config = DIFF_SLOT_CONFIGS[slotIndex];
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ left: number; bottom: number; width: number } | null>(null);

  // 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        addButtonRef.current &&
        !addButtonRef.current.contains(target)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchOpen]);

  // 검색창 위치 계산 (버튼 위로 자연스럽게 상향 배치)
  useEffect(() => {
    if (!isSearchOpen) return;

    const updatePosition = () => {
      if (!addButtonRef.current) return;
      const rect = addButtonRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      if (left < 16) left = 16;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      // 버튼 위쪽으로 띄움 (바닥 기준 배치)
      const bottom = Math.max(16, window.innerHeight - rect.top + 8);
      setPopoverCoords({ left, bottom, width: popoverWidth });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, [isSearchOpen]);

  // 검색창 열릴 때 포커스
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [isSearchOpen]);

  const hasQuery = searchQuery.trim().length > 0;

  // 검색 필터링된 폰트 목록 (검색어가 있을 때만 결과 추출)
  const filteredFonts = useMemo(() => {
    if (!hasQuery) return [];
    const q = searchQuery.toLowerCase().trim();
    return allFonts
      .filter(
        (f) =>
          f.full_name?.toLowerCase().includes(q) ||
          f.family_name?.toLowerCase().includes(q) ||
          f.file_name?.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [allFonts, searchQuery, hasQuery]);

  // B 형태: 폰트가 비어있는 슬롯 카드 (Empty Dashed Card)
  if (!slot.font) {
    return (
      <div
        className={`relative flex-1 min-w-[200px] h-48 rounded-2xl border-2 border-dashed border-theme-border/80 hover:border-theme-border flex flex-col items-center justify-center p-3 transition-all bg-theme-card/30 ${
          isFocused ? "ring-2 ring-theme-accent/40" : ""
        }`}
        onClick={onSelectFocus}
      >
        <div className="flex flex-col items-center gap-2.5 select-none">
          <span
            className="w-2.5 h-2.5 rounded-full shadow-2xs"
            style={{ backgroundColor: config.color }}
          />

          <button
            ref={addButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectFocus();
              setIsSearchOpen((prev) => !prev);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-theme-border bg-theme-card hover:bg-theme-hover text-xs font-semibold text-theme-text shadow-2xs transition-all cursor-pointer"
            title={t("diff.add_font_tooltip", "서체 추가")}
          >
            <Plus className="w-3.5 h-3.5 text-theme-accent" />
            <span>{t("diff.add_font_btn", "+ 폰트 추가")}</span>
          </button>
        </div>

        {/* 폰트 추가 검색 팝오버 (createPortal로 부모 overflow 클리핑 완전 방지) */}
        {isSearchOpen &&
          popoverCoords &&
          createPortal(
            <div
              ref={popoverRef}
              style={{
                position: "fixed",
                left: `${popoverCoords.left}px`,
                bottom: `${popoverCoords.bottom}px`,
                width: `${popoverCoords.width}px`,
                zIndex: 9999,
              }}
              className="bg-theme-surface border border-theme-border rounded-2xl shadow-2xl p-2.5 z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1 border-b border-theme-border">
                <span className="text-[11px] font-bold text-theme-text-secondary flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <span>{t("diff.search_and_add_title", "서체 검색 및 추가")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="p-0.5 rounded text-theme-text-muted hover:text-theme-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2.5 text-theme-text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("diff.search_font_placeholder", "폰트 이름 검색...")}
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-theme-input border border-theme-border rounded-lg text-theme-text focus:outline-none focus:border-theme-accent shadow-2xs"
                />
              </div>

              {/* 검색어가 입력되었을 때만 검색 결과 리스트 노출 */}
              {hasQuery && (
                <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-1 border-t border-theme-border/60 pt-1.5 animate-in fade-in duration-100">
                  {filteredFonts.length === 0 ? (
                    <div className="text-center py-4 text-xs text-theme-text-muted">
                      {t("diff.no_matching_fonts", "일치하는 폰트가 없습니다")}
                    </div>
                  ) : (
                    filteredFonts.map((font) => (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => {
                          onAddFont(font);
                          setIsSearchOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-theme-hover text-xs text-theme-text transition-colors flex flex-col cursor-pointer"
                      >
                        <span className="font-medium truncate">{font.full_name || font.family_name}</span>
                        <span className="text-[10px] text-theme-text-muted truncate">
                          {font.family_name} ({font.subfamily_name || "Regular"})
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>,
            document.body
          )}
      </div>
    );
  }

  // A 형태: 폰트가 등록된 슬롯 카드 (Filled Card)
  return (
    <div
      onClick={onSelectFocus}
      className={`relative flex-1 min-w-[200px] h-48 rounded-2xl border bg-theme-card/85 backdrop-blur-xs p-3 flex flex-col justify-between transition-all select-none shadow-xs cursor-pointer ${
        isFocused
          ? `${config.bgActive} bg-theme-card`
          : "border-theme-border/90 hover:border-theme-border"
      }`}
    >
      {/* 1. 헤더: 색상 점, 서체명, 우측 상단 폰트 해제 [X] 버튼 */}
      <div className="flex items-center justify-between gap-1.5 border-b border-theme-border/60 pb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: config.color }}
          />
          <div
            className="text-xs font-bold text-theme-text truncate"
            title={slot.font.full_name || slot.font.family_name}
          >
            {slot.font.family_name || slot.font.full_name}
          </div>
        </div>

        {/* 폰트 해제 [ X ] 버튼 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFont();
          }}
          className="p-1 rounded-lg text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer shrink-0"
          title={t("diff.remove_from_diff", "비교에서 폰트 해제")}
          aria-label={t("diff.remove_from_diff", "비교에서 폰트 해제")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. 바디: 개별 서식 및 투명도, 위치 조절 */}
      <div className="flex flex-col gap-1.5 mt-1">
        {/* 서식 토글 (B, I, U) & Fill / Stroke 미니 세그먼트 */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center bg-theme-card border border-theme-border rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateSlot((prev) => ({ ...prev, isBold: !prev.isBold }));
              }}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors text-[11px] cursor-pointer ${
                slot.isBold
                  ? "bg-theme-accent text-theme-accent-text font-bold"
                  : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
              }`}
              title={t("diff.bold_tooltip", "굵게")}
            >
              <Bold className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateSlot((prev) => ({ ...prev, isItalic: !prev.isItalic }));
              }}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors text-[11px] cursor-pointer ${
                slot.isItalic
                  ? "bg-theme-accent text-theme-accent-text italic font-bold"
                  : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
              }`}
              title={t("diff.italic_tooltip", "기울임")}
            >
              <Italic className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center bg-theme-card border border-theme-border rounded-lg p-0.5 gap-0.5 text-[10px] font-medium">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateSlot((prev) => ({ ...prev, renderMode: "fill" }));
              }}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                slot.renderMode === "fill"
                  ? "bg-theme-accent text-theme-accent-text font-semibold"
                  : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
              }`}
            >
              {t("diff.fill", "Fill")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateSlot((prev) => ({ ...prev, renderMode: "stroke" }));
              }}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                slot.renderMode === "stroke"
                  ? "bg-theme-accent text-theme-accent-text font-semibold"
                  : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
              }`}
            >
              {t("diff.stroke", "Stroke")}
            </button>
          </div>
        </div>

        {/* 슬라이더 컨트롤 그룹 (크기 & 투명도) */}
        <div className="flex flex-col gap-1">
          {/* 1. 개별 폰트 크기 슬라이더 */}
          <div className="flex items-center gap-1.5 text-[10px] text-theme-text-secondary">
            <span className="font-mono text-[9px] text-theme-text-muted w-5 shrink-0">
              {t("diff.size_label", "크기")}
            </span>
            <input
              type="range"
              min={240}
              max={400}
              step={2}
              value={slot.fontSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                onUpdateSlot((prev) => ({ ...prev, fontSize: val }));
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 accent-theme-accent cursor-pointer h-1"
              title={t("diff.size_slider_tooltip", "개별 폰트 크기 (240px ~ 400px)")}
            />
            <span className="font-mono text-[10px] w-9 text-right font-medium text-theme-text">
              {slot.fontSize}px
            </span>
          </div>

          {/* 2. 개별 투명도(Opacity) 슬라이더 */}
          <div className="flex items-center gap-1.5 text-[10px] text-theme-text-secondary">
            <span className="font-mono text-[9px] text-theme-text-muted w-5 shrink-0">
              {t("diff.opacity_label", "투명")}
            </span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={slot.opacity}
              onChange={(e) => {
                const val = Number(e.target.value);
                onUpdateSlot((prev) => ({ ...prev, opacity: val }));
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 accent-theme-accent cursor-pointer h-1"
              title={t("diff.opacity_slider_tooltip", "불투명도 조절 (10% ~ 100%)")}
            />
            <span className="font-mono text-[10px] w-9 text-right font-medium text-theme-text">
              {slot.opacity}%
            </span>
          </div>
        </div>

        {/* 위치 좌표(X, Y) 및 우측: 원점 복귀 버튼, 눈 모양 가시성 토글 */}
        <div className="flex items-center justify-between text-[11px] font-mono text-theme-text-muted pt-1 border-t border-theme-border/50">
          <div className="flex items-center gap-2">
            <span>
              X:<strong className="text-theme-text font-medium">{slot.offsetX}</strong>
            </span>
            <span>
              Y:<strong className="text-theme-text font-medium">{slot.offsetY}</strong>
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {/* 위치 초기화 (0, 0) 버튼 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResetPosition();
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                slot.offsetX !== 0 || slot.offsetY !== 0
                  ? "text-theme-accent hover:bg-theme-accent/15"
                  : "text-theme-text-muted hover:text-theme-text hover:bg-theme-hover"
              }`}
              title={t("diff.reset_slot_position_tooltip", "위치 초기화 (0, 0) (단축키: 0)")}
              aria-label={t("diff.reset_slot_position_aria", "위치 초기화")}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* 가시성 (눈 모양) 토글 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateSlot((prev) => ({ ...prev, visible: !prev.visible }));
              }}
              className="p-1 rounded text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
              title={
                slot.visible
                  ? t("diff.hide_layer", "레이어 숨기기")
                  : t("diff.show_layer", "레이어 보이기")
              }
              aria-label={
                slot.visible
                  ? t("diff.hide_layer", "레이어 숨기기")
                  : t("diff.show_layer", "레이어 보이기")
              }
            >
              {slot.visible ? (
                <Eye className="w-3.5 h-3.5 text-theme-text-secondary" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-rose-500" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
