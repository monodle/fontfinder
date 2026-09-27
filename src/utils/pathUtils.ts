/**
 * 경로 구분자 정규화 및 폴더 하위 경로 여부 안전 판별 유틸리티
 */

/**
 * 폴더 경로 끝에 경로 구분자(/)를 보장하도록 정규화합니다.
 */
function ensureTrailingSlash(path: string): string {
  if (path.endsWith("/") || path.endsWith("\\")) {
    return path;
  }
  return path.includes("\\") ? `${path}\\` : `${path}/`;
}

/**
 * filePath가 folderPath 자체이거나 해당 폴더의 하위에 위치하는지 안전하게 판별합니다.
 * 단순 startsWith로 인한 bbb와 bbb2 같은 접두사 오탐(Prefix Traversal Bug)을 방지합니다.
 */
export function isPathInFolder(filePath: string, folderPath: string): boolean {
  if (!filePath || !folderPath) return false;
  if (filePath === folderPath) return true;

  const normalizedFolder = ensureTrailingSlash(folderPath);
  return filePath.startsWith(normalizedFolder);
}
