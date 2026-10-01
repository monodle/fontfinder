import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FontMetadata } from "../../types/font";
import { FontInfoSidebar } from "./FontInfoSidebar";
import { FontInfoViewer } from "./FontInfoViewer";
import { X, Info } from "lucide-react";

interface FontInfoModalProps {
  isOpen: boolean;
  fonts: FontMetadata[];
  initialFont?: FontMetadata | null;
  initialPreviewText?: string;
  onClose: () => void;
}

export function FontInfoModal({
  isOpen,
  fonts,
  initialFont,
  initialPreviewText,
  onClose,
}: FontInfoModalProps) {
  const { t } = useTranslation();

  // 초기 선택 인덱스 결정
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (initialFont && fonts.length > 0) {
      const idx = fonts.findIndex((f) => f.id === initialFont.id);
      setSelectedIndex(idx >= 0 ? idx : 0);
    } else {
      setSelectedIndex(0);
    }
  }, [initialFont, fonts]);

  // Esc 키 입력 시 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const activeFont = useMemo(() => {
    if (fonts.length === 0) return null;
    return fonts[selectedIndex] || fonts[0];
  }, [fonts, selectedIndex]);

  const isMulti = fonts.length > 1;

  if (!isOpen || !activeFont) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-[94vw] max-w-6xl h-[92vh] max-h-[960px] flex flex-col rounded-2xl bg-theme-surface border border-theme-border shadow-2xl shadow-black/40 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 바 */}
        <div className="px-5 py-3.5 border-b border-theme-border flex items-center justify-between bg-theme-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-theme-accent/15 border border-theme-accent/20 flex items-center justify-center text-theme-accent">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-theme-text">
                {isMulti
                  ? t("font_info.title_multi", { count: fonts.length })
                  : t("font_info.title")}
              </h2>
              <p className="text-[11px] text-theme-text-muted">
                {activeFont.family_name} · {activeFont.subfamily_name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            title="닫기 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 모달 바디 (마스터-디테일 분기) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {isMulti && (
            <FontInfoSidebar
              fonts={fonts}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
          )}
          <FontInfoViewer
            font={activeFont}
            initialPreviewText={initialPreviewText}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
