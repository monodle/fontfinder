export interface GoogleFontVariant {
  thickness?: number;
  slant?: number;
  width?: number;
  lineHeight?: number;
}

export interface GoogleFontFamily {
  family: string;
  displayName?: string | null;
  category: "Sans Serif" | "Serif" | "Display" | "Handwriting" | "Monospace" | string;
  size?: number;
  subsets: string[];
  fonts: Record<string, GoogleFontVariant>;
  designers: string[];
  lastModified?: string;
  dateAdded?: string;
  popularity: number;
  isOpenSource?: boolean;
  isNoto?: boolean;
  axes?: unknown[];
}

export interface GoogleFontsMetadataResponse {
  axisRegistry?: unknown[];
  familyMetadataList: GoogleFontFamily[];
  promotedScript?: unknown;
}

