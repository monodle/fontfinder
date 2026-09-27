import { fontService } from "../services/fontService";
import { FontMetadata } from "../types/font";

const loadedFontFaces = new Map<string, FontFace>();
const loadingPromises = new Map<string, Promise<string>>();

function getCustomFontFamily(font: FontMetadata): string {
  // CSS font-family에서 충돌이 없도록 고유 ID를 안전한 식별자로 변환
  const safeId = font.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `custom_font_${safeId}`;
}

export async function loadFontIntoDocument(font: FontMetadata): Promise<string> {
  const familyName = getCustomFontFamily(font);

  if (loadedFontFaces.has(font.id)) {
    return familyName;
  }

  if (loadingPromises.has(font.id)) {
    return loadingPromises.get(font.id)!;
  }

  const loadPromise = (async () => {
    const fontUrl = fontService.getFontUrl(font.file_path);

    try {
      const weightStr =
        font.weight && font.weight >= 100 && font.weight <= 900
          ? font.weight.toString()
          : "normal";

      const fontFace = new FontFace(familyName, `url("${fontUrl}")`, {
        weight: weightStr,
        style: font.is_italic ? "italic" : "normal",
      });

      const loaded = await fontFace.load();
      document.fonts.add(loaded);
      loadedFontFaces.set(font.id, loaded);
      return familyName;
    } catch (error) {
      console.warn(
        `Failed to dynamically load font: ${font.full_name} (${font.file_path}) from ${fontUrl}`,
        error
      );
      // 시스템 또는 사용자 설치 폰트라면 font.family_name으로 fallback (os 기본 폰트 스택 연결)
      if (font.family_name) {
        return `"${font.family_name}", var(--font-system)`;
      }
      return "var(--font-system)";
    } finally {
      loadingPromises.delete(font.id);
    }
  })();

  loadingPromises.set(font.id, loadPromise);
  return loadPromise;
}
