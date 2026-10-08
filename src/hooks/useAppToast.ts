import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ToastVariant } from "../components/common/Toast";

export function useAppToast() {
  const { t } = useTranslation();
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    variant?: ToastVariant;
  } | null>(null);

  // 현재 언어 리소스(toast.error_keywords)로부터 에러 키워드를 동적 로드하여 정규식 생성
  const errorKeywords = t("toast.error_keywords", "failed,error");
  const errorRegex = useMemo(() => {
    const keywords = errorKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const combined = Array.from(new Set([...keywords, "failed", "error"]));
    const escaped = combined.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(escaped.join("|"), "i");
  }, [errorKeywords]);

  const showToast = useCallback(
    (msg: string | { message: string; variant?: ToastVariant }) => {
      if (typeof msg === "string") {
        const isError = errorRegex.test(msg);
        setToastInfo({ message: msg, variant: isError ? "error" : "success" });
      } else {
        setToastInfo(msg);
      }
    },
    [errorRegex]
  );

  return {
    toastInfo,
    setToastInfo,
    showToast,
  };
}
