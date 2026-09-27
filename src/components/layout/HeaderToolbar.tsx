import { useTranslation } from "react-i18next";
import { Sliders, Search, X, Bold, Italic, Underline, Split } from "lucide-react";
import { PreviewSettings } from "../../types/font";
import { ColorPresetPicker } from "../ColorPresetPicker";
import { TextAlignDropdown } from "../TextAlignDropdown";
import { ViewModeControl } from "../ViewModeControl";
import { GridColumnsSelector } from "../GridColumnsSelector";
import { ListRefreshButton } from "../ListRefreshButton";
import { ContextualActionBar, ContextualActionBarProps } from "./ContextualActionBar";

interface HeaderToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  previewSettings: PreviewSettings;
  onFontSizeChange: (size: number) => void;
  onBoldChange?: (isBold: boolean) => void;
  onItalicChange?: (isItalic: boolean) => void;
  onUnderlineChange?: (isUnderline: boolean) => void;
  onTextAlignChange?: (align: "left" | "center" | "right") => void;
  onTextColorChange?: (color: string) => void;
  onBackgroundColorChange?: (color: string) => void;
  minFontSize: number;
  maxFontSize: number;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
  gridColumns: number;
  onGridColumnsChange: (columns: number) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenStyleModal: () => void;
  selectionBar?: ContextualActionBarProps;
  selectedCount?: number;
  onOpenDiff?: () => void;
}

