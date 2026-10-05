import { useTranslation } from "react-i18next";
import { Sliders, Bold, Italic, Underline } from "lucide-react";
import { PreviewSettings } from "../../types/font";
import { ColorPresetPicker } from "../ColorPresetPicker";
import { TextAlignDropdown } from "../TextAlignDropdown";
import { ViewModeControl } from "../ViewModeControl";
import { GridColumnsSelector } from "../GridColumnsSelector";
import { SearchInput, IconButton } from "../common";

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
  onOpenStyleModal: () => void;
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
  onOpenStyleModal,
}: HeaderToolbarProps) {
  const { t } = useTranslation();

  return (
    <header className="h-14 border-b border-theme-border bg-theme-header px-4 flex items-center justify-between gap-3 shrink-0 select-none relative z-30">
      {/* 좌측 그룹: 미리보기 및 스타일 모달 트리거, 글꼴 검색창 */}
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
        <SearchInput
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={t("toolbar.search_placeholder")}
          size="sm"
          className="flex-1 max-w-xs md:max-w-sm min-w-[140px]"
        />
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
          <IconButton
            size="xs"
            variant="ghost"
            active={previewSettings.isBold}
            onClick={() => onBoldChange?.(!previewSettings.isBold)}
            tooltip={t("toolbar.bold")}
            tooltipPosition="bottom"
            icon={<Bold className="w-3.5 h-3.5" />}
          />
          <IconButton
            size="xs"
            variant="ghost"
            active={previewSettings.isItalic}
            onClick={() => onItalicChange?.(!previewSettings.isItalic)}
            tooltip={t("toolbar.italic")}
            tooltipPosition="bottom"
            icon={<Italic className="w-3.5 h-3.5" />}
          />
          <IconButton
            size="xs"
            variant="ghost"
            active={previewSettings.isUnderline}
            onClick={() => onUnderlineChange?.(!previewSettings.isUnderline)}
            tooltip={t("toolbar.underline")}
            tooltipPosition="bottom"
            icon={<Underline className="w-3.5 h-3.5" />}
          />
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
