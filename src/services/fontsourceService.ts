import { invoke } from "@tauri-apps/api/core";
import { FontsourceItem } from "../types/fontsource";
import { networkManager } from "./networkManager";
import { openExternalUrl, buildGoogleSearchUrl } from "../utils/url";

const CACHE_KEY = "fontfinder_fontsource_metadata_v1";

class FontsourceService {
  private cachedFonts: FontsourceItem[] | null = null;
  private fetchPromise: Promise<FontsourceItem[]> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      // 1. 기존 영구 캐시가 있으면 즉각 메모리에 적재 (0ms 즉시 표시)
      try {
        const stored = localStorage.getItem(CACHE_KEY);
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
   * Fontsource 메타데이터를 Rust 백엔드를 통해 비동기로 가져옵니다.
   * 중복 호출 시 단일 Promise를 재사용하며, 메모리 및 로컬스토리지에 캐싱합니다.
   */
  public async getMetadata(): Promise<FontsourceItem[]> {
    if (this.cachedFonts && this.cachedFonts.length > 0) {
      return this.cachedFonts;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        const rawJson = await invoke<string>("fetch_fontsource_metadata");
        const list: FontsourceItem[] = JSON.parse(rawJson);
        this.cachedFonts = Array.isArray(list) ? list : [];
        if (typeof window !== "undefined" && this.cachedFonts.length > 0) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(this.cachedFonts));
          } catch {
            // 용량 한도 초과 시 무시
          }
        }
        return this.cachedFonts;
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
   * Fontsource 공식 상세 페이지 URL 생성 (비어있으면 구글 검색 URL로 폴백)
   */
  public getSpecimenUrl(id: string, familyName?: string): string {
    const cleanId = id ? id.trim() : "";
    if (!cleanId) {
      const query = familyName ? `${familyName.trim()} fontsource` : "Fontsource";
      return buildGoogleSearchUrl(query);
    }
    return `https://fontsource.org/fonts/${encodeURIComponent(cleanId)}`;
  }

  /**
   * 기본 브라우저에서 Fontsource 상세 페이지 열기
   */
  public async openSpecimenPage(id: string, familyName?: string): Promise<void> {
    const url = this.getSpecimenUrl(id, familyName);
    await openExternalUrl(url);
  }

  /**
   * 실시간 프리뷰를 위한 jsDelivr 기반 Fontsource index.css URL 생성
   */
  public buildWebFontCssUrl(id: string): string {
    return `https://cdn.jsdelivr.net/npm/@fontsource/${encodeURIComponent(id)}@latest/index.css`;
  }
}

export const fontsourceService = new FontsourceService();
