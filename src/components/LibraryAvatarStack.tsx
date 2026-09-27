import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FontLibraryTag } from "../types/font";
import { isLightColor } from "../config/colorPresets";
import { Folder, Bookmark } from "lucide-react";

export interface LibraryAvatarStackProps {
  libraries?: FontLibraryTag[];
  maxDisplay?: number;
  className?: string;
  onSelectLibrary?: (tag: FontLibraryTag, e: React.MouseEvent) => void;
}

export function LibraryAvatarStack({
  libraries = [],
  maxDisplay = 2,
  className = "",
  onSelectLibrary,
}: LibraryAvatarStackProps) {
  const { t } = useTranslation();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [openDownwards, setOpenDownwards] = useState(false);

  // 서재(세트) 먼저, 폴더는 아래에 정렬
  const sets = useMemo(() => libraries.filter((lib) => lib.type === "set"), [libraries]);
  const folders = useMemo(() => libraries.filter((lib) => lib.type === "folder"), [libraries]);
  const orderedLibraries = useMemo(() => [...sets, ...folders], [sets, folders]);

  if (!libraries || libraries.length === 0) {
    return null;
  }

  const displayItems = orderedLibraries.slice(0, maxDisplay);
  const remainingCount = orderedLibraries.length - maxDisplay;

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // 화면 세로 기준 50% 위쪽이면 아래로 펼치고, 아래쪽이면 위로 펼침
      setOpenDownwards(rect.top < window.innerHeight / 2);
    }
    setShowTooltip(true);
  };

  const headerText =
    sets.length > 0 && folders.length > 0
      ? t("library_stack.header", { count: orderedLibraries.length, defaultValue: `소속 서재 및 폴더 (${orderedLibraries.length})` })
      : sets.length > 0
      ? t("library_stack.header_sets_only", { count: sets.length, defaultValue: `소속 서재 (${sets.length})` })
      : t("library_stack.header_folders_only", { count: folders.length, defaultValue: `소속 폴더 (${folders.length})` });

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* 겹치는 원형 스택 (서재 먼저, 그 다음 폴더) */}
      <div className="group flex items-center -space-x-1.5 hover:-space-x-0.5 transition-all duration-200 cursor-pointer py-0.5">
        {displayItems.map((lib, idx) => {
          const light = isLightColor(lib.color);
          const shortName = lib.name.trim().slice(0, 2);
          const typeLabel =
            lib.type === "set"
              ? t("library_stack.set_label", "세트")
              : t("library_stack.folder_label", "폴더");

          return (
            <div
              key={`${lib.type}-${lib.id}-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLibrary?.(lib, e);
              }}
              style={{
                backgroundColor: lib.color,
                color: light ? "#111827" : "#ffffff",
              }}
              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ring-1.5 ring-theme-surface shrink-0 select-none shadow-2xs transition-transform hover:scale-110 z-10"
              title={`${typeLabel}: ${lib.name}`}
            >
              {shortName}
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div className="w-4.5 h-4.5 rounded-full bg-theme-badge text-theme-text-muted flex items-center justify-center text-[8px] font-semibold ring-1.5 ring-theme-surface shrink-0 select-none z-0">
            +{remainingCount}
          </div>
        )}
      </div>

      {/* 리치 툴팁 팝오버: 서재 먼저 보여주고 아래 폴더 보여줌 */}
      {showTooltip && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap bg-theme-surface/95 backdrop-blur-md border border-theme-border rounded-lg shadow-lg py-1.5 px-2.5 text-xs text-theme-text min-w-[150px] max-w-[240px] animate-in fade-in zoom-in-95 duration-150 ${
            openDownwards ? "top-full mt-1.5" : "bottom-full mb-1.5"
          }`}
        >
          {/* 전체 헤더 */}
          <div className="text-[10px] font-semibold text-theme-text-muted mb-1 flex items-center gap-1 border-b border-theme-border/60 pb-1">
            <span>{headerText}</span>
          </div>

          <div className="space-y-1">
            {/* 1. 서재 세트 목록 (상단) */}
            {sets.length > 0 && (
              <div className="space-y-0.5">
                {folders.length > 0 && (
                  <div className="text-[9px] font-semibold text-theme-accent/90 uppercase tracking-wider px-1 pt-0.5 flex items-center gap-1">
                    <Bookmark className="w-2.5 h-2.5" />
                    <span>{t("library_stack.sets_title", "서재 세트")} ({sets.length})</span>
                  </div>
                )}
                {sets.map((lib, idx) => (
                  <div
                    key={`set-${lib.id}-${idx}`}
                    className="flex items-center gap-1.5 text-[11px] px-1 py-0.5 rounded"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 ring-0.5 ring-theme-border"
                      style={{ backgroundColor: lib.color }}
                    />
                    <Bookmark className="w-3 h-3 text-theme-accent shrink-0" />
                    <span className="font-medium text-theme-text truncate" title={lib.name}>
                      {lib.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 구분선 (둘 다 존재할 때) */}
            {sets.length > 0 && folders.length > 0 && (
              <div className="border-t border-theme-border/60 my-1" />
            )}

            {/* 2. 소속 폴더 목록 (하단) */}
            {folders.length > 0 && (
              <div className="space-y-0.5">
                {sets.length > 0 && (
                  <div className="text-[9px] font-semibold text-sky-500/90 uppercase tracking-wider px-1 pt-0.5 flex items-center gap-1">
                    <Folder className="w-2.5 h-2.5" />
                    <span>{t("library_stack.folders_title", "소속 폴더")} ({folders.length})</span>
                  </div>
                )}
                {folders.map((lib, idx) => (
                  <div
                    key={`folder-${lib.id}-${idx}`}
                    className="flex items-center gap-1.5 text-[11px] px-1 py-0.5 rounded"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 ring-0.5 ring-theme-border"
                      style={{ backgroundColor: lib.color }}
                    />
                    <Folder className="w-3 h-3 text-sky-500 shrink-0" />
                    <span className="font-medium text-theme-text truncate" title={lib.name}>
                      {lib.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

