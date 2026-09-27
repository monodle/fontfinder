import React from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Bold,
  Italic,
  Grid,
  RotateCcw,
  Sliders,
  Type,
} from "lucide-react";
import { DiffMasterSettings } from "../../types/diff";

interface DiffMasterControlProps {
  settings: DiffMasterSettings;
  onSettingsChange: (updater: (prev: DiffMasterSettings) => DiffMasterSettings) => void;
  onResetAllPositions: () => void;
  onClose: () => void;
}

export function DiffMasterControl({
  settings,
  onSettingsChange,
  onResetAllPositions,
  onClose,
}: DiffMasterControlProps) {
  const { t } = useTranslation();

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 공백을 제외한 문자열 중 최대 4글자
    const filtered = Array.from(e.target.value.replace(/\s+/g, "")).slice(0, 4).join("");
    onSettingsChange((prev) => ({ ...prev, text: filtered }));
  };

  const toggleBold = () => {
    onSettingsChange((prev) => ({ ...prev, isBold: !prev.isBold }));
  };

  const toggleItalic = () => {
    onSettingsChange((prev) => ({ ...prev, isItalic: !prev.isItalic }));
  };

  const toggleRenderMode = (mode: "fill" | "stroke") => {
    onSettingsChange((prev) => ({ ...prev, renderMode: mode }));
  };

  const toggleGrid = () => {
    onSettingsChange((prev) => ({ ...prev, showGrid: !prev.showGrid }));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-theme-border bg-theme-header select-none shrink-0">
      {/* 1. 좌측: 제목 배지 & 글리프 텍스트 입력창 (최대 4글자) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-theme-accent/10 border border-theme-accent/25 text-theme-accent font-semibold text-xs tracking-wider">
          <Type className="w-4 h-4" />
          <span>GLYPH DIFF</span>
        </div>

        {/* 텍스트 입력창 */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={settings.text}
            onChange={handleTextChange}
            maxLength={4}
            placeholder={t("diff.text_placeholder", "글자 입력 (최대 4자)")}
            className="w-40 sm:w-48 px-3 py-1.5 bg-theme-input border border-theme-border rounded-lg text-sm font-medium text-theme-text placeholder-theme-text-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent/30 transition-all text-center tracking-widest font-mono"
            title={t("diff.text_input_tooltip", "비교할 글자 (공백 제외 최대 4글자)")}
          />
          <span className="absolute right-2.5 text-[10px] text-theme-text-muted pointer-events-none font-mono">
            {Array.from(settings.text).length}/4
          </span>
        </div>
      </div>

      {/* 2. 중앙: 마스터 서식 제어 (크기, B/I, Fill/Stroke, 가이드라인, 리셋) */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* 폰트 크기 슬라이더 (48px ~ 240px) */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-theme-card border border-theme-border rounded-lg shadow-2xs">
          <Sliders className="w-3.5 h-3.5 text-theme-text-muted" />
          <span className="text-xs font-mono font-medium text-theme-text w-11 text-right">
            {settings.fontSize}px
          </span>
          <input
            type="range"
            min={240}
            max={400}
            step={2}
            value={settings.fontSize}
            onChange={(e) => {
              const val = Number(e.target.value);
              onSettingsChange((prev) => ({ ...prev, fontSize: val }));
            }}
            className="w-20 md:w-28 accent-theme-accent cursor-pointer"
            title={t("diff.font_size_slider", "글리프 크기 (240px ~ 400px)")}
          />
        </div>

        {/* 마스터 B / I 토글 */}
        <div className="flex items-center bg-theme-card border border-theme-border rounded-lg p-0.5 gap-0.5 shadow-2xs">
          <button
            type="button"
            onClick={toggleBold}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer text-xs ${
              settings.isBold
                ? "bg-theme-accent text-theme-accent-text font-bold"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
            }`}
            title="마스터 굵게 (Bold)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleItalic}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer text-xs ${
              settings.isItalic
                ? "bg-theme-accent text-theme-accent-text italic font-bold"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
            }`}
            title="마스터 기울임 (Italic)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 마스터 렌더링 모드: 전체 Fill / 전체 Stroke */}
        <div className="flex items-center bg-theme-card border border-theme-border rounded-lg p-0.5 gap-0.5 shadow-2xs text-xs">
          <button
            type="button"
            onClick={() => toggleRenderMode("fill")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              settings.renderMode === "fill"
                ? "bg-theme-accent text-theme-accent-text font-semibold shadow-2xs"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
            }`}
            title="전체 채우기 모드"
          >
            전체 Fill
          </button>
          <button
            type="button"
            onClick={() => toggleRenderMode("stroke")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              settings.renderMode === "stroke"
                ? "bg-theme-accent text-theme-accent-text font-semibold shadow-2xs"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
            }`}
            title="전체 외곽선 모드"
          >
            전체 Stroke
          </button>
        </div>

        {/* 모눈 격자 토글 (Grid) */}
        <button
          type="button"
          onClick={toggleGrid}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-border bg-theme-card transition-all shadow-2xs text-xs font-medium cursor-pointer ${
            settings.showGrid
              ? "bg-theme-hover text-theme-text font-semibold border-theme-accent/40"
              : "text-theme-text-muted hover:text-theme-text hover:bg-theme-hover/60"
          }`}
          title="모눈 격자 On/Off"
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden md:inline">격자</span>
        </button>

        {/* 전체 위치 초기화 [ ⟲ ] 버튼 */}
        <button
          type="button"
          onClick={onResetAllPositions}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-border bg-theme-card hover:bg-theme-hover text-theme-text-secondary hover:text-theme-text transition-all shadow-2xs text-xs font-medium cursor-pointer"
          title="모든 등록 서체의 위치 오프셋을 (0, 0)으로 일괄 리셋"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">전체 위치 초기화</span>
        </button>
      </div>

      {/* 3. 우측: 닫기 [X] 버튼 */}
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border border-transparent hover:border-theme-border transition-all cursor-pointer"
        title="모달 닫기 (Esc)"
        aria-label="Close diff modal"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
