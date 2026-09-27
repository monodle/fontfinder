import { fontService } from "../services/fontService";
import { FontMetadata } from "../types/font";

const loadedFontFaces = new Map<string, FontFace>();
const loadingPromises = new Map<string, Promise<string>>();

function getCustomFontFamily(font: FontMetadata): string {
  // CSS font-family에서 충돌이 없도록 고유 ID를 안전한 식별자로 변환
  const safeId = font.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `custom_font_${safeId}`;
}

/**
 * 폰트 이름을 CSS font-family / local()에서 안전하게 사용하도록 이스케이프
 */
function escapeFontName(name?: string): string {
  if (!name) return "";
  const cleaned = name.replace(/["\\]/g, "");
  return `"${cleaned}"`;
}

/**
 * OS에 설치된 로컬 글꼴에 직접 매칭할 수 있는 fallback 스택 생성
 */
function buildLocalFallbackStack(font: FontMetadata): string {
  const names = [font.full_name, font.family_name, font.postscript_name]
    .filter((n): n is string => Boolean(n && n.trim().length > 0))
    .map(escapeFontName);

  const unique = Array.from(new Set(names));
  if (unique.length > 0) {
    return `${unique.join(", ")}, var(--font-system)`;
  }
  return "var(--font-system)";
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

      // OS에 이미 설치된 시스템/사용자 폰트 및 TTC 파일 인덱싱 한계를 해결하기 위해
      // local() 지시어를 우선 등록하여 DirectWrite/OS 글꼴 엔진을 즉각 활용
      const localSources: string[] = [];
      if (font.full_name) {
        localSources.push(`local(${escapeFontName(font.full_name)})`);
      }
      if (font.family_name && font.family_name !== font.full_name) {
        localSources.push(`local(${escapeFontName(font.family_name)})`);
      }
      if (font.postscript_name && font.postscript_name !== font.full_name) {
        localSources.push(`local(${escapeFontName(font.postscript_name)})`);
      }

      // local() 후보들을 앞에 두고, 외장/미설치 폰트는 url()로 다운로드
      const fontSrc = [...localSources, `url("${fontUrl}")`].join(", ");

      const fontFace = new FontFace(familyName, fontSrc, {
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
      // 로드 실패 시에도 OS 네이티브 폰트 스택으로 매칭 시도
      return buildLocalFallbackStack(font);
    } finally {
      loadingPromises.delete(font.id);
    }
  })();

  loadingPromises.set(font.id, loadPromise);
  return loadPromise;
}

