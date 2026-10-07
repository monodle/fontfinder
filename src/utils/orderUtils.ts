import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import { fractionalIndexKeySchema } from "../schemas";

/**
 * 안전한 Fractional Index 키 계산 함수
 * - null, undefined, 빈 문자열(""), 비-ASCII 문자열을 Zod 스키마로 방어적으로 정제
 * - 유효하지 않은 키 입력 시 예외를 포획하여 안정적인 대체 키 반환
 */
export function calculateOrderBetween(
  prevKey?: string | null,
  nextKey?: string | null
): string {
  const a = fractionalIndexKeySchema.parse(prevKey);
  const b = fractionalIndexKeySchema.parse(nextKey);

  try {
    return generateKeyBetween(a, b);
  } catch (err) {
    console.warn("calculateOrderBetween fallback used:", err, { prevKey, nextKey });
    if (!a && !b) return "a0";
    if (a && !b) return `${a}z`;
    if (!a && b) return "Zz";
    return `${a}V`;
  }
}

/**
 * N개의 초기 아이템에 대한 순차적 Fractional Index 키 목록 생성
 */
export function generateInitialOrderKeys(count: number): string[] {
  if (count <= 0) return [];
  try {
    return generateNKeysBetween(null, null, count);
  } catch {
    return Array.from({ length: count }, (_, idx) => `a${idx}`);
  }
}
