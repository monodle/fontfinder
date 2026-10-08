import { invoke } from "@tauri-apps/api/core";
import { GoogleFontFamily, GoogleFontsMetadataResponse } from "../types/googleFont";
import { networkManager } from "./networkManager";

const CACHE_KEY = "fontfinder_google_fonts_metadata_v1";

class GoogleFontService {
  private cachedFonts: GoogleFontFamily[] | null = null;
  private fetchPromise: Promise<GoogleFontFamily[]> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      // 세션 스토리지에 캐시된 데이터가 있으면 즉시 로드 (0ms)
      try {
        const stored = sessionStorage.getItem(CACHE_KEY);
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list) && list.length > 0) {
            this.cachedFonts = list;
          }
        }
      } catch {
        // 캐시 접근 실패 시 무시
      }
    }
  }

  public get isOnline(): boolean {
    return networkManager.isOnline;
  }

  /**
   * Google Fonts 메타데이터를 Rust 백엔드를 통해 비동기로 가져옵니다.
   * 중복 호출 시 단일 Promise를 재사용하며, 메모리 및 세션스토리지에 캐싱합니다.
   */
  public async getMetadata(): Promise<GoogleFontFamily[]> {
    if (this.cachedFonts && this.cachedFonts.length > 0) {
      return this.cachedFonts;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        const rawJson = await invoke<string>("fetch_google_fonts_metadata");
        const parsed: GoogleFontsMetadataResponse = JSON.parse(rawJson);
        const list = parsed.familyMetadataList || [];
        this.cachedFonts = list;
        if (typeof window !== "undefined" && list.length > 0) {
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(list));
          } catch {
            // 용량 한도 초과 시 무시
          }
        }
        return list;
      } catch (err) {
        // 실제 물리 인터넷이 단절되었는지 소켓 레벨 정밀 검증
        const isActuallyOnline = await networkManager.checkNow();
        if (!isActuallyOnline) {
          networkManager.reportNetworkFailure();
        }
        throw err;
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  /**
   * 현재 캐시된 폰트 수 (아직 로드되지 않았으면 0)
   */
  public getCachedCount(): number {
    return this.cachedFonts ? this.cachedFonts.length : 0;
  }

  /**
   * Google Fonts 공식 상세/다운로드 페이지 URL 생성
   */
  public getSpecimenUrl(family: string): string {
    const slug = encodeURIComponent(family.replace(/ /g, "+"));
    return `https://fonts.google.com/specimen/${slug}`;
  }

  /**
   * 기본 브라우저에서 Google Fonts 상세 페이지 열기
   */
  public async openSpecimenPage(family: string): Promise<void> {
    const url = this.getSpecimenUrl(family);
    try {
      await invoke("open_external_url", { url });
    } catch {
      // Fallback
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    }
  }

  /**
   * 실시간 프리뷰를 위한 Google Fonts CSS2 URL 생성 (서브셋 최적화 적용)
   */
  public buildWebFontUrl(family: string, previewText?: string, weight: number = 400): string {
    const familyParam = `${encodeURIComponent(family)}:wght@${weight}`;
    let url = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;

    if (previewText && previewText.trim().length > 0) {
      // 중복 문자 제거로 URL 길이 및 페이로드 최소화
      const uniqueChars = Array.from(new Set(previewText.replace(/\s+/g, ""))).join("");
      if (uniqueChars.length > 0) {
        url += `&text=${encodeURIComponent(uniqueChars)}`;
      }
    }

    return url;
  }
}

export const googleFontService = new GoogleFontService();
