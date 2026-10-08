/**
 * 앱의 i18n 언어 코드(ko, ja, zh-CN 등)를 온라인 폰트 제공자(Google Fonts, Fontsource)의 서브셋 ID로 매핑합니다.
 */
export function getInitialSubsetForLanguage(languageCode?: string): string {
  if (!languageCode) return "all";
  const code = languageCode.toLowerCase();
  if (code.startsWith("ko")) return "korean";
  if (code.startsWith("ja")) return "japanese";
  if (code === "zh-tw" || code === "zh-hk" || code === "zh-hant") return "chinese-traditional";
  if (code.startsWith("zh")) return "chinese-simplified";
  if (code.startsWith("en") || code.startsWith("es") || code.startsWith("fr") || code.startsWith("de")) return "latin";
  return "all";
}
