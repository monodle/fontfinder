import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata } from "../../types/font";
import { getFontFamilyName, matchesFontSearch } from "../../utils/fontLocalization";
import { Search } from "lucide-react";

interface FontInfoSidebarProps {
  fonts: FontMetadata[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function FontInfoSidebar({
  fonts,
  selectedIndex,
  onSelect,
}: FontInfoSidebarProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // 검색 필터링
  const filteredIndexedFonts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return fonts.map((f, originalIndex) => ({ font: f, originalIndex }));
    }
    return fonts
      .map((f, originalIndex) => ({ font: f, originalIndex }))
      .filter(({ font }) => matchesFontSearch(font, q));
  }, [fonts, searchQuery]);

  // 선택된 항목이 변경되었을 때 화면 스크롤 자동 동기화
  useEffect(() => {
    if (activeItemRef.current && listContainerRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // 키보드 상/하 화살표 네비게이션
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(fonts.length - 1, selectedIndex + 1);
        onSelect(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(0, selectedIndex - 1);
        onSelect(prev);
      }
    },
    [fonts.length, selectedIndex, onSelect]
  );

  return (
    <div
      className="w-64 border-r border-theme-border flex flex-col h-full bg-theme-surface/50 shrink-0"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* 1. 상단 검색 바 */}
      <div className="p-2.5 border-b border-theme-border">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-theme-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("font_info.search_placeholder")}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-theme-surface-subtle border border-theme-border-subtle text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-theme-accent"
          />
        </div>
      </div>

      {/* 2. 폰트 목록 */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar"
      >
        {filteredIndexedFonts.length === 0 ? (
          <div className="p-4 text-center text-xs text-theme-text-muted">
            {t("font_info.no_search_results")}
          </div>
        ) : (
          filteredIndexedFonts.map(({ font, originalIndex }) => {
            const isSelected = originalIndex === selectedIndex;
            return (
              <button
                key={font.id}
                ref={isSelected ? activeItemRef : null}
                type="button"
                onClick={() => onSelect(originalIndex)}
                className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer flex flex-col gap-0.5 ${
                  isSelected
                    ? "bg-theme-accent text-white font-medium shadow-xs"
                    : "hover:bg-theme-hover text-theme-text"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs truncate font-medium">
                    {getFontFamilyName(font, i18n.language)}
                  </span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono shrink-0 ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-theme-surface-subtle text-theme-text-muted border border-theme-border-subtle"
                    }`}
                  >
                    {font.format.replace("TrueTypeCollection", "TTC").replace("TrueType", "TTF").replace("OpenType", "OTF")}
                  </span>
                </div>
                <span
                  className={`text-[10px] truncate ${
                    isSelected ? "text-white/80" : "text-theme-text-muted"
                  }`}
                >
                  {font.subfamily_name}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* 3. 하단 개수 표시 */}
      <div className="px-3 py-2 border-t border-theme-border text-[11px] text-theme-text-muted flex justify-between">
        <span>{selectedIndex + 1} / {fonts.length}</span>
        <span>{t("font_info.selected_count", { count: fonts.length })}</span>
      </div>
    </div>
  );
}
