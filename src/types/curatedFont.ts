export type CuratedFontMetadataRecord = Record<string, string>;
export type CuratedFontMetadataMap = Record<string, CuratedFontMetadataRecord>;

export interface CuratedFontPanose {
  familyType?: number;
  serifStyle?: number;
  weight?: number;
  proportion?: number;
  contrast?: number;
  strokeVariation?: number;
  armStyle?: number;
  letterform?: number;
  midline?: number;
  xHeight?: number;
}

export interface CuratedFontOS2 {
  familyClass?: {
    classId?: number;
    subclassId?: number;
  };
  panose?: CuratedFontPanose;
  weightClass?: number;
  widthClass?: number;
  selectionFlags?: string[];
  embedding?: string;
}

/**
 * 정규화된 런타임 추천 폰트 항목
 */
export interface CuratedFontItem {
  id: string;
  name: string;
  family: string;
  category: "sans-serif" | "serif" | "display" | "handwriting" | "monospace" | string;
  categories?: string[];
  languages?: string[];
  subsets: string[];
  version?: string;
  type?: string;
  author?: string;
  license: string;
  weights: number[];
  isVariable: boolean;
  cssUrl: string;
  homepage?: string;
  description?: string;
  os2?: CuratedFontOS2;
  metadata?: CuratedFontMetadataMap;
}

/**
 * 원격 저장소에서 수신되는 원시 JSON 항목 (레거시 및 신규 규격 포괄)
 */
export interface RawCuratedFontItem {
  id?: string;
  name?: string;
  family?: string;
  category?: string;
  categories?: string[];
  languages?: string[];
  subsets?: string[];
  version?: string;
  type?: string;
  author?: string;
  license?: string;
  weights?: number[];
  isVariable?: boolean;
  cssUrl?: string;
  homepage?: string;
  description?: string;
  os2?: CuratedFontOS2;
  metadata?: CuratedFontMetadataMap;
}

export interface CuratedFontCatalog {
  nextRepo?: string | null;
  fonts: CuratedFontItem[];
}

