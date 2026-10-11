import { FontMetadata } from "../types/font";
import { curatedFontService } from "../services/curatedFontService";
import { googleFontService } from "../services/googleFontService";
import { fontsourceService } from "../services/fontsourceService";
import { buildGoogleSearchUrl, openExternalUrl, validateWebUrl } from "./url";

export interface OnlineFontLinkInfo {
  url: string;
  isGoogleSearch: boolean;
  label: string;
  tooltip: string;
}

/**
 * 온라인 폰트(추천 무료 폰트, 구글 폰트, 폰트 소스)의 공식 상세/다운로드 페이지 URL을 확인합니다.
 * 다운로드/공식 사이트 경로가 유효하지 않거나 없을 경우 구글 검색 URL로 안전하게 폴백합니다.
 * 
 * @param font 대상 폰트 메타데이터
 * @returns 공식 URL 정보 및 구글 검색 폴백 플래그
 */
export function resolveOnlineFontLink(font: FontMetadata): OnlineFontLinkInfo {
  // 1. 추천 무료 폰트 (curated:)
  if (font.file_path.startsWith("curated:")) {
    const rawTarget = font.file_path.replace("curated:", "");
    const [fontId] = rawTarget.split("|");
    const item = curatedFontService.getFontById(fontId);
    const rawHomepage = item?.homepage?.trim();

    if (rawHomepage && validateWebUrl(rawHomepage)) {
      return {
        url: rawHomepage,
        isGoogleSearch: false,
        label: "공식 사이트",
        tooltip: "공식 배포처 / 홈페이지로 이동합니다",
      };
    }

    const fontName = item?.name || item?.family || font.family_name || "무료 폰트";
    const query = `${fontName.trim()} 폰트`;
    return {
      url: buildGoogleSearchUrl(query),
      isGoogleSearch: true,
      label: "구글 검색",
      tooltip: "공식 다운로드 링크가 없어 구글 검색으로 이동합니다",
    };
  }

  // 2. Font Source (fontsource:)
  if (font.file_path.startsWith("fontsource:")) {
    const fId = font.file_path.replace("fontsource:", "").trim();
    if (fId) {
      const specimenUrl = fontsourceService.getSpecimenUrl(fId);
      if (validateWebUrl(specimenUrl)) {
        return {
          url: specimenUrl,
          isGoogleSearch: false,
          label: "페이지 열기",
          tooltip: "Fontsource 공식 상세 페이지로 이동합니다",
        };
      }
    }

    const query = `${(font.family_name || "fontsource").trim()} fontsource`;
    return {
      url: buildGoogleSearchUrl(query),
      isGoogleSearch: true,
      label: "구글 검색",
      tooltip: "공식 상세 경로가 없어 구글 검색으로 이동합니다",
    };
  }

  // 3. Google Fonts (google: 또는 기타 온라인 폰트)
  const family = font.family_name ? font.family_name.trim() : "";
  if (family) {
    const specimenUrl = googleFontService.getSpecimenUrl(family);
    if (validateWebUrl(specimenUrl)) {
      return {
        url: specimenUrl,
        isGoogleSearch: false,
        label: "페이지 열기",
        tooltip: "Google Fonts 공식 상세 페이지로 이동합니다",
      };
    }
  }

  const query = family ? `${family} google font` : "Google Fonts";
  return {
    url: buildGoogleSearchUrl(query),
    isGoogleSearch: true,
    label: "구글 검색",
    tooltip: "공식 상세 경로가 없어 구글 검색으로 이동합니다",
  };
}

/**
 * 온라인 폰트의 공식 상세 페이지 또는 구글 검색 페이지를 기본 웹 브라우저에서 엽니다.
 * 
 * @param font 대상 폰트 메타데이터
 */
export async function openOnlineFontLink(font: FontMetadata): Promise<void> {
  const linkInfo = resolveOnlineFontLink(font);
  await openExternalUrl(linkInfo.url);
}
