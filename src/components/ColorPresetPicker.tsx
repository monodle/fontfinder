import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Baseline, PaintBucket, RotateCcw, Check, ChevronDown } from "lucide-react";
import {
  TEXT_COLOR_PRESETS,
  BG_COLOR_PRESETS,
} from "../config/colorPresets";
import { ColorPresetChips } from "./ColorPresetChips";
import { ColorPickerInput } from "./ColorPickerInput";

export interface ColorPresetPickerProps {
  type: "text" | "background";
  value: string;
  onChange: (color: string) => void;
  trigger?: "icon" | "field";
  label?: string;
  align?: "left" | "right";
  placement?: "top" | "bottom" | "auto";
  className?: string;
  disabled?: boolean;
}

/**
 * 폰트 색상 및 배경색 변경을 통합 제어하는 메인 색상 선택 팝오버 컴포넌트.
 * 상단 툴바(icon 트리거) 및 환경설정/스타일설정 모달(field 트리거)에서 공용으로 사용됩니다.
 */
export function ColorPresetPicker({
  type,
  value,
  onChange,
  trigger = "field",
  label,
  align = "left",
  placement = "auto",
  className = "",
  disabled = false,
}: ColorPresetPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [computedPlacement, setComputedPlacement] = useState<"top" | "bottom">(
    placement === "auto" ? "bottom" : placement
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const isText = type === "text";
  const presets = isText ? TEXT_COLOR_PRESETS : BG_COLOR_PRESETS;
  const titleText = isText ? t("toolbar.text_color") : t("toolbar.bg_color");
  const fallbackColor = isText ? "#24211e" : "#fcfaf5";

  // 열릴 때 뷰포트 공간 계산하여 상단/하단 배치 결정
  useEffect(() => {
    if (!isOpen) return;

    if (placement !== "auto") {
      setComputedPlacement(placement);
      return;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const popoverEstimatedHeight = 280;

      // 하단 공간이 부족하고 상단 공간이 더 여유로우면 위로 열기
      if (spaceBelow < popoverEstimatedHeight && spaceAbove > spaceBelow) {
        setComputedPlacement("top");
      } else {
        setComputedPlacement("bottom");
      }
    }
  }, [isOpen, placement]);

  // 외부 클릭 시 팝오버 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }, [disabled]);

  const handleSelectColor = useCallback(
    (color: string) => {
      onChange(color);
    },
    [onChange]
  );

  const handleReset = useCallback(() => {
    onChange("");
  }, [onChange]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* 1. 트리거 UI: 툴바용 아이콘 모드 */}
      {trigger === "icon" ? (
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`w-7 h-7 rounded-md flex flex-col items-center justify-center relative cursor-pointer transition-all ${
            isOpen
              ? "bg-theme-card text-theme-accent shadow-2xs ring-1 ring-theme-accent/60"
              : value
              ? "bg-theme-card text-theme-text shadow-2xs"
              : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-card/60"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          title={titleText}
          aria-label={titleText}
          aria-expanded={isOpen}
        >
          {isText ? (
            <Baseline className="w-3.5 h-3.5" />
          ) : (
            <PaintBucket className="w-3.5 h-3.5" />
          )}
          <span
            className="w-3.5 h-[3px] rounded-full mt-0.5 border border-black/10 dark:border-white/20 transition-all"
            style={{
              backgroundColor: value || (isText ? "currentColor" : "transparent"),
              backgroundImage:
                !value && !isText
                  ? "repeating-linear-gradient(45deg, #ccc 0, #ccc 2px, transparent 0, transparent 4px)"
                  : undefined,
            }}
          />
        </button>
      ) : (
        /* 2. 트리거 UI: 모달/설정 폼용 필드 모드 */
        <div className="space-y-1">
          {label && (
            <span className="block text-[11px] font-medium text-theme-text-secondary">
              {label}
            </span>
          )}
          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            aria-expanded={isOpen}
            className={`w-full h-8 px-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer ${
              isOpen
                ? "border-theme-accent ring-1 ring-theme-accent/50 bg-theme-surface"
                : "border-theme-border bg-theme-card hover:bg-theme-hover hover:border-theme-border-card-hover"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-4 h-4 rounded-full border border-black/15 dark:border-white/20 shadow-2xs shrink-0"
                style={{
                  backgroundColor: value || (isText ? "#111111" : "#ffffff"),
                  backgroundImage: !value
                    ? "repeating-linear-gradient(45deg, #ccc 0, #ccc 2px, transparent 0, transparent 4px)"
                    : undefined,
                }}
              />
              <span className="truncate font-mono text-[11px] text-theme-text">
                {value ? value.toUpperCase() : t("toolbar.color_default")}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-theme-text-muted transition-transform duration-200 shrink-0 ${
                isOpen ? "rotate-180 text-theme-accent" : ""
              }`}
            />
          </button>
        </div>
      )}

      {/* 3. 색상 선택 공통 팝오버 패널 */}
      {isOpen && (
        <div
          className={`absolute w-64 bg-theme-surface border border-theme-border rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100 ${
            computedPlacement === "top"
              ? "bottom-full mb-2 origin-bottom"
              : "top-full mt-2 origin-top"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          {/* 팝오버 헤더 */}
          <div className="flex items-center justify-between pb-2 border-b border-theme-border">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-theme-text">
              {isText ? (
                <>
                  <Baseline className="w-3.5 h-3.5 text-theme-accent" />
                  <span>{t("toolbar.text_color")}</span>
                </>
              ) : (
                <>
                  <PaintBucket className="w-3.5 h-3.5 text-theme-accent" />
                  <span>{t("toolbar.bg_color")}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-theme-text-muted hover:text-theme-accent cursor-pointer transition-colors px-1.5 py-0.5 rounded hover:bg-theme-hover"
              title={t("common.reset")}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{t("toolbar.color_default")}</span>
            </button>
          </div>

          {/* 테마 기본값 복원 칩 */}
          <button
            type="button"
            onClick={handleReset}
            className={`w-full py-1.5 px-2 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
              !value
                ? "border-theme-accent bg-theme-accent-subtle text-theme-accent font-semibold"
                : "border-theme-border bg-theme-surface hover:bg-theme-hover text-theme-text-secondary"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-theme-border bg-theme-app inline-block" />
              {t("toolbar.color_default")}
            </span>
            {!value && <Check className="w-3.5 h-3.5 text-theme-accent" />}
          </button>

          {/* 추천 프리셋 색상 그리드 (20종 내추럴 컬러) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider">
              {t("toolbar.color_presets")}
            </span>
            <ColorPresetChips
              presets={presets}
              selectedColor={value}
              onSelect={handleSelectColor}
              columns={5}
            />
          </div>

          {/* 커스텀 HEX 색상 선택기 */}
          <div className="pt-2 border-t border-theme-border">
            <ColorPickerInput
              value={value}
              onChange={handleSelectColor}
              fallbackColor={fallbackColor}
              placeholder="#HEX..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
