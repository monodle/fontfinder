import { useTranslation } from "react-i18next";
import {
  Sparkles,
  ArrowDownAZ,
  SlidersHorizontal,
  GripVertical,
  Star,
  Zap,
  CircleDashed,
  AlertTriangle,
  Info,
  Check,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  FontSortMode,
  FontSortSettings,
  FontSortBlock,
  FontSortField,
  FontSortOrder,
  DEFAULT_SORT_BLOCK_ORDER,
} from "../types/sort";
import { SortableSidebarList } from "./SortableSidebarList";

interface FontSortSettingsSectionProps {
  settings: FontSortSettings;
  onChange: (newSettings: FontSortSettings) => void;
}

interface BlockMeta {
  id: FontSortBlock;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  colorClass: string;
}

export function FontSortSettingsSection({
  settings,
  onChange,
}: FontSortSettingsSectionProps) {
  const { t } = useTranslation();

  // 사용자 정의 블록 메타데이터
  const blockMetaMap: Record<FontSortBlock, BlockMeta> = {
    favorites: {
      id: "favorites",
      title: t("sort.block_favorites", "즐겨찾기 폰트"),
      subtitle: t("sort.block_favorites_desc", "관심 등록한 즐겨찾기 글꼴"),
      icon: <Star className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />,
      colorClass: "border-rose-500/30 bg-rose-500/5",
    },
    activated: {
      id: "activated",
      title: t("sort.block_activated", "활성화 폰트"),
      subtitle: t("sort.block_activated_desc", "시스템 등록 또는 임시 활성화 상태"),
      icon: <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />,
      colorClass: "border-amber-500/30 bg-amber-500/5",
    },
    deactivated: {
      id: "deactivated",
      title: t("sort.block_deactivated", "비활성화 폰트"),
      subtitle: t("sort.block_deactivated_desc", "외부 폴더 보관 대기 상태"),
      icon: <CircleDashed className="w-3.5 h-3.5 text-theme-text-muted" />,
      colorClass: "border-theme-border bg-theme-surface/50",
    },
    unplugged: {
      id: "unplugged",
      title: t("sort.block_unplugged", "접근 불가 폰트"),
      subtitle: t("sort.block_unplugged_desc", "외장 드라이브 언플러그드 또는 경로 유실"),
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
      colorClass: "border-amber-500/30 bg-amber-500/5",
    },
  };

  // 모드 변경
  const handleModeChange = (mode: FontSortMode) => {
    onChange({
      ...settings,
      mode,
    });
  };

  // 이름순 기준 변경
  const handleNameFieldChange = (nameField: FontSortField) => {
    onChange({
      ...settings,
      nameField,
    });
  };

  // 이름순 방향 변경
  const handleNameOrderChange = (nameOrder: FontSortOrder) => {
    onChange({
      ...settings,
      nameOrder,
    });
  };

  // 사용자 정의 블록 내부 기준 변경
  const handleCustomFieldChange = (customField: FontSortField) => {
    onChange({
      ...settings,
      customField,
    });
  };

  // 사용자 정의 블록 내부 방향 변경
  const handleCustomOrderChange = (customOrder: FontSortOrder) => {
    onChange({
      ...settings,
      customOrder,
    });
  };

  // 블록 드래그 앤 드롭 순서 변경 핸들러
  const handleReorderBlocks = (newOrder: FontSortBlock[]) => {
    onChange({
      ...settings,
      customPriority: newOrder,
    });
  };

  const activePriorityList =
    settings.customPriority?.length === 4
      ? settings.customPriority
      : DEFAULT_SORT_BLOCK_ORDER;

  return (
    <div className="space-y-4">
      {/* 1. 상단 모드 선택 (스마트 정렬 / 이름순 정렬 / 사용자 정의) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 select-none">
        {/* 모드 1: 스마트 정렬 */}
        <button
          type="button"
          onClick={() => handleModeChange("smart")}
          className={cn(
            "flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer relative",
            settings.mode === "smart"
              ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-xs ring-1 ring-theme-accent/40"
              : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover"
          )}
        >
          <div className="flex items-center gap-1.5 w-full justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-theme-text">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{t("sort.mode_smart", "스마트 정렬")}</span>
            </div>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
              {t("sort_settings.recommended_badge", "추천")}
            </span>
          </div>
          <span className="text-[10px] text-theme-text-muted mt-1 leading-snug">
            {t("sort.mode_smart_card_desc", "즐겨찾기·활성화 폰트 우선 배치 및 미연결 폰트 자동 하단 배치")}
          </span>
        </button>

        {/* 모드 2: 이름순 정렬 */}
        <button
          type="button"
          onClick={() => handleModeChange("name")}
          className={cn(
            "flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer",
            settings.mode === "name"
              ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-xs ring-1 ring-theme-accent/40"
              : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover"
          )}
        >
          <div className="flex items-center gap-1.5 font-semibold text-xs text-theme-text">
            <ArrowDownAZ className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span>{t("sort.mode_name", "이름순 정렬")}</span>
          </div>
          <span className="text-[10px] text-theme-text-muted mt-1 leading-snug">
            {t("sort.mode_name_card_desc", "상태와 관계없이 가나다/알파벳 순서로 완전 고정")}
          </span>
        </button>

        {/* 모드 3: 사용자 정의 */}
        <button
          type="button"
          onClick={() => handleModeChange("custom")}
          className={cn(
            "flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer",
            settings.mode === "custom"
              ? "border-theme-accent bg-theme-active/30 text-theme-text font-semibold shadow-xs ring-1 ring-theme-accent/40"
              : "border-theme-border bg-theme-card text-theme-text-secondary hover:border-theme-border-card-hover hover:bg-theme-card-hover"
          )}
        >
          <div className="flex items-center gap-1.5 font-semibold text-xs text-theme-text">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{t("sort.mode_custom", "사용자 정의")}</span>
          </div>
          <span className="text-[10px] text-theme-text-muted mt-1 leading-snug">
            {t("sort.mode_custom_card_desc", "각 상태 블록의 우선순위를 직접 원하는 순서로 배치")}
          </span>
        </button>
      </div>

      {/* 2. 각 모드별 상세 설정 카드 */}
      {/* 2-1. 스마트 정렬 상세 안내 */}
      {settings.mode === "smart" && (
        <div className="p-3.5 bg-theme-card rounded-xl border border-theme-border space-y-3">
          <div className="flex items-start gap-2 text-xs text-theme-text-secondary">
            <Info className="w-4 h-4 text-theme-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-theme-text">
                {t("sort.smart_guide_title", "스마트 정렬 안내")}
              </div>
              <p className="text-[11px] text-theme-text-muted leading-relaxed">
                {t(
                  "sort_settings.smart_mode_detail_desc",
                  "현재 켜진 폰트와 바로 쓸 수 있는 폰트를 상단에 우선 노출하고, 외장 드라이브 미연결 등 접근 불가 폰트는 방해되지 않도록 맨 아래로 보냅니다."
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded-lg border border-theme-border bg-theme-surface/60 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                1
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <Star className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                <span className="text-xs font-medium text-theme-text truncate">
                  {t("sort.block_favorites", "즐겨찾기 폰트")}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-theme-border bg-theme-surface/60 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                2
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
                <span className="text-xs font-medium text-theme-text truncate">
                  {t("sort.block_activated", "활성화 폰트")}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-theme-border bg-theme-surface/60 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-md bg-theme-badge text-theme-text-secondary font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                3
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <CircleDashed className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
                <span className="text-xs font-medium text-theme-text truncate">
                  {t("sort.block_deactivated", "비활성화 폰트")}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-theme-border bg-theme-surface/60 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                4
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-medium text-theme-text truncate">
                  {t("sort.block_unplugged", "접근 불가 폰트")}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-theme-text-muted bg-theme-surface/40 px-2.5 py-1.5 rounded-lg border border-theme-border-subtle flex items-center justify-between">
            <span>{t("sort_settings.block_internal_sort_label", "블록 내부 정렬 기준:")}</span>
            <span className="font-semibold text-theme-text">
              {t("sort_settings.block_name_fixed", "폰트 이름 오름차순 (A → Z) 고정")}
            </span>
          </div>
        </div>
      )}

      {/* 2-2. 이름순 정렬 상세 설정 */}
      {settings.mode === "name" && (
        <div className="p-3.5 bg-theme-card rounded-xl border border-theme-border space-y-3.5">
          <div className="flex items-start gap-2 text-xs text-theme-text-secondary">
            <Info className="w-4 h-4 text-theme-accent shrink-0 mt-0.5" />
            <p className="text-[11px] text-theme-text-muted leading-relaxed">
              {t(
                "sort_settings.block_name_fixed_desc",
                "스위치를 켜거나 꺼도 목록의 순서가 절대 바뀌지 않도록 이름 순서로 고정합니다."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* 정렬 기준 선택 */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-theme-text-secondary">
                {t("sort_settings.field_label", "정렬 기준 (Field)")}
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-theme-surface p-1 rounded-xl border border-theme-border">
                <button
                  type="button"
                  onClick={() => handleNameFieldChange("fontName")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.nameField === "fontName"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.nameField !== "fontName" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.field_font_name", "폰트 이름 (Font)")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNameFieldChange("fileName")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.nameField === "fileName"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.nameField !== "fileName" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.field_file_name", "파일 이름 (File)")}</span>
                </button>
              </div>
            </div>

            {/* 정렬 방향 선택 */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-theme-text-secondary">
                {t("sort_settings.direction_label", "정렬 방향 (Order)")}
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-theme-surface p-1 rounded-xl border border-theme-border">
                <button
                  type="button"
                  onClick={() => handleNameOrderChange("asc")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.nameOrder === "asc"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.nameOrder !== "asc" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.order_asc", "오름차순 (A → Z)")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNameOrderChange("desc")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.nameOrder === "desc"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.nameOrder !== "desc" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.order_desc", "내림차순 (Z → A)")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2-3. 사용자 정의 (Custom DnD) 상세 설정 */}
      {settings.mode === "custom" && (
        <div className="p-3.5 bg-theme-card rounded-xl border border-theme-border space-y-4">
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-semibold text-theme-text">
              {t("sort_settings.custom_dnd_title", "우선순위 블록 배치 (드래그 앤 드롭)")}
            </span>
            <p className="text-[11px] text-theme-text-muted leading-relaxed">
              {t(
                "sort_settings.custom_dnd_desc",
                "각 블록의 핸들(≡)을 마우스로 끌어서 원하는 우선순위로 배치하세요. 위쪽에 위치한 블록의 폰트들이 리스트 상단에 먼저 노출됩니다."
              )}
            </p>
          </div>

          {/* SortableSidebarList 기반 포인터 드래그 앤 드롭 리스트 */}
          <div className="p-1 rounded-xl bg-theme-surface/50 border border-theme-border/60">
            <SortableSidebarList<FontSortBlock>
              items={activePriorityList}
              getId={(blockId) => blockId}
              onReorder={handleReorderBlocks}
              onItemClick={() => {}}
              className="space-y-1.5"
              renderItem={(blockId, { isDragging, isOver, dropPosition }) => {
                const meta = blockMetaMap[blockId];
                if (!meta) return null;
                const index = activePriorityList.indexOf(blockId);

                return (
                  <div
                    className={cn(
                      "relative flex items-center justify-between p-2.5 rounded-xl border bg-theme-surface transition-all cursor-grab active:cursor-grabbing select-none",
                      meta.colorClass,
                      isDragging && "opacity-30 scale-[0.98] border-theme-accent shadow-sm",
                      isOver && "ring-2 ring-theme-accent/80 shadow-md",
                      dropPosition === "before" && "border-t-2 border-t-theme-accent",
                      dropPosition === "after" && "border-b-2 border-b-theme-accent"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* 드래그 핸들 */}
                      <div className="p-1 text-theme-text-muted hover:text-theme-text rounded transition-colors shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* 순위 뱃지 */}
                      <span className="w-5 h-5 rounded-md bg-theme-accent/15 text-theme-accent font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>

                      {/* 아이콘 및 텍스트 */}
                      <div className="flex items-center gap-2 min-w-0">
                        {meta.icon}
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-theme-text truncate">
                            {meta.title}
                          </span>
                          <span className="text-[10px] text-theme-text-muted truncate">
                            {meta.subtitle}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] text-theme-text-muted font-medium pr-2">
                      {t("sort_settings.priority_rank", "{{rank}}순위", { rank: index + 1 })}
                    </span>
                  </div>
                );
              }}
            />
          </div>

          {/* 블록 내부 공통 정렬 기준 */}
          <div className="pt-2 border-t border-theme-border-subtle space-y-2">
            <span className="text-[11px] font-medium text-theme-text-secondary">
              {t("sort_settings.block_common_sort_title", "블록 내부 공통 정렬 기준")}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* 기준 선택 */}
              <div className="grid grid-cols-2 gap-1 bg-theme-surface p-1 rounded-xl border border-theme-border">
                <button
                  type="button"
                  onClick={() => handleCustomFieldChange("fontName")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.customField === "fontName"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.customField !== "fontName" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.font_name_short", "폰트 이름")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomFieldChange("fileName")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.customField === "fileName"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.customField !== "fileName" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.file_name_short", "파일 이름")}</span>
                </button>
              </div>

              {/* 방향 선택 */}
              <div className="grid grid-cols-2 gap-1 bg-theme-surface p-1 rounded-xl border border-theme-border">
                <button
                  type="button"
                  onClick={() => handleCustomOrderChange("asc")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.customOrder === "asc"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.customOrder !== "asc" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.order_asc_short", "오름차순 (A→Z)")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomOrderChange("desc")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    settings.customOrder === "desc"
                      ? "bg-theme-active text-theme-accent font-semibold shadow-2xs"
                      : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3 text-theme-accent",
                      settings.customOrder !== "desc" && "opacity-0"
                    )}
                  />
                  <span>{t("sort_settings.order_desc_short", "내림차순 (Z→A)")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
