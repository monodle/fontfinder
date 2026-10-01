import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  Type,
  Sliders,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
} from "lucide-react";
import { ColorPresetPicker } from "./ColorPresetPicker";
import { RangeSliderControl } from "./common/RangeSliderControl";
import { SegmentedControl } from "./common/SegmentedControl";

export interface TypographyStyleValues {
  text: string;
  fontSize: number;
  fontWeight: number; // 0: 폰트 자체 weight 사용, 100~900: 사용자 지정
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  letterSpacing: number; // px 단위, -2 ~ 12
  lineHeight: number; // 1.0 ~ 2.5
  textAlign: "left" | "center" | "right";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textColor: string; // 빈 문자열("")이면 기본 테마 색상 사용
  backgroundColor: string; // 빈 문자열("")이면 기본 테마 색상 사용
}

export interface PreviewTypographyFormProps {
  mode: "session" | "defaults";
  values: TypographyStyleValues;
  onChange: <K extends keyof TypographyStyleValues>(
    field: K,
    value: TypographyStyleValues[K]
  ) => void;
  minFontSize?: number;
  maxFontSize?: number;
  onMinFontSizeChange?: (val: number) => void;
  onMaxFontSizeChange?: (val: number) => void;
  onSubmitShortcut?: () => void;
}

const THEME_COLOR_PRESETS = [
  {
    id: "default",
    nameKey: "style_modal.preset_default",
    textColor: "",
    backgroundColor: "",
    previewBadge: "bg-theme-card text-theme-text border-theme-border",
  },
  {
    id: "dark",
    nameKey: "style_modal.preset_dark",
    textColor: "#f3efe6",
    backgroundColor: "#1c1917",
    previewBadge: "bg-[#1c1917] text-[#f3efe6] border-[#38332e]",
  },
  {
    id: "white",
    nameKey: "style_modal.preset_white",
    textColor: "#111111",
    backgroundColor: "#ffffff",
    previewBadge: "bg-[#ffffff] text-[#111111] border-[#e5e5e5]",
  },
  {
    id: "midnight",
    nameKey: "style_modal.preset_midnight",
    textColor: "#e0e7ff",
    backgroundColor: "#0f172a",
    previewBadge: "bg-[#0f172a] text-[#e0e7ff] border-[#1e293b]",
  },
];

