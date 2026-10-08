import { useState, useEffect } from "react";
import { PreviewSettings } from "../types/font";
import { fontService } from "../services/fontService";
import { settingsService } from "../services/settingsService";
import { defaultPreviewSettings } from "../config/appConfig";
import { STORAGE_KEYS, DB_SETTINGS_KEYS } from "../config/storageKeys";
import { sanitizePreviewSettings } from "../utils/settingsSanitizer";

export function usePreviewSettingsManager() {
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>(() => {
    try {
      const initialApp = settingsService.getInitialSettings();
      const saved = localStorage.getItem(STORAGE_KEYS.PREVIEW_SETTINGS);
      const base: PreviewSettings = {
        ...defaultPreviewSettings,
        text: initialApp.defaultPreviewText,
        fontSize: initialApp.defaultFontSize,
        textAlign: initialApp.defaultTextAlign || "left",
        lineHeight: initialApp.defaultLineHeight || 1.45,
        letterSpacing: initialApp.defaultLetterSpacing ?? 0,
        textColor: initialApp.defaultTextColor,
        backgroundColor: initialApp.defaultBackgroundColor,
        isBold: Boolean(initialApp.defaultIsBold),
        isItalic: Boolean(initialApp.defaultIsItalic),
        isUnderline: Boolean(initialApp.defaultIsUnderline),
      };
      if (saved) {
        return sanitizePreviewSettings(JSON.parse(saved), base);
      }
      return base;
    } catch {
      return defaultPreviewSettings;
    }
  });

  // 프리뷰 설정 동기화 (로컬스토리지 즉시, DB 300ms 디바운스 저장)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PREVIEW_SETTINGS, JSON.stringify(previewSettings));
    } catch (e) {
      console.error("previewSettings 로컬 저장 실패:", e);
    }

    const timer = setTimeout(() => {
      void fontService.setSetting(DB_SETTINGS_KEYS.PREVIEW_SETTINGS, JSON.stringify(previewSettings));
    }, 300);

    return () => clearTimeout(timer);
  }, [previewSettings]);

  return {
    previewSettings,
    setPreviewSettings,
  };
}
