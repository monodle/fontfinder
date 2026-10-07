import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FontLibraryTag } from "../../types/font";
import { Folder, Bookmark, Heart, Zap, User } from "lucide-react";

export interface LibraryAvatarStackProps {
  libraries?: FontLibraryTag[];
  maxDisplay?: number;
  className?: string;
  onSelectLibrary?: (tag: FontLibraryTag, e: React.MouseEvent) => void;
  isFavorite?: boolean;
  isActivated?: boolean;
  isUserFont?: boolean;
}

export function LibraryAvatarStack({
  libraries = [],
  maxDisplay = 2,
  className = "",
  onSelectLibrary,
  isFavorite,
  isActivated,
  isUserFont,
}: LibraryAvatarStackProps) {
  const { t } = useTranslation();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [openDownwards, setOpenDownwards] = useState(false);

  // 1. 소속 폴더 먼저, 2. 서재 세트는 그 다음 정렬 (각각 현재 정렬 순서 유지)
  const folders = useMemo(() => libraries.filter((lib) => lib.type === "folder"), [libraries]);
  const sets = useMemo(() => libraries.filter((lib) => lib.type === "set"), [libraries]);
  const orderedLibraries = useMemo(() => [...folders, ...sets], [folders, sets]);
  const hasStatus = Boolean(isFavorite || isActivated || isUserFont);

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
    folders.length > 0 && sets.length > 0
      ? t("library_stack.header", { count: orderedLibraries.length })
      : folders.length > 0
      ? t("library_stack.header_folders_only", { count: folders.length })
      : t("library_stack.header_sets_only", { count: sets.length });

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* 겹치는 원형 스택 (소속 폴더 먼저, 그 다음 서재 세트) */}
      <div className="group flex items-center -space-x-1.5 hover:-space-x-0.5 transition-all duration-200 cursor-pointer py-0.5">
        {displayItems.map((lib, idx) => {
          const trimmed = lib.name.trim();
          const shortName = Array.from(trimmed)[0] || "";

          return (
            <div
              key={`${lib.type}-${lib.id}-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLibrary?.(lib, e);
              }}
              style={{
                backgroundColor: lib.color,
                color: "#ffffff",
                textShadow:
                  "-0.6px -0.6px 0 rgba(0, 0, 0, 0.85), 0.6px -0.6px 0 rgba(0, 0, 0, 0.85), -0.6px 0.6px 0 rgba(0, 0, 0, 0.85), 0.6px 0.6px 0 rgba(0, 0, 0, 0.85), 0 0 2px rgba(0, 0, 0, 0.6)",
              }}
              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ring-1.5 ring-theme-surface shrink-0 select-none shadow-2xs transition-transform hover:scale-110 z-10"
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

      {/* 리치 툴팁 팝오버: 소속 폴더 -> 서재 세트 -> 분류 및 상태 순서 */}
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
            {/* 1. 소속 폴더 목록 (최상단) */}
            {folders.length > 0 && (
              <div className="space-y-0.5">
                {sets.length > 0 && (
                  <div className="text-[9px] font-semibold text-sky-500/90 uppercase tracking-wider px-1 pt-0.5 flex items-center gap-1">
                    <Folder className="w-2.5 h-2.5" />
                    <span>{t("library_stack.folders_title")} ({folders.length})</span>
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

            {/* 구분선 (폴더와 서재 둘 다 존재할 때) */}
            {folders.length > 0 && sets.length > 0 && (
              <div className="border-t border-theme-border/60 my-1" />
            )}

            {/* 2. 서재 세트 목록 (중단) */}
            {sets.length > 0 && (
              <div className="space-y-0.5">
                {folders.length > 0 && (
                  <div className="text-[9px] font-semibold text-theme-accent/90 uppercase tracking-wider px-1 pt-0.5 flex items-center gap-1">
                    <Bookmark className="w-2.5 h-2.5" />
                    <span>{t("library_stack.sets_title")} ({sets.length})</span>
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

            {/* 3. 분류 및 상태 (하단) */}
            {hasStatus && (
              <>
                {(folders.length > 0 || sets.length > 0) && (
                  <div className="border-t border-theme-border/60 my-1" />
                )}
                <div className="space-y-0.5">
                  <div className="text-[9px] font-semibold text-theme-text-muted uppercase tracking-wider px-1 pt-0.5 flex items-center gap-1">
                    <span>{t("library_stack.status_title")}</span>
                  </div>
                  {isFavorite && (
                    <div className="flex items-center gap-1.5 text-[11px] px-1 py-0.5 rounded">
                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500 shrink-0" />
                      <span className="font-medium text-theme-text truncate">
                        {t("library_stack.status_favorite")}
                      </span>
                    </div>
                  )}
                  {isActivated && (
                    <div className="flex items-center gap-1.5 text-[11px] px-1 py-0.5 rounded">
                      <Zap className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                      <span className="font-medium text-theme-text truncate">
                        {t("library_stack.status_activated")}
                      </span>
                    </div>
                  )}
                  {isUserFont && (
                    <div className="flex items-center gap-1.5 text-[11px] px-1 py-0.5 rounded">
                      <User className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="font-medium text-theme-text truncate">
                        {t("library_stack.status_user")}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

