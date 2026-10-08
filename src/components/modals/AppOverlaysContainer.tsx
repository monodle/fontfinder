import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { appConfig } from "../../config/appConfig";
import { ProgressBar, Toast, ToastVariant } from "../common";
import { FolderDropOverlay } from "../font-list/FolderDropOverlay";

interface AppOverlaysContainerProps {
  isLoading: boolean;
  hasNoFonts: boolean;
  isOnboardingOpen: boolean;
  isDiffModalOpen: boolean;
  scanProgress: { current: number; total: number } | null;
  isDraggingOver: boolean;
  toastInfo: { message: string; variant?: ToastVariant } | null;
  onCloseToast: () => void;
}

export function AppOverlaysContainer({
  isLoading,
  hasNoFonts,
  isOnboardingOpen,
  isDiffModalOpen,
  scanProgress,
  isDraggingOver,
  toastInfo,
  onCloseToast,
}: AppOverlaysContainerProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* 1. 전체 화면 스캔 진행률 블러 오버레이 */}
      {isLoading && hasNoFonts && !isOnboardingOpen && (
        <div className="fixed inset-0 z-40 bg-theme-bg/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
          <div className="max-w-md w-full p-8 rounded-3xl bg-theme-card/90 border border-theme-border/80 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-theme-accent/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-theme-accent/10 rounded-full blur-2xl pointer-events-none" />

            <div className="w-14 h-14 rounded-2xl bg-theme-accent-subtle/70 border border-theme-accent/30 flex items-center justify-center mb-5 text-theme-accent shadow-inner">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>

            <h3 className="text-base font-semibold text-theme-text tracking-tight mb-1.5">
              {t("empty.scanning")}
            </h3>
            <p className="text-xs text-theme-text-muted leading-relaxed mb-6 max-w-xs">
              {t("empty.scanning_desc")}
            </p>

            <ProgressBar
              value={scanProgress?.current ?? 0}
              max={scanProgress?.total ?? 100}
              size="md"
              showLabel
              label={
                scanProgress && scanProgress.total > 0
                  ? `${scanProgress.current.toLocaleString()} / ${scanProgress.total.toLocaleString()}${t("common.count_unit")}`
                  : t("common.loading")
              }
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* 2. 폴더 드래그앤드롭 전체 화면 오버레이 */}
      <FolderDropOverlay isVisible={isDraggingOver && !isDiffModalOpen} />

      {/* 3. 토스트 알림 */}
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          variant={toastInfo.variant}
          duration={appConfig.ui.toastDurationMs}
          onClose={onCloseToast}
        />
      )}
    </>
  );
}
