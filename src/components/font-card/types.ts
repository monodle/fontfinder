import React from "react";
import { FontMetadata, PreviewSettings, FontLibraryTag } from "../../types/font";

export type FontDetailMode = "detailed" | "simple";

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

export interface FontCardRenderProps {
  font: FontMetadata;
  isLoaded: boolean;
  effectiveText: string;
  cardCustomStyle: React.CSSProperties;
  textCustomStyle: React.CSSProperties;
  isSelected: boolean;
  isFavorite: boolean;
  isActivated: boolean;
  isInstalled: boolean;
  isDeleted: boolean;
  isUnplugged: boolean;
  isDisconnected: boolean;
  columns: number;
  isCompact: boolean;
  isUltraCompact: boolean;
  onSelect: (font: FontMetadata, e: React.MouseEvent) => void;
  onToggleFavorite?: (fontId: number) => void;
  onContextMenu?: (e: React.MouseEvent, font: FontMetadata) => void;
  onSelectLibrary?: (tag: FontLibraryTag, e: React.MouseEvent) => void;
  handleActivate: (e: React.MouseEvent) => void;
}
