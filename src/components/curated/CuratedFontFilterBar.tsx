import { Sparkles, Check, CheckCircle2 } from "lucide-react";
import { CuratedFontCategoryFilter } from "../../hooks/useCuratedFonts";

interface CuratedFontFilterBarProps {
  selectedCategory: CuratedFontCategoryFilter;
  onSelectCategory: (category: CuratedFontCategoryFilter) => void;
  onlyVariable: boolean;
  onToggleVariable: () => void;
  onlyInstalled?: boolean;
  onToggleInstalled?: () => void;
  filteredCount: number;
  totalCount: number;
}

const CATEGORIES: { id: CuratedFontCategoryFilter; label: string }[] = [
  { id: "all", label: "전체 형태" },
  { id: "sans-serif", label: "Sans Serif (고딕)" },
  { id: "serif", label: "Serif (명조)" },
  { id: "display", label: "Display (장식)" },
  { id: "handwriting", label: "Handwriting (손글씨)" },
  { id: "monospace", label: "Monospace (고정폭)" },
];

export function CuratedFontFilterBar({
  selectedCategory,
  onSelectCategory,
  onlyVariable,
  onToggleVariable,
  onlyInstalled = false,
  onToggleInstalled,
  filteredCount,
  totalCount,
}: CuratedFontFilterBarProps) {
  return (
    <div className="h-10 px-4 bg-theme-surface/90 border-b border-theme-border flex items-center justify-between gap-3 text-xs shrink-0 select-none backdrop-blur-xs transition-colors overflow-x-auto no-scrollbar">
      {/* 좌측: 폰트 형태(Classification) 칩 버튼 그룹 */}
      <div className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-medium text-theme-text-muted mr-1 shrink-0">
          형태:
        </span>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? "bg-theme-accent text-white shadow-2xs font-semibold"
                  : "bg-theme-card text-theme-text-secondary border border-theme-border hover:bg-theme-hover hover:text-theme-text"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 우측: [가변 폰트 토글] + [설치됨 토글] + [개수 뱃지] */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {/* 가변 폰트(Variable Fonts) 토글 칩 */}
        <button
          type="button"
          onClick={onToggleVariable}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
            onlyVariable
              ? "bg-theme-accent-subtle border-theme-accent text-theme-accent font-semibold"
              : "bg-theme-card border-theme-border text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
          }`}
          title="굵기와 너비를 자유롭게 조절 가능한 가변 폰트만 필터링합니다"
        >
          <Sparkles
            className={`w-3 h-3 ${
              onlyVariable ? "text-theme-accent" : "text-theme-text-muted"
            }`}
          />
          <span>가변 폰트</span>
          {onlyVariable && <Check className="w-3 h-3 ml-0.5" />}
        </button>

        {/* 내 PC 설치됨(Installed) 필터 토글 */}
        {onToggleInstalled && (
          <button
            type="button"
            onClick={onToggleInstalled}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
              onlyInstalled
                ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "bg-theme-card border-theme-border text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
            }`}
            title="현재 내 컴퓨터에 설치되어 있는 폰트만 필터링합니다"
          >
            <CheckCircle2
              className={`w-3 h-3 ${
                onlyInstalled
                  ? "text-emerald-500"
                  : "text-theme-text-muted"
              }`}
            />
            <span>내 PC 설치됨</span>
            {onlyInstalled && <Check className="w-3 h-3 ml-0.5" />}
          </button>
        )}

        {/* 총 개수 뱃지 */}
        <div className="text-[11px] font-medium text-theme-text-muted pl-1 shrink-0">
          <span className="font-semibold text-theme-text">
            {filteredCount.toLocaleString()}
          </span>
          <span className="opacity-60"> / {totalCount.toLocaleString()}개</span>
        </div>
      </div>
    </div>
  );
}
