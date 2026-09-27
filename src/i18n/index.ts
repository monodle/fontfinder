import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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
export const detectInitialLanguage = (): string => {
  const saved = localStorage.getItem("fontfinder_language");
  if (saved && saved in resources) {
    return saved;
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
  if (lang in resources) {
    void i18n.changeLanguage(lang);
    localStorage.setItem("fontfinder_language", lang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.setAttribute("data-lang", lang);
    }
  }
};

export default i18n;
