import React from "react";
import { FontMetadata, FontLibraryTag } from "../../types/font";

export type FontDetailMode = "detailed" | "simple";


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
