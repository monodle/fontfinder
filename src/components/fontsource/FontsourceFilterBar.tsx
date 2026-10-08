import { Globe, Sparkles, Check, CheckCircle2 } from "lucide-react";
import {
  FontsourceCategoryFilter,
  FONTSOURCE_SUBSETS,
} from "../../hooks/useFontsource";

interface FontsourceFilterBarProps {
  selectedCategory: FontsourceCategoryFilter;
  onSelectCategory: (category: FontsourceCategoryFilter) => void;
  selectedSubset: string;
  onSelectSubset: (subset: string) => void;
  onlyVariable: boolean;
  onToggleVariable: () => void;
  onlyInstalled?: boolean;
  onToggleInstalled?: () => void;
  filteredCount: number;
  totalCount: number;
}

const CATEGORIES: { id: FontsourceCategoryFilter; label: string }[] = [
  { id: "all", label: "전체 형태" },
  { id: "sans-serif", label: "Sans Serif (고딕)" },
  { id: "serif", label: "Serif (명조)" },
  { id: "display", label: "Display (장식)" },
  { id: "handwriting", label: "Handwriting (손글씨)" },
  { id: "monospace", label: "Monospace (고정폭)" },
  { id: "other", label: "기타" },
];

export function FontsourceFilterBar({
  selectedCategory,
  onSelectCategory,
  selectedSubset,
  onSelectSubset,
  onlyVariable,
  onToggleVariable,
  onlyInstalled = false,
  onToggleInstalled,
  filteredCount,
  totalCount,
}: FontsourceFilterBarProps) {
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

      {/* 우측: [언어 선택] + [가변 폰트 토글] + [설치됨 토글] + [개수 뱃지] */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {/* 언어(Subset) 선택 드롭다운 */}
        <div className="flex items-center gap-1.5 bg-theme-card border border-theme-border rounded-lg px-2 py-1 shadow-2xs">
          <Globe className="w-3.5 h-3.5 text-theme-accent shrink-0" />
          <select
            value={selectedSubset}
            onChange={(e) => onSelectSubset(e.target.value)}
            className="text-[11px] bg-transparent text-theme-text focus:outline-hidden cursor-pointer"
            title="지원 문자셋 / 언어 필터"
          >
            {FONTSOURCE_SUBSETS.map((sub) => (
              <option key={sub.id} value={sub.id} className="bg-theme-card text-theme-text">
                {sub.label}
              </option>
            ))}
          </select>
        </div>

        {/* 가변 폰트(Variable Fonts) 토글 칩 */}
        <button
          type="button"
          onClick={onToggleVariable}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
            onlyVariable
              ? "bg-theme-accent-subtle border-theme-accent text-theme-accent font-semibold"
              : "bg-theme-card border-theme-border text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
          }`}
          title="굵기와 너비를 자유롭게 조절 가능한 가변 폰트(Variable Fonts)만 필터링합니다"
        >
          <Sparkles className={`w-3 h-3 ${onlyVariable ? "text-theme-accent" : "text-theme-text-muted"}`} />
          <span>가변 폰트</span>
          {onlyVariable && <Check className="w-3 h-3 ml-0.5" />}
        </button>

        {/* 설치된 폰트만 보기 토글 칩 */}
        {onToggleInstalled && (
          <button
            type="button"
            onClick={onToggleInstalled}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer shadow-2xs ${
              onlyInstalled
                ? "bg-emerald-500/15 border-emerald-500 text-emerald-500 font-semibold"
                : "bg-theme-card border-theme-border text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
            }`}
            title="내 컴퓨터(시스템/사용자)에 이미 설치된 Fontsource 폰트만 필터링합니다"
          >
            <CheckCircle2 className={`w-3 h-3 ${onlyInstalled ? "text-emerald-500" : "text-theme-text-muted"}`} />
            <span>설치됨</span>
            {onlyInstalled && <Check className="w-3 h-3 ml-0.5" />}
          </button>
        )}

        {/* 필터링 결과 뱃지 */}
        <div className="text-[11px] font-mono text-theme-text-muted px-2 py-1 rounded bg-theme-hover border border-theme-border shrink-0">
          {filteredCount.toLocaleString()} / {totalCount.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
