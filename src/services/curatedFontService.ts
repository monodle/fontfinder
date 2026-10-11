import { invoke } from "@tauri-apps/api/core";
import { appConfig } from "../config/appConfig";
import i18n from "../i18n";
import { normalizeCuratedFontUrl } from "../schemas/envSchemas";
import {
  CuratedFontCatalog,
  CuratedFontItem,
  RawCuratedFontItem,
} from "../types/curatedFont";
import { networkManager } from "./networkManager";
import { openExternalUrl, buildGoogleSearchUrl } from "../utils/url";

const CACHE_KEY = "fontfinder_curated_metadata_v4";
const MAX_CATALOG_CHAIN_DEPTH = 30;

/**
 * 다국어 레코드에서 우선순위에 따라 텍스트를 추출합니다.
 * 우선순위:
 * 1. 앱 언어 설정에 맞는 언어 (appLang)
 * 2. 'en' (글로벌 표준)
 * 3. 'en'마저 없다면 'ko' (한국어)
 * 4. 'en', 'ko'마저 없다면 첫 번째로 등록된 언어 값
 */
export function getLocalizedText(
  record?: Record<string, string> | null,
  appLang?: string
): string | undefined {
  if (!record || typeof record !== "object") return undefined;

  const targetLang = appLang || i18n.language || "ko";

  // 1. 앱 언어 설정에 맞는 언어
  if (typeof record[targetLang] === "string" && record[targetLang].trim()) {
    return record[targetLang].trim();
  }
  // 로케일 접두사 대응 (예: 'ko-KR' -> 'ko', 'zh-CN' -> 'zh')
  if (targetLang.includes("-")) {
    const prefix = targetLang.split("-")[0];
    if (typeof record[prefix] === "string" && record[prefix].trim()) {
      return record[prefix].trim();
    }
  }

  // 2. 'en' (글로벌 표준)
  if (typeof record["en"] === "string" && record["en"].trim()) {
    return record["en"].trim();
  }

  // 3. 'en'마저 없다면 'ko' (한국어)
  if (typeof record["ko"] === "string" && record["ko"].trim()) {
    return record["ko"].trim();
  }

  // 4. 'en', 'ko'마저 없다면 첫 번째로 등록된 언어 값
  for (const val of Object.values(record)) {
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }

  return undefined;
}

/**
 * 원시 폰트 데이터를 애플리케이션 표준 CuratedFontItem으로 정규화합니다.
 */
export function normalizeCuratedFontItem(
  raw: RawCuratedFontItem,
  appLang?: string
): CuratedFontItem {
  const currentLang = appLang || i18n.language || "ko";

  const id = raw.id || raw.family || "unknown-font";
  const family = raw.family || raw.id || "UnknownFont";

  // 폰트 표시 이름 결정: Full Font Name -> Font Family -> name -> family
  const resolvedName =
    getLocalizedText(raw.metadata?.["Full Font Name"], currentLang) ||
    getLocalizedText(raw.metadata?.["Font Family"], currentLang) ||
    raw.name ||
    family;

  // 카테고리 결정: categories[0] -> category -> "sans-serif"
  const categories =
    Array.isArray(raw.categories) && raw.categories.length > 0
      ? raw.categories
      : raw.category
        ? [raw.category]
        : ["sans-serif"];
  const category = categories[0] || "sans-serif";

  // 언어/서브셋 결정: languages -> subsets -> []
  const languages =
    Array.isArray(raw.languages) && raw.languages.length > 0
      ? raw.languages
      : Array.isArray(raw.subsets) && raw.subsets.length > 0
        ? raw.subsets
        : [];

  // 제작자/디자이너 결정: Designer -> Manufacturer -> author -> "Curated Font"
  const author =
    getLocalizedText(raw.metadata?.["Designer"], currentLang) ||
    getLocalizedText(raw.metadata?.["Manufacturer"], currentLang) ||
    raw.author ||
    "Curated Font";

  // 라이선스 결정
  const license =
    raw.license ||
    getLocalizedText(raw.metadata?.["License Description"], currentLang) ||
    "Open Source";

  const weights =
    Array.isArray(raw.weights) && raw.weights.length > 0 ? raw.weights : [400];

  return {
    id,
    name: resolvedName,
    family,
    category,
    categories,
    languages,
    subsets: languages,
    version: raw.version || getLocalizedText(raw.metadata?.["Version"], currentLang),
    type: raw.type || "self-hosted",
    author,
    license,
    weights,
    isVariable: Boolean(raw.isVariable),
    cssUrl: raw.cssUrl || "",
    homepage: raw.homepage || getLocalizedText(raw.metadata?.["URL Vendor"], currentLang),
    description: raw.description || getLocalizedText(raw.metadata?.["Description"], currentLang),
    os2: raw.os2,
    metadata: raw.metadata,
  };
}

