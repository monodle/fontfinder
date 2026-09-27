import { twMerge, type ClassNameValue } from "tailwind-merge";

/**
 * Tailwind CSS 클래스를 병합하고 우선순위 충돌을 방지하는 유틸리티 함수
 */
export function cn(...inputs: ClassNameValue[]): string {
  return twMerge(inputs);
}
