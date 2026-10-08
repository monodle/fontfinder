import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sliders, Bold, Italic, Underline, Download, ExternalLink, Info } from "lucide-react";
import { PreviewSettings, FontMetadata } from "../../types/font";
import { googleFontService } from "../../services/googleFontService";
import { fontsourceService } from "../../services/fontsourceService";
import { ColorPresetPicker } from "../color/ColorPresetPicker";
import { TextAlignDropdown } from "../controls/TextAlignDropdown";
import { ViewModeControl } from "../controls/ViewModeControl";
import { GridColumnsSelector } from "../controls/GridColumnsSelector";
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
  isGoogleFontsActive?: boolean;
  selectedGoogleFonts?: FontMetadata[];
  isFontsourceActive?: boolean;
  selectedFontsourceFonts?: FontMetadata[];
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
  isGoogleFontsActive = false,
  selectedGoogleFonts = [],
  isFontsourceActive = false,
  selectedFontsourceFonts = [],
}: HeaderToolbarProps) {
  const { t } = useTranslation();
  const [isDownloadPopoverOpen, setIsDownloadPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsDownloadPopoverOpen(false);
      }
    }
    if (isDownloadPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDownloadPopoverOpen]);

  const isOnlineProviderActive = isGoogleFontsActive || isFontsourceActive;
  const selectedOnlineFonts = isFontsourceActive ? selectedFontsourceFonts : selectedGoogleFonts;
  const hasSelectedOnlineFonts = selectedOnlineFonts.length > 0;
  const providerTitle = isFontsourceActive ? "Font Source" : "Google Fonts";

  return (
    <header className="h-14 border-b border-theme-border bg-theme-header px-4 flex items-center justify-between gap-3 shrink-0 select-none relative z-30">
      {/* 좌측 그룹: 미리보기 및 스타일 모달 트리거, 구글폰트 다운로드 보기, 글꼴 검색창 */}
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

        {/* 온라인 공급자(Google Fonts / Font Source) 활성 시: 검색 텍스트박스 좌측 "다운로드 경로 보기" 버튼 */}
        {isOnlineProviderActive && (
          <div className="relative shrink-0" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setIsDownloadPopoverOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer shadow-2xs ${
                isDownloadPopoverOpen
                  ? "bg-theme-active border-theme-accent text-theme-accent ring-1 ring-theme-accent"
                  : hasSelectedOnlineFonts
                  ? "bg-theme-card border-theme-accent/60 text-theme-accent hover:border-theme-accent"
                  : "bg-theme-card border-theme-border text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
              }`}
              title={`선택된 ${providerTitle}의 다운로드 링크를 확인합니다`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>다운로드 경로 보기</span>
              {hasSelectedOnlineFonts && (
                <span className="px-1.5 py-0.2 rounded-full bg-theme-accent text-white text-[10px] font-mono font-bold leading-tight">
                  {selectedOnlineFonts.length}
                </span>
              )}
            </button>

            {/* 다운로드 경로 팝오버: "폰트 이름 : (다운로드 버튼)" */}
            {isDownloadPopoverOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-theme-surface border border-theme-border rounded-xl shadow-xl p-3 z-50 animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-theme-border">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-theme-text">
                    <Download className="w-3.5 h-3.5 text-theme-accent" />
                    <span>{providerTitle} 다운로드 / 상세</span>
                  </div>
                  {hasSelectedOnlineFonts && (
                    <span className="text-[11px] text-theme-text-muted">
                      총 {selectedOnlineFonts.length}개 선택됨
                    </span>
                  )}
                </div>

                {hasSelectedOnlineFonts ? (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {selectedOnlineFonts.map((font) => (
                      <div
                        key={font.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-theme-card border border-theme-border/60 hover:border-theme-accent/40 transition-colors"
                      >
                        <span className="font-semibold text-xs text-theme-text truncate flex-1" title={font.family_name}>
                          {font.family_name}
                        </span>
                        <span className="text-theme-text-muted text-xs shrink-0">:</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (font.file_path.startsWith("fontsource:")) {
                              const fId = font.file_path.replace("fontsource:", "");
                              fontsourceService.openSpecimenPage(fId);
                            } else {
                              googleFontService.openSpecimenPage(font.family_name);
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-theme-accent text-white text-[11px] font-semibold hover:bg-theme-accent/90 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>페이지 열기</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-theme-text-muted">
                    <Info className="w-5 h-5 mx-auto mb-1.5 opacity-50 text-amber-500" />
                    <p className="text-xs font-medium text-theme-text mb-0.5">
                      선택된 폰트가 없습니다
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      폰트 카드를 클릭하거나 마우스로 드래그하여 원하는 폰트를 먼저 선택해 주세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
