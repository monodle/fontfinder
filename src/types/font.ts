type FontFormat =
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
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_hash?: string;
  font_index: number;
  family_name: string;
  subfamily_name: string;
  full_name: string;
  postscript_name: string;
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
}

export interface PreviewSettings {
  text: string;
  fontSize: number;
  fontWeight: number; // 0: 폰트 자체 weight 사용, 100~900: 사용자 강제 weight
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  letterSpacing: number; // px 단위, -2 ~ 10
  lineHeight: number; // 배수, 1.0 ~ 2.5
  textAlign: "left" | "center" | "right";
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  textColor: string; // 빈 문자열("")이면 기본 테마 색상 사용
  backgroundColor: string; // 빈 문자열("")이면 기본 테마 색상 사용
}

export interface DbFolder {
  id: number;
  path: string;
  name: string;
  color: string;
}

export interface ActivatedFontRecord {
  font_id: string;
  file_path: string;
}

export interface CustomFolder {
  id?: number;
  path: string;
  name: string;
  color: string;
  count: number;
  isMissing?: boolean;
}

export interface FolderStatus {
  id: number;
  path: string;
  name: string;
  color: string;
  exists: boolean;
}


