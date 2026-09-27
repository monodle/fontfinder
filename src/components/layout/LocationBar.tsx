import { useTranslation } from "react-i18next";
import {
  Folder,
  ChevronRight,
  Copy,
  FolderOpen,
  AlertTriangle,
  FolderSync,
  Tag,
  Type,
  Sparkles,
  User,
  Zap,
  Heart,
} from "lucide-react";
import { CustomFolder, FontSet } from "../../types/font";

interface LocationBarProps {
  activeCategory: string;
  customFolders: CustomFolder[];
  sets: FontSet[];
  fontsCount: number;
  selectedCount?: number;
  onOpenFolder: (path: string) => void;
  onRelinkFolder?: (path: string) => void;
}

export function LocationBar({
  activeCategory,
  customFolders,
  sets,
  fontsCount,
  selectedCount = 0,
  onOpenFolder,
  onRelinkFolder,
}: LocationBarProps) {
  const { t } = useTranslation();

  const renderFontCount = () => {
    if (selectedCount > 0) {
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="font-semibold text-theme-accent">
            {t("action_bar.selected_count", {
              count: selectedCount,
              defaultValue: `${selectedCount}개 글꼴 선택됨`,
            })}
          </span>
          <span className="text-theme-text-muted">
            / {fontsCount} {t("common.fonts", { defaultValue: "글꼴" })}
          </span>
        </div>
      );
    }

    return (
      <span className="text-[11px] text-theme-text-muted font-mono">
        {fontsCount} {t("common.fonts", { defaultValue: "글꼴" })}
      </span>
    );
  };

  // 1. 감시 폴더인 경우
  if (activeCategory.startsWith("folder:")) {
    const folderPath = activeCategory.replace("folder:", "");
    const folder = customFolders.find((f) => f.path === folderPath);
    const folderName = folder?.name || folderPath.split(/[\\/]/).pop() || folderPath;
    const folderColor = folder?.color || "#0ea5e9";
    const isMissing = folder?.isMissing;

    return (
      <div className="h-9 px-4 bg-theme-surface/70 border-b border-theme-border flex items-center justify-between gap-3 text-xs shrink-0 select-none backdrop-blur-xs transition-colors">
        {/* 좌측: 폴더 정보 및 순수 텍스트 경로 */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              style={{ backgroundColor: folderColor }}
              className="w-2.5 h-2.5 rounded-full ring-1 ring-theme-surface shadow-2xs"
            />
            <Folder className="w-3.5 h-3.5 text-theme-text-secondary" />
            <span className="font-semibold text-theme-text truncate max-w-[140px] sm:max-w-[200px]">
              {folderName}
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />

          {/* 전체 경로: 텍스트 박스 없이 자연스러운 텍스트로 노출 */}
          <span
            className="font-mono text-[11px] text-theme-text-muted hover:text-theme-text transition-colors truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-xl select-all"
            title={folderPath}
          >
            {folderPath}
          </span>

          {/* 파일 탐색기 열기 버튼 */}
          <button
            type="button"
            onClick={() => onOpenFolder(folderPath)}
            className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer font-medium text-[11px]"
            title={t("context_menu.show_in_folder", { defaultValue: "탐색기에서 파일 보기" })}
          >
            <FolderOpen className="w-3.5 h-3.5 text-theme-accent" />
            <span className="hidden sm:inline">
              {t("context_menu.show_in_folder", { defaultValue: "탐색기에서 보기" })}
            </span>
          </button>
        </div>

        {/* 우측: 누락 경고 및 글꼴 수량 */}
        <div className="flex items-center gap-2 shrink-0">
          {isMissing ? (
            <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-500/20">
              <AlertTriangle className="w-3 h-3" />
              <span>{t("folder.missing_label", { defaultValue: "폴더 위치 누락됨" })}</span>
              {onRelinkFolder && (
                <button
                  type="button"
                  onClick={() => onRelinkFolder(folderPath)}
                  className="ml-1 hover:underline flex items-center gap-0.5 cursor-pointer text-amber-500 hover:text-amber-400 font-semibold"
                  title={t("folder.relink", { defaultValue: "폴더 위치 재연결" })}
                >
                  <FolderSync className="w-3 h-3" />
                  <span>{t("folder.relink_short", { defaultValue: "재연결" })}</span>
                </button>
              )}
            </div>
          ) : (
            renderFontCount()
          )}
        </div>
      </div>
    );
  }

  // 2. 세트(컬렉션)인 경우
  if (activeCategory.startsWith("set:")) {
    const setId = Number(activeCategory.replace("set:", ""));
    const set = sets.find((s) => s.id === setId);
    const setName = set?.name || t("sidebar.set", { defaultValue: "세트" });
    const setColor = set?.color || "#8b5cf6";

    return (
      <div className="h-9 px-4 bg-theme-surface/70 border-b border-theme-border flex items-center justify-between gap-3 text-xs shrink-0 select-none backdrop-blur-xs transition-colors">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              style={{ backgroundColor: setColor }}
              className="w-2.5 h-2.5 rounded-full ring-1 ring-theme-surface shadow-2xs"
            />
            <Tag className="w-3.5 h-3.5 text-theme-text-secondary" />
            <span className="font-semibold text-theme-text truncate max-w-[200px]">
              {setName}
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
          <span className="text-[11px] text-theme-text-muted truncate">
            {t("sidebar.custom_set_desc", { defaultValue: "사용자 지정 세트 컬렉션" })}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {renderFontCount()}
        </div>
      </div>
    );
  }

  // 3. 기본 카테고리 (all, system, user, activated, favorites, duplicates)
  let icon = <Type className="w-3.5 h-3.5 text-theme-accent" />;
  let title = t("sidebar.category_all");
  let description = t("sidebar.all_desc", { defaultValue: "등록된 모든 글꼴" });

  if (activeCategory === "system") {
    icon = <Sparkles className="w-3.5 h-3.5 text-theme-accent" />;
    title = t("sidebar.category_system");
    description = t("sidebar.system_desc", { defaultValue: "운영체제 시스템 글꼴" });
  } else if (activeCategory === "user") {
    icon = <User className="w-3.5 h-3.5 text-emerald-500" />;
    title = t("sidebar.category_user");
    description = t("sidebar.user_desc", { defaultValue: "사용자 설치 글꼴" });
  } else if (activeCategory === "activated") {
    icon = <Zap className="w-3.5 h-3.5 text-amber-500" />;
    title = t("sidebar.category_activated");
    description = t("sidebar.activated_desc", { defaultValue: "현재 임시 활성화된 글꼴" });
  } else if (activeCategory === "favorites") {
    icon = <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />;
    title = t("sidebar.category_favorites");
    description = t("sidebar.favorites_desc", { defaultValue: "즐겨찾기 보관 글꼴" });
  } else if (activeCategory === "duplicates") {
    icon = <Copy className="w-3.5 h-3.5 text-rose-500" />;
    title = t("sidebar.category_duplicates");
    description = t("sidebar.duplicates_desc", { defaultValue: "중복 감지된 글꼴" });
  }

  return (
    <div className="h-9 px-4 bg-theme-surface/70 border-b border-theme-border flex items-center justify-between gap-3 text-xs shrink-0 select-none backdrop-blur-xs transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 shrink-0">
          {icon}
          <span className="font-semibold text-theme-text truncate">
            {title}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
        <span className="text-[11px] text-theme-text-muted truncate">
          {description}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {renderFontCount()}
      </div>
    </div>
  );
}
