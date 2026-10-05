import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, AlignCenter, AlignRight, ChevronDown, Check } from "lucide-react";
import { cn } from "../../utils/cn";

export type TextAlignOption = "left" | "center" | "right";

export interface TextAlignDropdownProps {
  value: TextAlignOption;
  onChange: (align: TextAlignOption) => void;
  className?: string;
  disabled?: boolean;
}

export function TextAlignDropdown({
  value,
  onChange,
  className = "",
  disabled = false,
}: TextAlignDropdownProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 및 ESC 키 감지 시 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const alignOptions: {
    id: TextAlignOption;
    label: string;
    icon: typeof AlignLeft;
  }[] = [
    {
      id: "left",
      label: t("settings.align_left"),
      icon: AlignLeft,
    },
    {
      id: "center",
      label: t("settings.align_center"),
      icon: AlignCenter,
    },
    {
      id: "right",
      label: t("settings.align_right"),
      icon: AlignRight,
    },
  ];

  const currentOption =
    alignOptions.find((opt) => opt.id === value) || alignOptions[0];
  const CurrentIcon = currentOption.icon;

  const handleSelect = (optionId: TextAlignOption) => {
    onChange(optionId);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block select-none", className)}
    >
      {/* 드롭다운 트리거 버튼 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "h-8 px-2 flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-card hover:bg-theme-card-hover hover:border-theme-accent/50 text-theme-text transition-all cursor-pointer shadow-2xs text-xs",
          isOpen && "border-theme-accent ring-1 ring-theme-accent/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        title={`${t("settings.default_text_align")}: ${currentOption.label}`}
        aria-label={t("settings.default_text_align")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="w-3.5 h-3.5 text-theme-text shrink-0" />
        <ChevronDown
          className={`w-3 h-3 text-theme-text-muted transition-transform duration-150 ${
            isOpen ? "rotate-180 text-theme-accent" : ""
          }`}
        />
      </button>

      {/* 드롭다운 팝오버 메뉴 */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 w-32 bg-theme-surface border border-theme-border rounded-xl shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {alignOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = opt.id === value;

            return (
              <button
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                  isSelected
                    ? "bg-theme-accent/15 text-theme-accent font-semibold"
                    : "text-theme-text hover:bg-theme-hover"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{opt.label}</span>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
