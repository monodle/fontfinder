/**
 * OS 및 실행 환경 판별을 위한 유틸리티 모듈 (SSOT)
 */

interface NavigatorUAData {
  platform?: string;
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: NavigatorUAData;
}

function getPlatformString(): string {
  if (typeof navigator === "undefined") {
    return "";
  }

  const nav = navigator as NavigatorWithUAData;
  return nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
}

/**
 * 현재 실행 환경이 macOS(또는 Apple OS 계열)인지 여부를 반환합니다.
 */
export function isMac(): boolean {
  const platform = getPlatformString();
  return /Mac|iPhone|iPod|iPad/i.test(platform);
}

/**
 * 현재 실행 환경이 Windows인지 여부를 반환합니다.
 */
export function isWindows(): boolean {
  const platform = getPlatformString();
  return /Win/i.test(platform);
}

/**
 * 런타임 동안 불변인 플랫폼 판별 캐시 상수
 */
export const IS_MAC = isMac();
export const IS_WINDOWS = isWindows();
