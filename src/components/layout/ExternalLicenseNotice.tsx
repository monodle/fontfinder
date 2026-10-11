import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Info, X } from "lucide-react";
import { cn } from "../../utils/cn";

export interface ExternalLicenseNoticeProps {
  activeCategory: string;
  className?: string;
}

const EXTERNAL_CATEGORIES = new Set<string>([
  "curated_fonts",
  "google_fonts",
  "fontsource",
]);

const AUTO_DISMISS_DELAY_MS = 5000;
const HOVER_LEAVE_DELAY_MS = 2500;

export function ExternalLicenseNotice({
  activeCategory,
  className = "",
}: ExternalLicenseNoticeProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((delayMs: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, delayMs);
  }, [clearTimer]);

  useEffect(() => {
    if (!EXTERNAL_CATEGORIES.has(activeCategory)) {
      clearTimer();
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    startTimer(AUTO_DISMISS_DELAY_MS);

    return () => {
      clearTimer();
    };
  }, [activeCategory, startTimer, clearTimer]);

  const handleMouseEnter = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    startTimer(HOVER_LEAVE_DELAY_MS);
  }, [startTimer]);

  const handleClose = useCallback(() => {
    clearTimer();
    setIsVisible(false);
  }, [clearTimer]);

  if (!isVisible) {
    return null;
  }

  const noticeMessage = t(
    "common.external_license_disclaimer",
    "본 서비스는 공식 배포처 이동 링크만 제공합니다. 라이선스 범위는 제작사 정책에 따라 수시로 변경될 수 있으므로, 다운로드 전 공식 페이지의 최신 라이선스 약관을 반드시 확인하세요."
  );

  return (
    <aside
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "absolute bottom-5 left-1/2 -translate-x-1/2 z-40",
        "w-[calc(100%-2.5rem)] max-w-2xl px-4 py-3 rounded-xl",
        "bg-theme-card/95 text-theme-text",
        "border border-theme-border shadow-xl backdrop-blur-md",
        "flex items-center gap-3 select-none",
        "animate-in fade-in slide-in-from-bottom-3 duration-200",
        className
      )}
    >
      <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500">
        <Info className="w-4 h-4" />
      </div>

      <p className="flex-1 min-w-0 text-xs text-theme-text font-semibold leading-relaxed break-keep">
        {noticeMessage}
      </p>

      <button
        type="button"
        onClick={handleClose}
        className="shrink-0 p-1 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
        aria-label={t("common.close", "닫기")}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
}
