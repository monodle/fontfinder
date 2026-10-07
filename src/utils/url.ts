import { invoke } from "@tauri-apps/api/core";
import { webUrlSchema } from "../schemas";

/**
 * URL의 구문 및 프로토콜 안전성을 검증합니다.
 * @param url 검증할 URL 문자열
 * @returns 정규화된 URL 문자열 또는 검증 실패 시 null
 */
export function validateWebUrl(url: unknown): string | null {
  const result = webUrlSchema.safeParse(url);
  if (!result.success) {
    if (typeof url === "string" && url.trim().length > 0) {
      console.warn("[url] 유효하지 않거나 허용되지 않은 프로토콜입니다:", url);
    }
    return null;
  }
  return result.data;
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