class CuratedFontService {
  private cachedFonts: CuratedFontItem[] | null = null;
  private fontMap: Map<string, CuratedFontItem> = new Map();
  private fetchPromise: Promise<CuratedFontItem[]> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const list: unknown[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.fonts)
              ? parsed.fonts
              : [];
          if (list.length > 0) {
            const normalizedList = list.map((item) =>
              normalizeCuratedFontItem(item as RawCuratedFontItem)
            );
            this.setCachedFonts(normalizedList);
          }
        }
      } catch {
        // 로컬 스토리지 접근 실패 시 무시
      }
    }
  }

  public get isOnline(): boolean {
    return networkManager.isOnline;
  }

  /**
   * 설정된 추천 폰트 메타데이터 URL
   */
  public get metadataUrl(): string {
    return appConfig.curatedFonts.url;
  }

  private setCachedFonts(list: CuratedFontItem[]): void {
    this.cachedFonts = list;
    this.fontMap.clear();
    for (const item of list) {
      if (item && item.id) {
        this.fontMap.set(item.id, item);
      }
    }
  }

  /**
   * 단일 URL에서 JSON 텍스트를 가져옵니다.
   * Rust 백엔드 IPC 호출을 우선 시도하고, 웹 브라우저 환경 시 fetch로 폴백합니다.
   */
  private async fetchRawJson(url: string): Promise<string> {
    try {
      return await invoke<string>("fetch_curated_font_metadata", { url });
    } catch {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.text();
    }
  }

  /**
   * 반환된 JSON 문자열을 파싱하여 정규화된 fonts 배열과 nextRepo URL을 추출합니다.
   * 신규 래퍼 구조({ nextRepo, fonts })와 레거시 배열 구조([...]) 모두 호환합니다.
   */
  private parseCatalogJson(rawJson: string): CuratedFontCatalog {
    const parsed = JSON.parse(rawJson);

    // 1. 레거시 단일 배열 구조 호환 ([...])
    if (Array.isArray(parsed)) {
      return {
        fonts: (parsed as RawCuratedFontItem[]).map((raw) =>
          normalizeCuratedFontItem(raw)
        ),
        nextRepo: null,
      };
    }

    // 2. 신규 객체 래퍼 구조 ({ nextRepo, fonts })
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const rawFonts = Array.isArray(obj.fonts)
        ? (obj.fonts as RawCuratedFontItem[])
        : [];
      const fonts = rawFonts.map((raw) => normalizeCuratedFontItem(raw));
      const rawNextRepo =
        typeof obj.nextRepo === "string"
          ? obj.nextRepo
          : typeof obj.next_repo === "string"
            ? obj.next_repo
            : null;

      const trimmedNext = rawNextRepo ? rawNextRepo.trim() : null;
      return {
        fonts,
        nextRepo: trimmedNext && trimmedNext.length > 0 ? trimmedNext : null,
      };
    }

    return {
      fonts: [],
      nextRepo: null,
    };
  }


  /**
   * 엄선 무료 폰트 메타데이터를 비동기로 가져옵니다.
   * nextRepo 체인이 설정되어 있는 경우 다음 저장소까지 순차적으로 탐색하여 결합합니다.
   * @param forceRefresh 캐시를 무시하고 원격 서버에서 강제로 새로 가져올지 여부
   */
  public async getMetadata(forceRefresh = false): Promise<CuratedFontItem[]> {
    if (!forceRefresh && this.cachedFonts && this.cachedFonts.length > 0) {
      return this.cachedFonts;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    const startUrl = this.metadataUrl;

    this.fetchPromise = (async () => {
      try {
        const aggregatedFonts: CuratedFontItem[] = [];
        const seenFontIds = new Set<string>();
        const visitedUrls = new Set<string>();

        let currentUrl: string | null = startUrl;
        let depth = 0;

        while (currentUrl && depth < MAX_CATALOG_CHAIN_DEPTH) {
          const normalizedUrl = normalizeCuratedFontUrl(currentUrl);

          // 순환 참조 방지
          if (visitedUrls.has(normalizedUrl)) {
            console.warn(`[CuratedFontService] 순환 참조 감지, 탐색 중단: ${normalizedUrl}`);
            break;
          }
          visitedUrls.add(normalizedUrl);

          try {
            const rawJson = await this.fetchRawJson(normalizedUrl);
            const { fonts, nextRepo } = this.parseCatalogJson(rawJson);

            for (const item of fonts) {
              if (item && item.id && !seenFontIds.has(item.id)) {
                seenFontIds.add(item.id);
                aggregatedFonts.push(item);
              }
            }

            currentUrl = nextRepo ?? null;
          } catch (repoErr) {
            console.error(
              `[CuratedFontService] 저장소 메타데이터 로드 실패 (${normalizedUrl}):`,
              repoErr
            );
            // 이미 폰트를 일부라도 가져왔다면 우아하게 중단하고 기존 목록 유지
            if (aggregatedFonts.length > 0) {
              break;
            }
            throw repoErr;
          }

          depth++;
        }

        this.setCachedFonts(aggregatedFonts);

        if (typeof window !== "undefined" && aggregatedFonts.length > 0) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(aggregatedFonts));
          } catch {
            // 용량 초과 시 무시
          }
        }

        return aggregatedFonts;
      } catch (err) {
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
   * 원격 서버에서 메타데이터를 강제로 새로고침합니다.
   */
  public async refresh(): Promise<CuratedFontItem[]> {
    return this.getMetadata(true);
  }

  /**
   * ID로 폰트 메타데이터 조회
   */
  public getFontById(id: string): CuratedFontItem | undefined {
    return this.fontMap.get(id);
  }

  /**
   * ID로 CSS URL 조회
   */
  public getCssUrl(id: string): string | undefined {
    return this.fontMap.get(id)?.cssUrl;
  }

  /**
   * 캐시된 폰트 수
   */
  public getCachedCount(): number {
    return this.cachedFonts ? this.cachedFonts.length : 0;
  }

  /**
   * 언어 설정에 따른 폰트 표시명 동적 확인
   */
  public getDisplayName(item: CuratedFontItem, appLang?: string): string {
    const currentLang = appLang || i18n.language || "ko";
    return (
      getLocalizedText(item.metadata?.["Full Font Name"], currentLang) ||
      getLocalizedText(item.metadata?.["Font Family"], currentLang) ||
      item.name ||
      item.family
    );
  }

  /**
   * 언어 설정에 따른 디자이너/제작자명 동적 확인
   */
  public getDisplayAuthor(item: CuratedFontItem, appLang?: string): string {
    const currentLang = appLang || i18n.language || "ko";
    return (
      getLocalizedText(item.metadata?.["Designer"], currentLang) ||
      getLocalizedText(item.metadata?.["Manufacturer"], currentLang) ||
      item.author ||
      "Curated Font"
    );
  }

  /**
   * 공식 홈페이지 URL 열기 (경로가 없을 경우 구글 검색으로 폴백)
   */
  public async openHomepage(url?: string, fallbackFontName?: string): Promise<void> {
    const cleanUrl = url?.trim();
    if (cleanUrl) {
      await openExternalUrl(cleanUrl);
      return;
    }
    const query = `${fallbackFontName?.trim() || "무료"} 폰트`;
    await openExternalUrl(buildGoogleSearchUrl(query));
  }
}

export const curatedFontService = new CuratedFontService();

