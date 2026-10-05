import { BatchInstallResult, BatchUninstallResult } from "../services/fontService";

type TranslateFn = (key: string, options?: any) => string;

/**
 * 대량 파일 작업 에러 목록을 분석하여 가장 직관적인 실패 원인 요약 문구를 도출합니다.
 */
export function summarizeBatchErrors(errors: string[], t: TranslateFn): string {
  if (!errors || errors.length === 0) {
    return t("toast.error_reason_processing", { defaultValue: "처리 중 오류 발생" });
  }

  let hasInUse = false;
  let hasPermission = false;
  let hasCorrupted = false;
  let hasNotFound = false;
  let otherCount = 0;

  for (const err of errors) {
    const lower = err.toLowerCase();
    if (
      lower.includes("사용 중") ||
      lower.includes("in use") ||
      lower.includes("sharing_violation") ||
      lower.includes("잠겨") ||
      lower.includes("locked")
    ) {
      hasInUse = true;
    } else if (
      lower.includes("권한") ||
      lower.includes("access_denied") ||
      lower.includes("permission")
    ) {
      hasPermission = true;
    } else if (
      lower.includes("손상") ||
      lower.includes("invalid") ||
      lower.includes("corrupt") ||
      lower.includes("format")
    ) {
      hasCorrupted = true;
    } else if (
      lower.includes("not found") ||
      lower.includes("찾을 수 없") ||
      lower.includes("존재하지 않")
    ) {
      hasNotFound = true;
    } else {
      otherCount++;
    }
  }

  const detectedReasons: string[] = [];
  if (hasInUse) {
    detectedReasons.push(t("toast.error_reason_in_use", { defaultValue: "다른 프로그램에서 사용 중" }));
  }
  if (hasPermission) {
    detectedReasons.push(t("toast.error_reason_permission", { defaultValue: "쓰기 권한 부족" }));
  }
  if (hasCorrupted) {
    detectedReasons.push(t("toast.error_reason_corrupted", { defaultValue: "지원하지 않거나 손상된 서체" }));
  }
  if (hasNotFound) {
    detectedReasons.push(t("toast.error_reason_not_found", { defaultValue: "파일을 찾을 수 없음" }));
  }

  if (detectedReasons.length === 1 && otherCount === 0) {
    return detectedReasons[0];
  } else if (detectedReasons.length > 1) {
    return t("toast.error_reason_multiple", { defaultValue: "복합 원인" });
  }

  return t("toast.error_reason_processing", { defaultValue: "처리 중 오류 발생" });
}

/**
 * 대량 설치 결과에 따른 사용자 친화적 우상단 토스트 피드백 문구를 생성합니다.
 */
export function formatBatchInstallFeedback(result: BatchInstallResult, t: TranslateFn): string {
  const successCount = result.installed.length;
  const failedCount = result.failed_count;

  if (failedCount === 0) {
    return t("toast.bulk_installed", { count: successCount });
  }

  const reason = summarizeBatchErrors(result.errors, t);
  return `${successCount}개 설치 완료 / ${failedCount}개 실패 (${reason})`;
}

/**
 * 대량 제거 결과에 따른 사용자 친화적 우상단 토스트 피드백 문구를 생성합니다.
 */
export function formatBatchUninstallFeedback(result: BatchUninstallResult, t: TranslateFn): string {
  const successCount = result.deleted_count;
  const failedCount = result.failed_count;

  if (failedCount === 0) {
    return t("toast.bulk_uninstalled", { count: successCount });
  }

  const reason = summarizeBatchErrors(result.errors, t);
  return `${successCount}개 제거 완료 / ${failedCount}개 실패 (${reason})`;
}
