import { generateKeyBetween } from "fractional-indexing";
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
