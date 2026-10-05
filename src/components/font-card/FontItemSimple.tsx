import { useTranslation } from "react-i18next";
import { FontDuplicateBadge } from "../FontBadge";
import { getFontFamilyName } from "../../utils/fontLocalization";
import { FontCardRenderProps } from "./types";

export function FontItemSimple({
  font,
  isLoaded,
  effectiveText,
  cardCustomStyle,
  textCustomStyle,
  isSelected,
  isActivated,
  isDeleted,
  isUnplugged,
  isDisconnected,
  isCompact,
  isUltraCompact,
  onSelect,
  onContextMenu,
}: FontCardRenderProps) {
  const { t, i18n } = useTranslation();
  const displayName = getFontFamilyName(font, i18n.language);

  return (
    <div
      data-font-card-id={font.id}
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
        isUltraCompact ? "p-2.5" : isCompact ? "p-3" : "p-3.5"
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
      {/* 1. 간결한 헤더: 폰트 이름 + 폰트 Weight(Subfamily) + 중복 뱃지 */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* 폰트 이름 */}
          <span className="font-semibold text-xs text-theme-text tracking-tight truncate group-hover:text-theme-accent transition-colors">
            {displayName}
          </span>

          {/* 폰트 Weight (Subfamily 값) */}
          <span
            className={`font-medium text-theme-text-badge bg-theme-badge rounded-full shrink-0 border border-theme-border truncate max-w-[80px] ${
              isCompact ? "text-[10px] px-1.5 py-0.2" : "text-[11px] px-2 py-0.5"
            }`}
            title={font.subfamily_name}
          >
            {font.subfamily_name}
          </span>
        </div>

        <FontDuplicateBadge count={font.duplicate_count} compact={isCompact} />
      </div>

      {/* 2. 문구 미리보기 영역 (하단 푸터 없이 최대 면적으로 시원하게 렌더링 - 상단 정렬) */}
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
    </div>
  );
}
