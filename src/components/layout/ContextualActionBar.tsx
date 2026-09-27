import { useTranslation } from "react-i18next";
import { X, CheckSquare, Zap, ZapOff, Download, Trash2, Split } from "lucide-react";
import { ViewModeControl } from "../ViewModeControl";
import { GridColumnsSelector } from "../GridColumnsSelector";

export interface ContextualActionBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  canActivate: boolean;
  onActivate: () => void;
  canDeactivate: boolean;
  onDeactivate: () => void;
  canInstall: boolean;
  onInstall: () => void;
  canRemoveFromSet?: boolean;
  onRemoveFromSet?: () => void;
  onOpenDiff?: () => void;
  viewMode?: "list" | "grid";
  onViewModeChange?: (mode: "list" | "grid") => void;
  gridColumns?: number;
  onGridColumnsChange?: (columns: number) => void;
}

export function ContextualActionBar({
  selectedCount,
  onSelectAll,
  onClearSelection,
  canActivate,
  onActivate,
  canDeactivate,
  onDeactivate,
  canInstall,
  onInstall,
  canRemoveFromSet,
  onRemoveFromSet,
  onOpenDiff,
  viewMode,
  onViewModeChange,
  gridColumns,
  onGridColumnsChange,
}: ContextualActionBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div className="w-full h-full flex items-center justify-between gap-2.5 px-4 animate-in fade-in slide-in-from-top-0.5 duration-200 select-none">
      {/* 1. 좌측 그룹: 선택 취소(X), 선택 카운트 배지, 전체 선택 */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1.5 rounded-lg text-theme-text-secondary hover:text-theme-text bg-theme-card/80 hover:bg-theme-card border border-theme-border/80 hover:border-theme-accent transition-colors cursor-pointer shadow-2xs"
          title={`${t("action_bar.clear_selection")} (Esc)`}
          aria-label={t("action_bar.clear_selection")}
        >
          <X className="w-4 h-4" />
        </button>

        {/* 눈에 확 띄는 솔리드 액센트 선택 개수 배지 */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-accent text-theme-accent-text shadow-xs">
          <span className="w-2 h-2 rounded-full bg-white dark:bg-amber-100 animate-pulse" />
          <span className="text-xs font-bold whitespace-nowrap">
            {t("action_bar.selected_count", { count: selectedCount })}
          </span>
        </div>

        <button
          type="button"
          onClick={onSelectAll}
          className="px-2.5 py-1.5 rounded-lg bg-theme-card hover:bg-theme-card-hover border border-theme-border/80 hover:border-theme-accent/50 transition-colors text-xs font-semibold text-theme-text cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
          title="Cmd/Ctrl + A"
        >
          <CheckSquare className="w-3.5 h-3.5 text-theme-accent" />
          <span className="hidden sm:inline">{t("action_bar.select_all")}</span>
        </button>
      </div>

      {/* 2. 중앙 그룹: 일괄 액션 버튼 (활성화, 비활성화, 설치, 서재 제거) */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
        {canActivate && (
          <button
            type="button"
            onClick={onActivate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-card hover:bg-theme-card-hover border border-theme-border/80 hover:border-theme-accent text-theme-text transition-all text-xs font-semibold cursor-pointer shadow-2xs shrink-0"
            title={t("action_bar.activate")}
          >
            <Zap className="w-3.5 h-3.5 text-theme-accent fill-theme-accent/20" />
            <span className="hidden md:inline">{t("action_bar.activate")}</span>
          </button>
        )}

        {canDeactivate && (
          <button
            type="button"
            onClick={onDeactivate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-card hover:bg-theme-card-hover border border-theme-border/80 hover:border-amber-500 text-theme-text transition-all text-xs font-semibold cursor-pointer shadow-2xs shrink-0"
            title={t("action_bar.deactivate")}
          >
            <ZapOff className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">{t("action_bar.deactivate")}</span>
          </button>
        )}

        {canInstall && (
          <button
            type="button"
            onClick={onInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text border border-theme-accent transition-all text-xs font-semibold cursor-pointer shadow-xs shrink-0"
            title={t("action_bar.install")}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t("action_bar.install")}</span>
          </button>
        )}

        {canRemoveFromSet && onRemoveFromSet && (
          <button
            type="button"
            onClick={onRemoveFromSet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/40 transition-all text-xs font-semibold cursor-pointer shadow-2xs shrink-0"
            title={t("action_bar.remove_from_set", "서재에서 제거")}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t("action_bar.remove_from_set", "서재에서 제거")}</span>
          </button>
        )}

        {onOpenDiff && (
          <button
            type="button"
            onClick={onOpenDiff}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-accent/15 hover:bg-theme-accent/25 text-theme-accent border border-theme-accent/40 transition-all text-xs font-semibold cursor-pointer shadow-2xs shrink-0"
            title="전문가용 글리프 Diff 비교"
          >
            <Split className="w-3.5 h-3.5" />
            <span>{selectedCount > 5 ? "Diff" : `Diff (${selectedCount})`}</span>
          </button>
        )}
      </div>

      {/* 3. 우측 그룹: 추가 안내 힌트, 뷰 모드 조절기(화면 여유 시), 선택 해제 버튼 */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[11px] text-theme-text-muted hidden xl:inline font-medium">
          {t("action_bar.right_click_hint")}
        </span>

        {viewMode && onViewModeChange && (
          <div className="hidden lg:flex items-center gap-1.5 border-l border-theme-border/80 pl-2.5">
            <ViewModeControl
              viewMode={viewMode}
              onChange={onViewModeChange}
              variant="icon"
            />
            {gridColumns && onGridColumnsChange && (
              <GridColumnsSelector
                columns={gridColumns}
                onChange={(cols) => {
                  onGridColumnsChange(cols);
                  if (viewMode !== "grid") {
                    onViewModeChange("grid");
                  }
                }}
                variant="dropdown"
              />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClearSelection}
          className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg bg-theme-card hover:bg-theme-hover border border-theme-border/80 hover:border-theme-accent/50 text-xs font-semibold text-theme-text-secondary hover:text-theme-text transition-colors cursor-pointer shadow-2xs"
        >
          {t("action_bar.clear_selection")}
        </button>
      </div>
    </div>
  );
}
