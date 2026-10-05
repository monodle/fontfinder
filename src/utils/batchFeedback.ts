import { BatchInstallResult, BatchUninstallResult } from "../services/fontService";

type TranslateFn = (key: string, options?: any) => string;

/**
 * 대량 파일 작업 에러 목록을 분석하여 가장 직관적인 실패 원인 요약 문구를 도출합니다.
 */
function summarizeBatchErrors(errors: string[], t: TranslateFn): string {
  if (!errors || errors.length === 0) {
    return t("toast.error_reason_processing");
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
    detectedReasons.push(t("toast.error_reason_in_use"));
  }
  if (hasPermission) {
    detectedReasons.push(t("toast.error_reason_permission"));
  }
  if (hasCorrupted) {
    detectedReasons.push(t("toast.error_reason_corrupted"));
  }
  if (hasNotFound) {
    detectedReasons.push(t("toast.error_reason_not_found"));
  }

  if (detectedReasons.length === 1 && otherCount === 0) {
    return detectedReasons[0];
  } else if (detectedReasons.length > 1) {
    return t("toast.error_reason_multiple");
  }

  return t("toast.error_reason_processing");
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
  return t("toast.bulk_installed_partial", {
    success: successCount,
    failed: failedCount,
    reason,
  });
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
  return t("toast.bulk_uninstalled_partial", {
    success: successCount,
    failed: failedCount,
    reason,
  });
}

/**
 * 단일 작업 에러 메시지를 분석하여 현재 언어에 적합한 로컬라이즈된 에러 문구를 반환합니다.
 */
export function formatErrorMessage(err: unknown, t: TranslateFn): string {
  if (!err) {
    return t("toast.error_reason_processing");
  }

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("woff") ||
    lower.includes("웹 전용") ||
    lower.includes("web-only")
  ) {
    return t("toast.woff_activate_unsupported");
  }

  if (
    lower.includes("사용 중") ||
    lower.includes("in use") ||
    lower.includes("sharing_violation") ||
    lower.includes("잠겨") ||
    lower.includes("locked")
  ) {
    return t("toast.error_reason_in_use");
  }

  if (
    lower.includes("권한") ||
    lower.includes("access_denied") ||
    lower.includes("permission")
  ) {
    return t("toast.error_reason_permission");
  }

  if (
    lower.includes("손상") ||
    lower.includes("invalid") ||
    lower.includes("corrupt") ||
    lower.includes("format")
  ) {
    return t("toast.error_reason_corrupted");
  }

  if (
    lower.includes("not found") ||
    lower.includes("찾을 수 없") ||
    lower.includes("존재하지 않")
  ) {
    return t("toast.error_reason_not_found");
  }

  return message.replace(/^Error:\s*/i, "");
}
