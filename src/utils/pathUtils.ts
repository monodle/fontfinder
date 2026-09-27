/**
 * 경로 구분자 정규화 및 폴더 하위 경로 여부 안전 판별 유틸리티
 */

/**
 * 경로 구분자를 슬래시(/)로 통일하고 끝 슬래시를 제거하여 정규화합니다.
 */
export function normalizePath(path: string): string {
  if (!path) return "";
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * filePath가 folderPath 자체이거나 해당 폴더의 하위에 위치하는지 안전하게 판별합니다.
 * - 슬래시(/)와 백슬래시(\) 통일 정규화
 * - Windows 등 대소문자 비구분 파일 시스템 지원 (case-insensitive)
 * - bbb vs bbb2 접두사 오탐(Prefix Traversal Bug) 방지 (/ 경계 검사)
 */
export function isPathInFolder(filePath: string, folderPath: string): boolean {
  if (!filePath || !folderPath) return false;

  const normFile = normalizePath(filePath).toLowerCase();
  const normFolder = normalizePath(folderPath).toLowerCase();

  if (normFile === normFolder) return true;
  return normFile.startsWith(`${normFolder}/`);
}