export function HeaderToolbar({
  searchQuery,
  onSearchChange,
  searchInputRef,
  previewSettings,
  onFontSizeChange,
  onBoldChange,
  onItalicChange,
  onUnderlineChange,
  onTextAlignChange,
  onTextColorChange,
  onBackgroundColorChange,
  minFontSize,
  maxFontSize,
  viewMode,
  onViewModeChange,
  gridColumns,
  onGridColumnsChange,
  isLoading,
  onRefresh,
  onOpenStyleModal,
  selectionBar,
  selectedCount = 0,
  onOpenDiff,
}: HeaderToolbarProps) {
  const { t } = useTranslation();

  // 다중 선택 시: 폰트 리스트 영역을 가리지 않고 상단 헤더가 눈에 띄는 일괄 작업 툴바로 명확하게 전환
  if (selectionBar && selectionBar.selectedCount > 0) {
    return (
      <header className="h-14 border-b-2 border-theme-accent bg-theme-accent-subtle/90 backdrop-blur-md flex items-center shrink-0 select-none shadow-sm transition-colors duration-200 relative z-30">
        <ContextualActionBar
          {...selectionBar}
          onOpenDiff={onOpenDiff || selectionBar.onOpenDiff}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          gridColumns={gridColumns}
          onGridColumnsChange={onGridColumnsChange}
        />
      </header>
    );
  }

  return (
    <header className="h-14 border-b border-theme-border bg-theme-header px-4 flex items-center justify-between gap-3 shrink-0 select-none relative z-30">
      {/* 좌측 그룹: 미리보기 및 스타일 모달 트리거, 글꼴 검색창, 새로고침 버튼 */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
        <button
          type="button"
          onClick={onOpenStyleModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme-border bg-theme-card hover:bg-theme-card-hover hover:border-theme-accent/50 text-theme-text transition-all shadow-2xs cursor-pointer shrink-0 font-medium text-xs"
          title={t("toolbar.style_settings_tooltip")}
        >
          <Sliders className="w-3.5 h-3.5 text-theme-accent shrink-0" />
          <span>{t("toolbar.style_settings")}</span>
        </button>

        {/* 필터 검색창 */}
        <div className="relative flex-1 max-w-xs md:max-w-sm min-w-[140px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-theme-text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (searchQuery) {
                  onSearchChange("");
                } else {
                  e.currentTarget.blur();
                }
              }
            }}
            placeholder={t("toolbar.search_placeholder")}
            className="w-full bg-theme-input border border-theme-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-theme-text placeholder-theme-text-muted focus:outline-none focus:border-theme-accent transition-colors shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                searchInputRef?.current?.focus();
              }}
              className="absolute right-2 top-2 p-0.5 rounded text-theme-text-muted hover:text-theme-text hover:bg-theme-hover cursor-pointer"
              title="검색 지우기 (Esc)"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 글꼴 비교(Diff) 버튼: [글꼴 검색...] 우측, [새로고침(⟳)] 좌측 (기본 활성화) */}
        {onOpenDiff && (
          <button
            type="button"
            onClick={onOpenDiff}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-2xs shrink-0 cursor-pointer ${selectedCount > 0
                ? "border-theme-accent bg-theme-accent/15 hover:bg-theme-accent/25 text-theme-accent shadow-xs"
                : "border-theme-border bg-theme-card hover:bg-theme-card-hover hover:border-theme-accent/50 text-theme-text"
              }`}
            title={
              selectedCount > 0
                ? t("toolbar.diff_tooltip_selected", {
                  count: selectedCount > 5 ? 5 : selectedCount,
                  defaultValue: `선택한 폰트 글리프 Diff 비교 (${selectedCount}개)`,
                })
                : t("toolbar.diff_tooltip", "전문가용 글리프 Diff 비교")
            }
            aria-label="Font Glyph Diff"
          >
            <Split className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span>
              {selectedCount > 5
                ? "Diff"
                : selectedCount > 0
                  ? `Diff (${selectedCount})`
                  : "Diff"}
            </span>
          </button>
        )}

        {/* 새로고침 버튼 (공용 컴포넌트) */}
        <ListRefreshButton onRefresh={onRefresh} isLoading={isLoading} />
      </div>

      {/* 우측 그룹: 폰트 크기/색상 및 뷰 모드 컨트롤 */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* 폰트 크기 슬라이더 컨트롤 */}
        <div className="h-8 flex items-center gap-2 bg-theme-card border border-theme-border rounded-lg px-2.5 shadow-2xs">
          <span className="text-xs text-theme-text font-mono font-medium w-8 text-right select-none">
            {previewSettings.fontSize}px
          </span>
          <input
            type="range"
            min={minFontSize}
            max={maxFontSize}
            value={previewSettings.fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="w-20 md:w-24 accent-theme-accent cursor-pointer"
          />
        </div>

        {/* 볼드, 이탤릭, 언더라인 서식 버튼 그룹 */}
        <div className="h-8 flex items-center bg-theme-active/30 border border-theme-border rounded-lg p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => onBoldChange?.(!previewSettings.isBold)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${previewSettings.isBold
                ? "bg-theme-accent text-theme-accent-text font-bold shadow-2xs"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
              }`}
            title={t("toolbar.bold", "굵게 (Bold)")}
            aria-label="Bold"
            aria-pressed={previewSettings.isBold}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onItalicChange?.(!previewSettings.isItalic)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${previewSettings.isItalic
                ? "bg-theme-accent text-theme-accent-text italic shadow-2xs"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
              }`}
            title={t("toolbar.italic", "기울임 (Italic)")}
            aria-label="Italic"
            aria-pressed={previewSettings.isItalic}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onUnderlineChange?.(!previewSettings.isUnderline)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${previewSettings.isUnderline
                ? "bg-theme-accent text-theme-accent-text underline shadow-2xs"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
              }`}
            title={t("toolbar.underline", "밑줄 (Underline)")}
            aria-label="Underline"
            aria-pressed={previewSettings.isUnderline}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 간편 색상 선택 버튼 그룹 (글자색, 배경색) */}
        <div className="h-8 flex items-center bg-theme-active/30 border border-theme-border rounded-lg p-0.5 gap-0.5">
          <ColorPresetPicker
            type="text"
            value={previewSettings.textColor}
            onChange={(color) => onTextColorChange?.(color)}
            trigger="icon"
            align="right"
          />
          <ColorPresetPicker
            type="background"
            value={previewSettings.backgroundColor}
            onChange={(color) => onBackgroundColorChange?.(color)}
            trigger="icon"
            align="right"
          />
        </div>

        {/* 글자 정렬 드롭다운 (배경색 버튼 우측) */}
        <TextAlignDropdown
          value={previewSettings.textAlign}
          onChange={(align) => onTextAlignChange?.(align)}
        />

        {/* 뷰 모드 전환 (리스트 / 그리드) */}
        <ViewModeControl
          viewMode={viewMode}
          onChange={onViewModeChange}
          variant="icon"
        />

        {/* 그리드 열 개수 (2~5열) */}
        <GridColumnsSelector
          columns={gridColumns}
          onChange={(cols) => {
            onGridColumnsChange(cols);
            if (viewMode !== "grid") {
              onViewModeChange("grid");
            }
          }}
          variant="dropdown"
        />
      </div>
    </header>
  );
}
