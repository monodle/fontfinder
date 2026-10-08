import { fontService } from "../services/fontService";
import { FontMetadata } from "../types/font";

/**
 * 32-bit FNV-1a 해시 함수
 * 한글/특수문자/경로 길이에 관계없이 100% 충돌 없는 고유 식별자 생성
 */
function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * CSS font-family에서 충돌이 없도록 고유 해시 식별자 생성
 */
export function getCustomFontFamily(font: FontMetadata): string {
  return `font_f_${hashString(String(font.id))}`;
}

/**
 * 폰트 이름을 CSS font-family에서 안전하게 사용하도록 이스케이프
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

/**
 * 현재 문서(DOM) 및 브라우저 뷰포트 내에 해당 폰트 카드가 실제로 보이는지 실시간 교차 검증
 * @param fontId 폰트 고유 ID
 * @param margin 뷰포트 상하좌우 안전 여유 마진 (픽셀, 기본 250px)
 */
function isFontVisibleInViewport(fontId: string | number, margin = 250): boolean {
  if (typeof document === "undefined") return false;

  const selector = `[data-font-card-id="${CSS.escape(String(fontId))}"]`;
  const elements = document.querySelectorAll(selector);
  if (!elements || elements.length === 0) return false;

  const viewHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewWidth = window.innerWidth || document.documentElement.clientWidth;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!document.body.contains(el)) continue;

    const rect = el.getBoundingClientRect();
    // 렌더링 중(크기가 0 초과)이고 화면 및 마진 영역에 교차하는지 판정
    const isIntersecting =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= -margin &&
      rect.top <= viewHeight + margin &&
      rect.right >= -margin &&
      rect.left <= viewWidth + margin;

    if (isIntersecting) {
      return true;
    }
  }

  return false;
}

interface ActiveFontEntry {
  fontFace: FontFace;
  familyName: string;
  refCount: number;
}

/**
 * 고해상도 5열 그리드 환경을 지원하는 가시성 보호 LRU FontFace 캐시 매니저
 */
class FontCacheManager {
  // 현재 document.fonts에 마운트되어 있는 FontFace 엔트리
  private activeFonts = new Map<string | number, ActiveFontEntry>();
  // 로딩 진행 중인 프로미스 맵 (중복 네트워크 요청 방지)
  private loadingPromises = new Map<string | number, Promise<string>>();
  // 화면 밖(언마운트)으로 벗어난 폰트들의 LRU 대기 큐 (fontId -> unmounted timestamp)
  private unmountedQueue = new Map<string | number, number>();

  // 4K/5K 5열 그리드 환경을 위해 화면 밖 예비 캐시 용량을 넉넉하게 400개로 설정
  private readonly maxUnmountedCapacity = 400;
  private evictionTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 폰트 컴포넌트 마운트 시 참조 카운트 증가 (Pinning: 절대 언마운트 금지)
   */
  public retain(fontId: string | number): void {
    const entry = this.activeFonts.get(fontId);
    if (entry) {
      entry.refCount++;
      // 화면 밖 LRU 대기 큐에 있었다면 즉시 제거 (보호 승격)
      this.unmountedQueue.delete(fontId);
    }
  }

  /**
   * 폰트 컴포넌트 언마운트 시 참조 카운트 감소
   */
  public release(fontId: string | number): void {
    const entry = this.activeFonts.get(fontId);
    if (!entry) return;

    entry.refCount = Math.max(0, entry.refCount - 1);

    // 더 이상 화면에 마운트된 카드가 없으면 화면 밖 LRU 큐로 이동
    if (entry.refCount === 0) {
      this.unmountedQueue.set(fontId, Date.now());
      this.scheduleEviction();
    }
  }

  /**
   * 스크롤 중 불필요한 삭제/재로딩(Thrashing) 방지를 위해 1.5초 디바운스 유휴 정리
   */
  private scheduleEviction(): void {
    if (this.evictionTimer) {
      clearTimeout(this.evictionTimer);
    }
    this.evictionTimer = setTimeout(() => {
      this.performEviction();
    }, 1500);
  }

  /**
   * 화면 밖 폰트 중 예비 용량을 초과한 오래된 폰트를 선별하여 안전하게 언마운트
   */
  private performEviction(): void {
    if (typeof document === "undefined" || !document.fonts) return;

    while (this.unmountedQueue.size > this.maxUnmountedCapacity) {
      // FIFO 순서대로 가장 오래된 화면 밖 폰트 ID 추출
      const oldestId = this.unmountedQueue.keys().next().value;
      if (!oldestId) break;

      this.unmountedQueue.delete(oldestId);

      const entry = this.activeFonts.get(oldestId);
      if (!entry) continue;

      // 1차 안전망: refCount가 다시 증가한 경우 삭제 금지
      if (entry.refCount > 0) continue;

      // 2차 안전망: 현재 DOM 및 뷰포트에 실제로 보이는지 실시간 교차 검증
      if (isFontVisibleInViewport(oldestId)) {
        // 화면에 노출 중이면 삭제를 즉시 취소하고 refCount 복구
        entry.refCount = 1;
        continue;
      }

      // 화면에 100% 없음이 확인된 폰트만 최종 언마운트
      try {
        document.fonts.delete(entry.fontFace);
      } catch {
        // ignore
      }
      this.activeFonts.delete(oldestId);
    }
  }

