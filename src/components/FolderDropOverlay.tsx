import React from "react";
import { useTranslation } from "react-i18next";
import { FolderDown, FolderPlus, Sparkles } from "lucide-react";

interface FolderDropOverlayProps {
  isVisible: boolean;
}

export const FolderDropOverlay: React.FC<FolderDropOverlayProps> = ({ isVisible }) => {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-6 animate-in fade-in duration-200"
      aria-hidden="true"
    >
      {/* 백그라운드 블러 및 오버레이 */}
      <div className="absolute inset-0 bg-theme-bg/80 backdrop-blur-md transition-opacity" />

      {/* 액센트 글로우 효과 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-theme-accent/20 rounded-full blur-3xl pointer-events-none" />

      {/* 대시 테두리 드랍 영역 카드 */}
      <div className="relative w-full h-full max-w-4xl max-h-[80vh] border-2 border-dashed border-theme-accent/60 bg-theme-card/60 backdrop-blur-xl rounded-3xl flex flex-col items-center justify-center p-8 text-center shadow-2xl transition-all scale-100 animate-in zoom-in-95 duration-200">
        {/* 중앙 인터랙티브 아이콘 */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-theme-accent/15 border border-theme-accent/30 flex items-center justify-center text-theme-accent shadow-inner animate-pulse">
            <FolderDown className="w-12 h-12 stroke-[1.75]" />
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-theme-accent text-white flex items-center justify-center shadow-md">
            <FolderPlus className="w-4 h-4" />
          </div>
        </div>

        {/* 텍스트 가이드 */}
        <h2 className="text-xl md:text-2xl font-bold text-theme-text tracking-tight mb-2 flex items-center gap-2">
          <span>{t("dropzone.title", "폴더를 놓아 서재에 추가")}</span>
          <Sparkles className="w-5 h-5 text-theme-accent inline-block animate-bounce" />
        </h2>

        <p className="text-sm text-theme-text-secondary max-w-md leading-relaxed mb-6">
          {t(
            "dropzone.desc",
            "탐색기나 파인더에서 드래그한 폴더를 여기에 놓으면, 포함된 폰트를 자동으로 색인하고 실시간 감시합니다."
          )}
        </p>

        {/* 지원 포맷 칩 */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-theme-text-muted font-mono">
          <span className="px-2.5 py-1 rounded-md bg-theme-hover border border-theme-border/60">
            .TTF
          </span>
          <span className="px-2.5 py-1 rounded-md bg-theme-hover border border-theme-border/60">
            .OTF
          </span>
          <span className="px-2.5 py-1 rounded-md bg-theme-hover border border-theme-border/60">
            .WOFF
          </span>
          <span className="px-2.5 py-1 rounded-md bg-theme-hover border border-theme-border/60">
            .WOFF2
          </span>
          <span className="px-2.5 py-1 rounded-md bg-theme-hover border border-theme-border/60">
            .TTC
          </span>
        </div>
      </div>
    </div>
  );
};