export function PreviewTypographyForm({
  mode,
  values,
  onChange,
  minFontSize = 14,
  maxFontSize = 72,
  onMinFontSizeChange,
  onMaxFontSizeChange,
  onSubmitShortcut,
}: PreviewTypographyFormProps) {
  const { t } = useTranslation();

  const isSessionMode = mode === "session";

  // 실시간 라이브 미니 프리뷰 인라인 스타일
  const livePreviewStyle: CSSProperties = {
    fontSize: `${Math.min(Math.max(values.fontSize, 14), 38)}px`,
    fontWeight:
      values.fontWeight > 0
        ? values.fontWeight
        : values.isBold
        ? 700
        : 400,
    fontStyle: values.isItalic ? "italic" : "normal",
    textDecoration: values.isUnderline ? "underline" : "none",
    letterSpacing: `${values.letterSpacing}px`,
    lineHeight: values.lineHeight,
    textAlign: values.textAlign,
    textTransform: values.textTransform || "none",
    color: values.textColor || "var(--theme-text)",
    backgroundColor: values.backgroundColor || "var(--theme-card)",
  };

  return (
    <div className="space-y-4 text-xs select-none">
      {/* 1. Preview Textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="typography-preview-text"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-theme-text-secondary"
          >
            <Type className="w-3.5 h-3.5 text-theme-accent" />
            {isSessionMode
              ? t("style_modal.preview_text_label")
              : t("settings.default_preview_text")}
          </label>
          <span className="text-[10px] text-theme-text-muted">
            {isSessionMode
              ? t("style_modal.preview_text_hint")
              : t("settings.preview_text_placeholder")}
          </span>
        </div>
        <textarea
          id="typography-preview-text"
          rows={3}
          value={values.text}
          onChange={(e) => onChange("text", e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmitShortcut?.();
            }
          }}
          placeholder={
            isSessionMode
              ? t("style_modal.preview_placeholder")
              : t("settings.preview_text_placeholder")
          }
          className="w-full bg-theme-input border border-theme-border rounded-xl p-3 text-xs text-theme-text placeholder-theme-text-muted focus:outline-none focus:border-theme-accent transition-colors shadow-2xs min-h-[65px] max-h-[120px] leading-relaxed select-text"
        />
      </div>

      {/* 2. Live Mini Preview Box */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-theme-text-secondary">
          <span>{t("style_modal.live_preview_title")}</span>
          <span className="text-[10px] font-mono text-theme-text-muted font-normal">
            {values.textAlign.toUpperCase()} &bull; {values.lineHeight.toFixed(2)}x &bull;{" "}
            {values.letterSpacing}px &bull;{" "}
            {values.fontWeight === 0
              ? t("style_modal.weight_default_short")
              : `W${values.fontWeight}`}
          </span>
        </div>
        <div
          style={livePreviewStyle}
          className="w-full min-h-[64px] max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words p-3 rounded-xl border border-theme-border shadow-inner transition-all select-text"
        >
          {values.text || t("style_modal.empty_preview")}
        </div>
      </div>

      <div className="border-t border-theme-border-subtle" />

      {/* 3. Detailed Controls (2-Columns Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left Column: Font & Typo */}
        <div className="space-y-3.5 bg-theme-card/60 p-3.5 rounded-xl border border-theme-border">
          <div className="font-semibold text-[11px] text-theme-text flex items-center gap-1.5 border-b border-theme-border-subtle pb-1.5">
            <Sliders className="w-3.5 h-3.5 text-theme-accent" />
            <span>{t("style_modal.size_and_weight_title")}</span>
          </div>

          {/* Font Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-theme-text-secondary">
                {isSessionMode
                  ? t("style_modal.font_size_label")
                  : t("settings.default_font_size")}
              </span>
              <span className="font-mono font-semibold text-theme-accent bg-theme-accent-subtle px-1.5 py-0.5 rounded text-[10px]">
                {values.fontSize}px
              </span>
            </div>
            <input
              type="range"
              min={minFontSize}
              max={maxFontSize}
              value={values.fontSize}
              onChange={(e) => onChange("fontSize", Number(e.target.value))}
              className="w-full accent-theme-accent cursor-pointer"
            />

            {/* 환경설정(defaults) 모드일 때 최소/최대 슬라이더 범위 편집 UI 제공 */}
            {!isSessionMode && onMinFontSizeChange && onMaxFontSizeChange && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center justify-between gap-1.5 bg-theme-input border border-theme-border rounded-lg px-2 py-1">
                  <span className="text-[10px] text-theme-text-muted truncate">
                    {t("settings.min_font_size")}
                  </span>
                  <input
                    type="number"
                    min={8}
                    max={36}
                    value={minFontSize}
                    onChange={(e) => {
                      const val = Math.max(8, Number(e.target.value));
                      onMinFontSizeChange(val);
                      if (values.fontSize < val) {
                        onChange("fontSize", val);
                      }
                    }}
                    className="w-12 text-right bg-transparent text-[11px] font-mono text-theme-text font-semibold focus:outline-none"
                  />
                  <span className="text-[10px] text-theme-text-muted">px</span>
                </div>

                <div className="flex items-center justify-between gap-1.5 bg-theme-input border border-theme-border rounded-lg px-2 py-1">
                  <span className="text-[10px] text-theme-text-muted truncate">
                    {t("settings.max_font_size")}
                  </span>
                  <input
                    type="number"
                    min={40}
                    max={144}
                    value={maxFontSize}
                    onChange={(e) => {
                      const val = Math.max(minFontSize + 4, Number(e.target.value));
                      onMaxFontSizeChange(val);
                      if (values.fontSize > val) {
                        onChange("fontSize", val);
                      }
                    }}
                    className="w-12 text-right bg-transparent text-[11px] font-mono text-theme-text font-semibold focus:outline-none"
                  />
                  <span className="text-[10px] text-theme-text-muted">px</span>
                </div>
              </div>
            )}
          </div>

          {/* Font Weight */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-theme-text-secondary">
                {isSessionMode
                  ? t("style_modal.font_weight_label")
                  : `${t("settings.variable_font_title")} - ${t(
                      "settings.variable_weight_label"
                    )}`}
              </span>
              <span className="font-mono font-semibold text-theme-accent bg-theme-accent-subtle px-1.5 py-0.5 rounded text-[10px]">
                {values.fontWeight === 0
                  ? t("style_modal.weight_default_short")
                  : values.fontWeight}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={100}
                max={900}
                step={isSessionMode ? 100 : 50}
                disabled={values.fontWeight === 0}
                value={values.fontWeight === 0 ? 400 : values.fontWeight}
                onChange={(e) => onChange("fontWeight", Number(e.target.value))}
                className="w-full accent-theme-accent cursor-pointer disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() =>
                  onChange("fontWeight", values.fontWeight === 0 ? 400 : 0)
                }
                className={`px-2 py-0.5 text-[10px] rounded border font-medium shrink-0 transition-colors cursor-pointer ${
                  values.fontWeight === 0
                    ? "bg-theme-accent text-theme-accent-text border-theme-accent"
                    : "bg-theme-input text-theme-text-secondary border-theme-border hover:bg-theme-hover"
                }`}
                title={t("style_modal.weight_default")}
              >
                {t("style_modal.weight_default_short")}
              </button>
            </div>
          </div>

          {/* Style Toggles: Bold, Italic, Underline */}
          <div className="space-y-1">
            <span className="block text-[11px] text-theme-text-secondary">
              {t("style_modal.styles_and_align_title", "스타일")}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChange("isBold", !values.isBold)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border font-semibold text-xs transition-colors cursor-pointer ${
                  values.isBold
                    ? "bg-theme-accent text-theme-accent-text border-theme-accent"
                    : "bg-theme-card text-theme-text-secondary border-theme-border hover:bg-theme-hover hover:text-theme-text"
                }`}
                title={t("toolbar.bold", "굵게")}
              >
                <Bold className="w-3.5 h-3.5" />
                <span>{t("toolbar.bold", "굵게")}</span>
              </button>

              <button
                type="button"
                onClick={() => onChange("isItalic", !values.isItalic)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border font-serif text-xs transition-colors cursor-pointer ${
                  values.isItalic
                    ? "bg-theme-accent text-theme-accent-text border-theme-accent"
                    : "bg-theme-card text-theme-text-secondary border-theme-border hover:bg-theme-hover hover:text-theme-text"
                }`}
                title={t("toolbar.italic", "기울임")}
              >
                <Italic className="w-3.5 h-3.5" />
                <span>{t("toolbar.italic", "기울임")}</span>
              </button>

              <button
                type="button"
                onClick={() => onChange("isUnderline", !values.isUnderline)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  values.isUnderline
                    ? "bg-theme-accent text-theme-accent-text border-theme-accent"
                    : "bg-theme-card text-theme-text-secondary border-theme-border hover:bg-theme-hover hover:text-theme-text"
                }`}
                title={t("toolbar.underline", "밑줄")}
              >
                <Underline className="w-3.5 h-3.5" />
                <span>{t("toolbar.underline", "밑줄")}</span>
              </button>
            </div>
          </div>

          {/* Text Alignment */}
          <div className="space-y-1">
            <span className="block text-[11px] text-theme-text-secondary">
              {isSessionMode
                ? t("style_modal.styles_and_align_title")
                : t("settings.default_text_align")}
            </span>
            <SegmentedControl
              options={[
                { value: "left", icon: <AlignLeft className="w-3.5 h-3.5" />, title: t("settings.align_left") },
                { value: "center", icon: <AlignCenter className="w-3.5 h-3.5" />, title: t("settings.align_center") },
                { value: "right", icon: <AlignRight className="w-3.5 h-3.5" />, title: t("settings.align_right") },
              ]}
              value={values.textAlign}
              onChange={(align) => onChange("textAlign", align)}
              size="sm"
            />
          </div>
        </div>

        {/* Right Column: Spacing & Colors */}
        <div className="space-y-3.5 bg-theme-card/60 p-3.5 rounded-xl border border-theme-border">
          <div className="font-semibold text-[11px] text-theme-text flex items-center gap-1.5 border-b border-theme-border-subtle pb-1.5">
            <Palette className="w-3.5 h-3.5 text-theme-accent" />
            <span>
              {isSessionMode
                ? t("style_modal.theme_presets_title")
                : t("settings.preview_colors_title")}
            </span>
          </div>

          {/* Letter Spacing */}
          <RangeSliderControl
            label={
              isSessionMode
                ? t("style_modal.letter_spacing_label")
                : t("settings.default_letter_spacing")
            }
            value={values.letterSpacing}
            onChange={(val) => onChange("letterSpacing", val)}
            min={-2}
            max={12}
            step={0.5}
            unit="px"
            showNumberInput={false}
          />

          {/* Line Height */}
          <RangeSliderControl
            label={
              isSessionMode
                ? t("style_modal.line_height_label")
                : t("settings.default_line_height")
            }
            value={values.lineHeight}
            onChange={(val) => onChange("lineHeight", val)}
            min={1.0}
            max={2.5}
            step={0.05}
            unit="x"
            formatValue={(val) => val.toFixed(2)}
            showNumberInput={false}
          />

          {/* Text Transform (세션 모드) */}
          {isSessionMode && (
            <div className="space-y-1">
              <span className="block text-[11px] text-theme-text-secondary">
                {t("common.edit")}
              </span>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {[
                  { label: "Default", value: "none" },
                  { label: "UPPER", value: "uppercase" },
                  { label: "lower", value: "lowercase" },
                  { label: "Title", value: "capitalize" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      onChange(
                        "textTransform",
                        item.value as TypographyStyleValues["textTransform"]
                      )
                    }
                    className={`py-1 rounded border font-mono transition-colors text-center cursor-pointer ${
                      values.textTransform === item.value
                        ? "bg-theme-accent text-theme-accent-text border-theme-accent font-semibold"
                        : "bg-theme-card text-theme-text-secondary border-theme-border hover:bg-theme-hover hover:text-theme-text"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors: Font Color & Background Color */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Text Color */}
            <ColorPresetPicker
              type="text"
              label={
                isSessionMode
                  ? t("style_modal.text_color")
                  : t("settings.default_text_color")
              }
              value={values.textColor}
              onChange={(c) => onChange("textColor", c)}
              trigger="field"
              align="left"
              placement="top"
            />

            {/* Background Color */}
            <ColorPresetPicker
              type="background"
              label={
                isSessionMode
                  ? t("style_modal.bg_color")
                  : t("settings.default_bg_color")
              }
              value={values.backgroundColor}
              onChange={(c) => onChange("backgroundColor", c)}
              trigger="field"
              align="right"
              placement="top"
            />
          </div>

          {/* Fast Theme Presets */}
          <div className="space-y-1 pt-1">
            <span className="block text-[10px] text-theme-text-muted">
              {t("style_modal.theme_presets_title")}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {THEME_COLOR_PRESETS.map((tItem) => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => {
                    onChange("textColor", tItem.textColor);
                    onChange("backgroundColor", tItem.backgroundColor);
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-medium flex items-center justify-between transition-all hover:scale-[1.02] cursor-pointer ${tItem.previewBadge}`}
                >
                  <span>{t(tItem.nameKey)}</span>
                  <span className="w-2.5 h-2.5 rounded-full border border-current opacity-70" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
