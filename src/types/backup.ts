import type { CustomAppSettings } from "../services/settingsService";

export interface BackupFolder {
  path: string;
  name: string;
  color?: string;
}

export interface BackupFontHashRef {
  fastHash: string;
  deepHash?: string | null;
}

export interface BackupSet {
  name: string;
  color?: string;
  fontHashes?: BackupFontHashRef[];
  fontIds?: number[];
}

/**
 * 간결화된 백업 데이터 구조
 */
export interface AppBackupData {
  settings?: CustomAppSettings;
  folders?: BackupFolder[];
  sets?: BackupSet[];
}

export interface BackupCategorySelection {
  settings: boolean;
  folders: boolean;
  sets: boolean;
}

export interface BackupSummary {
  hasSettings: boolean;
  foldersCount: number;
  setsCount: number;
}
