import { useEffect, useState } from "react";
import { FontMetadata, PreviewSettings, FontLibraryTag } from "../../types/font";
import { loadFontIntoDocument, retainFont, releaseFont } from "../../utils/fontLoader";
import { FontDetailMode } from "./types";
import { FontItemDetailed } from "./FontItemDetailed";
import { FontItemSimple } from "./FontItemSimple";

export interface FontItemProps {
  font: FontMetadata;
  previewText?: string;
  fontSize?: number;
  previewSettings?: PreviewSettings;
  detailMode?: FontDetailMode;
  isSelected: boolean;
  isFavorite?: boolean;
  isActivated?: boolean;
  columns?: number;
  onSelect: (font: FontMetadata, e: React.MouseEvent) => void;
  onToggleFavorite?: (fontId: number) => void;
  onToggleActivate?: (font: FontMetadata) => void;
  onContextMenu?: (e: React.MouseEvent, font: FontMetadata) => void;
  onSelectLibrary?: (tag: FontLibraryTag, e: React.MouseEvent) => void;
}

export function FontItem({
  font,
  previewText = "",
  fontSize = 24,
  previewSettings,
  detailMode = "detailed",
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
  const [fontFamily, setFontFamily] = useState<string>("var(--font-system)");
  const [isLoaded, setIsLoaded] = useState(false);

  // 3열 이상이면 간소화 모드, 4열 이상이면 초소형 모드
  const isCompact = columns >= 3;
  const isUltraCompact = columns >= 4;
  const { id, file_path, weight, is_italic, isMissing, install_status, source } = font;

  const isInstalled =
    install_status === "installed_system" ||
    install_status === "installed_user" ||
    source === "system" ||
    source === "user";

  const isDeleted = install_status === "deleted";
  const isUnplugged = Boolean(install_status === "unplugged" || (isMissing && !isDeleted));
  const isDisconnected = Boolean(isUnplugged || isDeleted);
  const isUnavailable = Boolean(isMissing || isDisconnected);

  useEffect(() => {
    if (isUnavailable) {
      setFontFamily("var(--font-system)");
      setIsLoaded(true);
      return;
    }

    let isMounted = true;
    retainFont(id);

    loadFontIntoDocument(font).then((family) => {
      if (isMounted) {
        setFontFamily(family);
        setIsLoaded(true);
      }
    });

    return () => {
      isMounted = false;
      releaseFont(id);
    };
  }, [id, file_path, weight, is_italic, isUnavailable]);

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

  const cardProps = {
    font,
    isLoaded,
    effectiveText,
    cardCustomStyle,
    textCustomStyle,
    isSelected,
    isFavorite,
    isActivated,
    isInstalled,
    isDeleted,
    isUnplugged,
    isDisconnected,
    columns,
    isCompact,
    isUltraCompact,
    onSelect,
    onToggleFavorite,
    onContextMenu,
    onSelectLibrary,
    handleActivate,
  };

  if (detailMode === "simple") {
    return <FontItemSimple {...cardProps} />;
  }

  return <FontItemDetailed {...cardProps} />;
}
