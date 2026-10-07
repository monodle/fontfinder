import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { z } from "zod";
import { STORAGE_KEYS } from "../config/storageKeys";

import ko from "./locales/ko.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import ja from "./locales/ja.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LANGUAGES = [
  { code: "ko", label: "한국어", englishLabel: "Korean" },
  { code: "en", label: "English", englishLabel: "English" },
  { code: "es", label: "Español", englishLabel: "Spanish" },
  { code: "ja", label: "日本語", englishLabel: "Japanese" },
  { code: "zh-CN", label: "简体中文", englishLabel: "Simplified Chinese" },
  { code: "zh-TW", label: "繁體中文", englishLabel: "Traditional Chinese" },
  { code: "de", label: "Deutsch", englishLabel: "German" },
  { code: "fr", label: "Français", englishLabel: "French" },
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];
export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export const supportedLanguageCodeSchema = z.enum(
  SUPPORTED_LANGUAGE_CODES as [SupportedLanguageCode, ...SupportedLanguageCode[]]
);

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  es: { translation: es },
  ja: { translation: ja },
  "zh-CN": { translation: zhCN },
  "zh-TW": { translation: zhTW },
  de: { translation: de },
  fr: { translation: fr },
};

// 브라우저 또는 시스템 언어 탐지
export const detectInitialLanguage = (): SupportedLanguageCode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    const parsed = supportedLanguageCodeSchema.safeParse(saved);
    if (parsed.success && parsed.data in resources) {
      return parsed.data;
    }
  } catch {
    // localStorage 접근 제한 환경 방어
  }

  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || "";
  const lower = browserLang.toLowerCase();

  if (lower.startsWith("ko")) return "ko";
  if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-hant") return "zh-TW";
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("en")) return "en";

  // 세팅 언어와 다른 언어가 OS에서 사용되면 기본 언어는 영어
  return "en";
};

const initialLang = detectInitialLanguage();

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLang;
  document.documentElement.setAttribute("data-lang", initialLang);
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React handles XSS safely
    },
  });

export const changeLanguage = (lang: string) => {
  const parsed = supportedLanguageCodeSchema.safeParse(lang);
  if (parsed.success && parsed.data in resources) {
    const validLang = parsed.data;
    void i18n.changeLanguage(validLang);
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, validLang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = validLang;
      document.documentElement.setAttribute("data-lang", validLang);
    }
  }
};

export default i18n;
