import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata, PreviewSettings, FontLibraryTag } from "../types/font";
import { loadFontIntoDocument } from "../utils/fontLoader";
import { formatFileSize } from "../utils/fileSize";
import { Heart, Zap } from "lucide-react";
import { FontFormatBadge, FontInstallStatusBadge, FontVersionBadge } from "./FontBadge";
import { LibraryAvatarStack } from "./LibraryAvatarStack";

interface FontItemProps {
  font: FontMetadata;
  previewText?: string;
  fontSize?: number;
  previewSettings?: PreviewSettings;
  isSelected: boolean;
  isFavorite?: boolean;
  isActivated?: boolean;
  columns?: number;
  onSelect: (font: FontMetadata, e: React.MouseEvent) => void;
  onToggleFavorite?: (fontId: string) => void;
  onToggleActivate?: (font: FontMetadata) => void;
  onContextMenu?: (e: React.MouseEvent, font: FontMetadata) => void;
  onSelectLibrary?: (tag: FontLibraryTag, e: React.MouseEvent) => void;
}

export function FontItem({
  font,
  previewText = "",
  fontSize = 24,
  previewSettings,
  isSelected,
  isFavorite = false,
  isActivated = false,
  columns = 2,
  onSelect,
  onToggleFavorite,
  onToggleActivate,
  onContextMenu,
  onSelectLibrary,
}: FontItemProps) {
  const { t } = useTranslation();
  const [fontFamily, setFontFamily] = useState<string>("var(--font-system)");
  const [isLoaded, setIsLoaded] = useState(false);

  // 3열 이상이면 간소화 모드, 4열 이상이면 초소형 모드
  const isCompact = columns >= 3;
  const isUltraCompact = columns >= 4;
  const isInstalled =
    font.install_status === "installed_system" ||
    font.install_status === "installed_user" ||
    font.source === "system" ||
    font.source === "user";

  useEffect(() => {
    let isMounted = true;
    loadFontIntoDocument(font).then((family) => {
      if (isMounted) {
        setFontFamily(family);
        setIsLoaded(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [font]);

  const handleActivate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInstalled) return;
    onToggleActivate?.(font);
  };

  // 유효 스타일 계산
  const effectiveText = (previewSettings?.text !== undefined ? previewSettings.text : previewText) || font.full_name;
  const effectiveFontSize = previewSettings?.fontSize ?? fontSize;

  let effectiveWeight = font.weight;
  if (previewSettings) {
    if (previewSettings.fontWeight > 0) {
      effectiveWeight = previewSettings.fontWeight;
    } else if (previewSettings.isBold) {
      effectiveWeight = 700;
    }
  }

  const effectiveItalic = previewSettings?.isItalic ? true : font.is_italic;

  // 폰트 카드 박스 자체는 OS 기본 시스템 폰트 기준으로 렌더링
  const cardCustomStyle: React.CSSProperties = {
    fontFamily: "var(--font-system)",
    ...(previewSettings?.backgroundColor ? { backgroundColor: previewSettings.backgroundColor } : {}),
  };

  // 프리뷰 텍스트는 해당 박스 폰트를 우선하되, 폴백 및 기본 기준은 OS 기본 폰트 사용
  const previewFontFamily =
    isLoaded && fontFamily && fontFamily !== "inherit"
      ? fontFamily.includes("var(--font-system)")
        ? fontFamily
        : `${fontFamily}, var(--font-system)`
      : "var(--font-system)";

  const textCustomStyle: React.CSSProperties = {
    fontFamily: previewFontFamily,
    fontSize: `${effectiveFontSize}px`,
    fontWeight: effectiveWeight,
    fontStyle: effectiveItalic ? "italic" : "normal",
    lineHeight: previewSettings?.lineHeight ?? 1.45,
    letterSpacing: previewSettings ? `${previewSettings.letterSpacing}px` : undefined,
    textAlign: previewSettings?.textAlign ?? "left",
    textTransform: previewSettings?.textTransform ?? "none",
    textDecoration: previewSettings?.isUnderline ? "underline" : "none",
    color: previewSettings?.textColor || undefined,
  };

  const isDeleted = font.install_status === "deleted";
  const isUnplugged = font.install_status === "unplugged" || (font.isMissing && !isDeleted);
  const isDisconnected = isUnplugged || isDeleted;

  return (
    <div
      onClick={(e) => {
        if (isDisconnected) {
          e.stopPropagation();
          return;
        }
        onSelect(font, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, font);
      }}
      style={cardCustomStyle}
      className={`rounded-xl border transition-all duration-150 group select-none flex flex-col h-full ${
        isDisconnected ? "cursor-default" : "cursor-pointer"
      } ${
        isUltraCompact ? "p-2.5" : isCompact ? "p-3" : "p-4"
      } ${
        isDeleted
          ? "opacity-60 bg-theme-card/50 border-dashed border-rose-500/40 cursor-default"
          : isUnplugged
          ? "opacity-60 bg-theme-card/60 border-dashed border-amber-500/50 cursor-default"
          : isSelected
          ? "bg-theme-card border-theme-accent shadow-sm ring-1 ring-theme-accent/50 relative z-10"
          : isActivated
          ? "bg-theme-card border-theme-accent/50 shadow-2xs hover:bg-theme-card-hover hover:border-theme-accent"
          : "bg-theme-card border-theme-border-card shadow-2xs hover:bg-theme-card-hover hover:border-theme-border-card-hover hover:shadow-xs"
      }`}
    >
      {/* Font Header Info */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0 shrink-0">
        {/* Left: Heart + Family + Subfamily + LibraryAvatarStack */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(font.id);
            }}
            className={`p-0.5 rounded hover:bg-theme-hover transition-colors shrink-0 cursor-pointer ${
              isFavorite ? "text-rose-500 fill-rose-500" : "text-theme-text-muted hover:text-rose-500"
            }`}
            title={isFavorite ? t("font_item.favorite_remove") : t("font_item.favorite_add")}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>

          <span className="font-semibold text-xs text-theme-text tracking-tight truncate group-hover:text-theme-accent transition-colors">
            {font.family_name}
          </span>

          <span
            className={`font-medium text-theme-text-badge bg-theme-badge rounded-full shrink-0 border border-theme-border truncate max-w-[70px] ${
              isCompact ? "text-[10px] px-1.5 py-0.2" : "text-[11px] px-2 py-0.5"
            }`}
            title={font.subfamily_name}
          >
            {font.subfamily_name}
          </span>

          {/* 소속 서재 겹치는 아바타 원형 칩 스택 */}
          {font.libraries && font.libraries.length > 0 && (
            <LibraryAvatarStack
              libraries={font.libraries}
              onSelectLibrary={onSelectLibrary}
              maxDisplay={isUltraCompact ? 1 : 2}
            />
          )}
        </div>

        {/* Right: Version + Status + Actions + Format + Glyphs */}
        <div className="flex items-center gap-1 shrink-0 text-[10px]">
          {/* Version Badge (신버전/구버전 알림) */}
          <FontVersionBadge versionStatus={font.version_status} compact={isCompact} />

          {/* Install Status Badge (설치됨/미설치/언플러그 상태) */}
          <FontInstallStatusBadge status={font.install_status} compact={isCompact} />

          {/* Activate Button / Badge: 외부 폰트만 임시 활성화 가능 (연결끊김/삭제 폰트 제외) */}
          {!isInstalled && !isDisconnected && (
            <button
              onClick={handleActivate}
              className={`flex items-center gap-1 rounded font-mono border transition-all cursor-pointer ${
                isCompact ? "p-1" : "px-1.5 py-0.5"
              } ${
                isActivated
                  ? "bg-theme-accent-subtle text-theme-accent border-theme-accent font-semibold shadow-2xs"
                  : "bg-theme-badge hover:bg-theme-hover text-theme-text-secondary border-theme-border"
              }`}
              title={isActivated ? t("font_item.activated_tooltip") : t("font_item.activate_tooltip")}
            >
              <Zap
                className={`w-2.5 h-2.5 ${
                  isActivated ? "text-theme-accent fill-theme-accent" : "text-theme-text-muted"
                }`}
              />
              {!isCompact && (isActivated ? t("font_item.activated_label") : t("font_item.activate_label"))}
            </button>
          )}

          {/* Format Badge (3열 이상 시 WOFF2, TTC, OTF 등 약어로 표시) */}
          <FontFormatBadge format={font.format} compact={isCompact} />

          {/* Glyph Count (3열 이상 시 공간 확보를 위해 숨김) */}
          {!isCompact && (
            <span className="text-theme-text-muted font-mono shrink-0">
              {t("font_item.glyph_count", { count: font.glyph_count.toLocaleString() })}
            </span>
          )}
        </div>
      </div>

      {/* Live Preview Text Box */}
      <div
        className="w-full flex-1 overflow-hidden whitespace-pre-line break-words py-1.5 text-theme-text"
        style={textCustomStyle}
      >
        {isDeleted ? (
          <div>
            <span className="opacity-60">{effectiveText}</span>
            <span className="block text-[10px] text-rose-500/90 font-system italic mt-1">
              ({t("font_item.deleted_desc", "출처 폴더 제거됨 (서재 보존)")})
            </span>
          </div>
        ) : isUnplugged ? (
          <div>
            <span className="opacity-60">{effectiveText}</span>
            <span className="block text-[10px] text-amber-500/90 font-system italic mt-1">
              ({t("font_item.unplugged_desc", "원본 파일 연결 끊김")})
            </span>
          </div>
        ) : isLoaded ? (
          effectiveText
        ) : (
          <span className="text-theme-text-muted text-xs italic font-system">{t("font_item.loading")}</span>
        )}
      </div>

      {/* Subtle Meta Footer */}
      <div className="flex items-center justify-between text-[11px] text-theme-text-muted pt-1 mt-auto border-t border-theme-border-subtle gap-1 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {font.source === "system" ? (
            <span className="text-[9px] px-1 py-0.2 rounded bg-theme-badge text-theme-text-secondary font-medium shrink-0">
              {t("font_item.badge_system")}
            </span>
          ) : font.source === "user" ? (
            <span className="text-[9px] px-1 py-0.2 rounded bg-theme-accent-subtle text-theme-accent font-medium shrink-0">
              {t("font_item.badge_user")}
            </span>
          ) : (
            <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 font-medium shrink-0">
              {t("font_item.badge_external")}
            </span>
          )}
          <span className="truncate max-w-[120px] text-[10px]" title={font.file_name}>
            {font.file_name}
          </span>
        </div>
        <span className="font-mono text-[10px] shrink-0">{formatFileSize(font.file_size)}</span>
      </div>
    </div>
  );
}
