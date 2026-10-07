/**
 * LocalStorage Key Single Source of Truth (SSOT)
 * 네임스페이스 격리 및 오타 방지를 위한 중앙 저장소 키 정의
 */
export const STORAGE_KEYS = {
  USER_SETTINGS: "fontfinder_user_settings",
  ONBOARDING_COMPLETED: "fontfinder_onboarding_completed",
  LANGUAGE: "fontfinder_language",
  PREVIEW_SETTINGS: "fontfinder_preview_settings",
  SIDEBAR_COLLAPSED: "fontfinder_sidebar_collapsed",
  LEGACY_CUSTOM_FOLDERS: "fontfinder_custom_folders",
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Tauri SQLite Database Settings Key Single Source of Truth (SSOT)
 */
export const DB_SETTINGS_KEYS = {
  USER_SETTINGS: "user_app_settings",
  ONBOARDING_COMPLETED: "onboarding_completed",
  PREVIEW_SETTINGS: "preview_settings",
} as const;

export type DbSettingsKey = typeof DB_SETTINGS_KEYS[keyof typeof DB_SETTINGS_KEYS];
