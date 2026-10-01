import { useTranslation } from "react-i18next";
import { Sparkles, ArrowDownAZ, ArrowUpZA, SlidersHorizontal } from "lucide-react";
import { FontSortMode, FontSortSettings } from "../types/sort";
import { SegmentedControl, SegmentOption } from "./common/SegmentedControl";

export interface SortModeControlProps {
  sortSettings: FontSortSettings;
  onChange: (newSettings: FontSortSettings) => void;
  className?: string;
  disabled?: boolean;
}

export function SortModeControl({
  sortSettings,
  onChange,
  className = "",
  disabled = false,
}: SortModeControlProps) {
  const { t } = useTranslation();

  const handleModeSelect = (mode: FontSortMode) => {
    if (sortSettings.mode === mode) return;
    onChange({
      ...sortSettings,
      mode,
    });
  };

  const nameOrderTitle =
    sortSettings.mode === "name"
      ? sortSettings.nameOrder === "desc"
        ? t("sort.mode_name_desc", { defaultValue: "이름순 (Z-A)" })
        : t("sort.mode_name_asc", { defaultValue: "이름순 (A-Z)" })
      : t("sort.mode_name", { defaultValue: "이름순 정렬" });

  const options: SegmentOption<FontSortMode>[] = [
    {
      value: "smart",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      title: t("sort.mode_smart_desc", {
        defaultValue: "스마트 정렬 (즐겨찾기 > 활성화 > 비활성화 > 접근불가)",
      }),
    },
    {
      value: "name",
      icon:
        sortSettings.nameOrder === "desc" ? (
          <ArrowUpZA className="w-3.5 h-3.5" />
        ) : (
          <ArrowDownAZ className="w-3.5 h-3.5" />
        ),
      title: nameOrderTitle,
    },
    {
      value: "custom",
      icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
      title: t("sort.mode_custom_desc", {
        defaultValue: "사용자 정의 블록 정렬",
      }),
    },
  ];

  return (
    <SegmentedControl
      options={options}
      value={sortSettings.mode}
      onChange={handleModeSelect}
      variant="segment"
      size="sm"
      className={className}
      disabled={disabled}
      aria-label={t("sort.title", { defaultValue: "폰트 목록 정렬" })}
    />
  );
}
