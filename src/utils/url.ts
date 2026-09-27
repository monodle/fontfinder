import { invoke } from "@tauri-apps/api/core";

/**
 * 안전한 웹 브라우징을 위한 허용 프로토콜
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * URL의 구문 및 프로토콜 안전성을 검증합니다.
 * @param url 검증할 URL 문자열
 * @returns 정규화된 URL 문자열 또는 검증 실패 시 null
 */
export function validateWebUrl(url: string): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    // http, https 프로토콜만 허용 (javascript:, file:, data: 등 잠재적 위험 스킴 차단)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      console.warn("[url] 허용되지 않은 프로토콜입니다:", parsed.protocol);
      return null;
    }

    // 유효한 호스트명이 존재하는지 확인
    if (!parsed.hostname || parsed.hostname.trim().length === 0) {
      console.warn("[url] 유효하지 않은 호스트명입니다:", parsed.hostname);
      return null;
    }

    return parsed.href;
  } catch {
    console.warn("[url] 올바르지 않은 URL 형식입니다:", trimmed);
    return null;
  }
}

/**
 * 외부 URL을 기본 웹 브라우저에서 안전하게 엽니다.
 * 백엔드 Rust 커맨드를 우선 사용하며, 실패 시 브라우저 기본 window.open으로 안전하게 폴백합니다.
 */
export async function openExternalUrl(url: string): Promise<void> {
  const validatedUrl = validateWebUrl(url);
  if (!validatedUrl) {
    return;
  }

  try {
    await invoke("open_external_url", { url: validatedUrl });
  } catch (error) {
    console.warn("[url] Tauri open_external_url failed, fallback to window.open:", error);
    try {
      window.open(validatedUrl, "_blank", "noopener,noreferrer");
    } catch (fallbackError) {
      console.error("[url] Fallback window.open also failed:", fallbackError);
    }
  }
}