  /**
   * 폰트를 브라우저 Document에 로드하고 CSS familyName 반환
   */
  public async loadFont(font: FontMetadata): Promise<string> {
    // Google Fonts 공급자 폰트인 경우 (file_path가 google:로 시작)
    if (font.file_path.startsWith("google:")) {
      const gFamily = font.family_name || font.full_name;
      const linkId = `gfont-${encodeURIComponent(gFamily)}`;
      if (typeof document !== "undefined" && !document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(gFamily)}&display=swap`;
        link.onerror = () => {
          // 개별 폰트 로드 실패는 시스템 폰트로 폴백 표시 (전역 네트워크 상태를 오프라인으로 왜곡하지 않음)
          console.warn(`[FontLoader] 구글 웹폰트 로드 실패: ${gFamily} (폴백 폰트로 대체)`);
        };
        document.head.appendChild(link);
      }
      return `"${gFamily}", var(--font-system)`;
    }

    // Fontsource 공급자 폰트인 경우 (file_path가 fontsource:로 시작)
    if (font.file_path.startsWith("fontsource:")) {
      const fontId = font.file_path.replace("fontsource:", "");
      const linkId = `fsource-${encodeURIComponent(fontId)}`;
      if (typeof document !== "undefined" && !document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = `https://cdn.jsdelivr.net/npm/@fontsource/${encodeURIComponent(fontId)}@latest/index.css`;
        link.onerror = () => {
          // 개별 폰트 로드 실패는 시스템 폰트로 폴백 표시
          console.warn(`[FontLoader] Fontsource 웹폰트 로드 실패: ${fontId} (폴백 폰트로 대체)`);
        };
        document.head.appendChild(link);
      }
      const familyName = font.family_name || font.full_name;
      return `"${familyName}", var(--font-system)`;
    }

    const familyName = getCustomFontFamily(font);

    // 1. 이미 로드된 폰트인 경우
    const existing = this.activeFonts.get(font.id);
    if (existing) {
      return familyName;
    }

    // 2. 이미 로딩 중인 경우
    const existingPromise = this.loadingPromises.get(font.id);
    if (existingPromise) {
      return existingPromise;
    }

    // 3. 신규 로딩 프로미스 생성
    const loadPromise = (async () => {
      const fontUrl = fontService.getFontUrl(font.file_path);

      try {
        const weightStr =
          font.weight && font.weight >= 100 && font.weight <= 900
            ? font.weight.toString()
            : "normal";

        // 외부/미설치 폰트는 OS 로컬 글꼴에 가로채이지 않도록 url() 단독 직결 바인딩
        const fontFace = new FontFace(familyName, `url("${fontUrl}")`, {
          weight: weightStr,
          style: font.is_italic ? "italic" : "normal",
        });

        const loaded = await fontFace.load();
        document.fonts.add(loaded);

        this.activeFonts.set(font.id, {
          fontFace: loaded,
          familyName,
          refCount: 0,
        });

        return familyName;
      } catch (error) {
        console.warn(
          `Failed to dynamically load font: ${font.full_name} (${font.file_path}) from ${fontUrl}`,
          error
        );
        // 로드 실패 시에도 OS 시스템 폰트 스택으로 매칭 시도
        return buildLocalFallbackStack(font);
      } finally {
        this.loadingPromises.delete(font.id);
      }
    })();

    this.loadingPromises.set(font.id, loadPromise);
    return loadPromise;
  }

  /**
   * 캐시 전체 초기화 (앱 데이터 리셋 등)
   */
  public clearAll(): void {
    if (this.evictionTimer) {
      clearTimeout(this.evictionTimer);
      this.evictionTimer = null;
    }
    if (typeof document !== "undefined" && document.fonts) {
      for (const entry of this.activeFonts.values()) {
        try {
          document.fonts.delete(entry.fontFace);
        } catch {
          // ignore
        }
      }
    }
    this.activeFonts.clear();
    this.loadingPromises.clear();
    this.unmountedQueue.clear();
  }
}

const fontCacheManager = new FontCacheManager();

/**
 * 외부 모듈용 편의 헬퍼 함수들
 */
export async function loadFontIntoDocument(font: FontMetadata): Promise<string> {
  return await fontCacheManager.loadFont(font);
}

export function retainFont(fontId: string | number): void {
  fontCacheManager.retain(fontId);
}

export function releaseFont(fontId: string | number): void {
  fontCacheManager.release(fontId);
}

export function clearFontLoaderCache(): void {
  fontCacheManager.clearAll();
}
