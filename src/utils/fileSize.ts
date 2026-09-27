interface FormatFileSizeOptions {
  /** KB 단위 소수점 자릿수 (기본값: 0) */
  kbDecimals?: number;
  /** MB/GB 단위 소수점 자릿수 (기본값: 1) */
  decimals?: number;
}

const KILO_BYTE = 1024;
const MEGA_BYTE = 1024 * 1024;
const GIGA_BYTE = 1024 * 1024 * 1024;

/**
 * 파일 용량(바이트)을 단위(KB, MB, GB)에 맞게 포맷팅합니다.
 * 1MB 이상인 경우 MB로 표기합니다.
 */
export function formatFileSize(bytes: number, options: FormatFileSizeOptions = {}): string {
  const { kbDecimals = 0, decimals = 1 } = options;

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes >= GIGA_BYTE) {
    return `${(bytes / GIGA_BYTE).toFixed(decimals)} GB`;
  }

  if (bytes >= MEGA_BYTE) {
    return `${(bytes / MEGA_BYTE).toFixed(decimals)} MB`;
  }

  return `${(bytes / KILO_BYTE).toFixed(kbDecimals)} KB`;
}
