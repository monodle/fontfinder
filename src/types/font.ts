export type FontFormat =
  | "TrueType"
  | "OpenType"
  | "TrueTypeCollection"
  | "Woff"
  | "Woff2"
  | "Unknown";

type FontSource = "system" | "user" | "external";

export type FontInstallStatus =
  | "installed_system"
  | "installed_user"
  | "activated"
  | "uninstalled"
  | "unplugged"
  | "deleted";

export type FontVersionStatus =
  | "up_to_date"
  | "update_available"
  | "outdated"
  | "none";

export interface FontLibraryTag {
  id: string | number;
  name: string;
  type: "set" | "folder";
  color: string;
}

export interface FontMetadata {
  id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  file_hash?: string;
  fast_hash?: string;
  deep_hash?: string;
  duplicate_count?: number;
  is_duplicate?: boolean;
  font_index: number;
  family_name: string;
  subfamily_name: string;
  full_name: string;
  postscript_name: string;
  localized_names?: Record<string, string>;
  format: FontFormat;
  source: FontSource;
  glyph_count: number;
  weight: number;
  is_italic: boolean;
  is_monospace: boolean;
  is_variable: boolean;
  version?: string;
  version_num?: number;
  designer?: string;
  copyright?: string;
  license?: string;
  // 동적 상태 속성
  install_status?: FontInstallStatus;
  version_status?: FontVersionStatus;
  installed_path?: string;
  installed_version?: string;
  libraries?: FontLibraryTag[];
  isMissing?: boolean;
  alt_paths?: string[];
}

export interface FontSet {
  id: number;
  name: string;
  color: string;
  count: number;
  parent_id?: number | null;
  sort_order?: string;
}

export interface FlatSetItem {
  set: FontSet;
  depth: 1 | 2;
  parentId: number | null;
  hasChildren: boolean;
  isCollapsed: boolean;
}

export interface FontSection {
  id: string;
  setId?: number;
  title: string;
  color?: string;
  isParent?: boolean;
  count: number;
  fonts: FontMetadata[];
}

export const VIEW_MODES = ["list", "grid"] as const;
export type ViewMode = typeof VIEW_MODES[number];

export const FONT_DETAIL_MODES = ["detailed", "simple"] as const;
export type FontDetailMode = typeof FONT_DETAIL_MODES[number];

export const TEXT_ALIGN_OPTIONS = ["left", "center", "right"] as const;
export type TextAlignOption = typeof TEXT_ALIGN_OPTIONS[number];

export const TEXT_TRANSFORM_OPTIONS = ["none", "uppercase", "lowercase", "capitalize"] as const;
export type TextTransformOption = typeof TEXT_TRANSFORM_OPTIONS[number];

export interface CategoryCounts {
  total: number;
  system: number;
  user: number;
  activated: number;
  favorites: number;
  duplicates: number;
  duplicateGroups?: number;
}

export interface PreviewSettings {
  text: string;
  fontSize: number;
  fontWeight: number; // 0: 폰트 자체 weight 사용, 100~900: 사용자 강제 weight
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  letterSpacing: number; // px 단위
  lineHeight: number; // 배수
  textAlign: TextAlignOption;
  textTransform: TextTransformOption;
  textColor: string; // 빈 문자열("")이면 기본 테마 색상 사용
  backgroundColor: string; // 빈 문자열("")이면 기본 테마 색상 사용
}

export interface DbFolder {
  id: number;
  path: string;
  name: string;
  color: string;
  sort_order?: string;
}

export interface ActivatedFontRecord {
  font_id: number;
  file_path: string;
}

export interface CustomFolder {
  id?: number;
  path: string;
  name: string;
  color: string;
  count: number;
  sort_order?: string;
  isMissing?: boolean;
  isScanning?: boolean;
  scanProgress?: { current: number; total: number };
}

export interface FolderStatus {
  id: number;
  path: string;
  name: string;
  color: string;
  exists: boolean;
  sort_order?: string;
}

export interface FontNameRecord {
  name_id: number;
  name_key: string;
  value: string;
  language_id?: number;
  language_tag?: string;
}

export interface FontMetricsRecord {
  units_per_em: number;
  ascender: number;
  descender: number;
  line_gap: number;
  win_ascent?: number | null;
  win_descent?: number | null;
  cap_height?: number | null;
  x_height?: number | null;
  italic_angle: number;
  underline_position: number;
  underline_thickness: number;
  is_monospaced: boolean;
  bbox_xmin: number;
  bbox_ymin: number;
  bbox_xmax: number;
  bbox_ymax: number;
}

export interface FontOs2Record {
  version: number;
  weight_class: number;
  width_class: number;
  fs_type: number;
  fs_type_label: string;
  fs_selection: number;
  s_family_class: number;
  family_class_name: string;
  panose: number[];
  vendor_id: string;
}

export interface FontLanguageCoverage {
  total_glyph_count: number;
  encoded_char_count: number;
  has_latin_basic: boolean;
  latin_basic_count?: number;
  has_latin_extended: boolean;
  latin_extended_count?: number;
  hangul_syllable_count: number;
  hangul_type: "none" | "basic_ks_2350" | "full_11172" | "partial";
  has_hangul_jamo: boolean;
  cjk_ideograph_count: number;
  has_japanese_kana: boolean;
  japanese_kana_count?: number;
  has_cyrillic: boolean;
  has_greek: boolean;
  has_arabic: boolean;
  supported_scripts: string[];
}

export interface FontVariableAxis {
  tag: string;
  name: string;
  min_value: number;
  default_value: number;
  max_value: number;
}

export interface FontVariableInfo {
  is_variable: boolean;
  axes: FontVariableAxis[];
}

export interface FontDetailedInfo {
  id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  font_index: number;
  format: FontFormat;
  style_classification: string;
  created_timestamp?: number | null;
  modified_timestamp?: number | null;
  names: FontNameRecord[];
  metrics: FontMetricsRecord;
  os2?: FontOs2Record | null;
  coverage: FontLanguageCoverage;
  opentype_features: string[];
  variable?: FontVariableInfo | null;
}


