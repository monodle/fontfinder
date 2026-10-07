import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  BookmarkPlus,
  Folder,
  Tag,
  Shuffle,
  Check,
  Plus,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { ModalDialog, Input } from "../common";
import { FontSet } from "../../types/font";
import {
  LIBRARY_LABEL_COLOR_PRESETS,
  getRandomLibraryColor,
  isLightColor,
} from "../../config/colorPresets";
import { librarySetFormSchema, libraryFolderColorFormSchema } from "../../schemas";

type LibraryModalMode = "create_set" | "edit_set" | "edit_folder";

export interface LibraryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: LibraryModalMode;
  initialName?: string;
  initialColor?: string;
  initialParentId?: number | null;
  currentSetId?: number;
  availableParents?: FontSet[];
  hasChildren?: boolean;
  onSubmitSet?: (name: string, color: string, parentId?: number | null) => void;
  onSubmitFolderColor?: (color: string) => void;
}

export function LibraryItemModal({
  isOpen,
  onClose,
  mode,
  initialName = "",
  initialColor,
  initialParentId = null,
  currentSetId,
  availableParents = [],
  hasChildren = false,
  onSubmitSet,
  onSubmitFolderColor,
}: LibraryItemModalProps) {
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const paletteContainerRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [parentId, setParentId] = useState<number | null>(initialParentId);
  const [selectedColor, setSelectedColor] = useState(
    initialColor || getRandomLibraryColor()
  );
  const [customHex, setCustomHex] = useState(
    initialColor || selectedColor
  );

  /**
   * 지정한 HEX 색상이 팔레트 스크롤 영역에 노출되도록 부드럽게 스크롤
   */
  const scrollToColor = useCallback(
    (color: string, behavior: ScrollBehavior = "smooth") => {
      const container = paletteContainerRef.current;
      if (!container) return;

      const target = container.querySelector<HTMLElement>(
        `[data-color="${color.toLowerCase()}"]`
      );
      if (!target) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      // 컨테이너 스크롤 기준 상대 오프셋 계산
      const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
      const newScrollTop = Math.max(
        0,
        relativeTop - container.clientHeight / 2 + target.offsetHeight / 2
      );

      container.scrollTo({
        top: newScrollTop,
        behavior,
      });
    },
    []
  );

  // 모달이 열릴 때 초기값 설정 및 세트 이름 입력창 포커스
  useEffect(() => {
    if (!isOpen) return;

    setNameError(null);
    let targetColor: string;
    if (mode === "create_set") {
      setName("");
      setParentId(initialParentId);
      const rand = getRandomLibraryColor();
      setSelectedColor(rand);
      setCustomHex(rand);
      targetColor = rand;
    } else {
      setName(initialName);
      setParentId(initialParentId);
      const color = initialColor || getRandomLibraryColor();
      setSelectedColor(color);
      setCustomHex(color);
      targetColor = color;
    }

    // 모달 오픈 시 현재 선택된 색상 위치로 스크롤
    const scrollTimer = setTimeout(() => {
      scrollToColor(targetColor, "auto");
    }, 60);

    // 색상 초기화 및 렌더링 이후 세트 이름 입력창으로 포커스 이동
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    if (mode !== "edit_folder") {
      focusTimer = setTimeout(() => {
        nameInputRef.current?.focus();
        if (mode === "edit_set") {
          nameInputRef.current?.select();
        }
      }, 50);
    }

    return () => {
      clearTimeout(scrollTimer);
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [isOpen, mode, initialName, initialColor, initialParentId, scrollToColor]);

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    setCustomHex(color);
  };

  const handleRandomizeColor = () => {
    const rand = getRandomLibraryColor();
    setSelectedColor(rand);
    setCustomHex(rand);
    requestAnimationFrame(() => {
      scrollToColor(rand, "smooth");
    });
  };

  const handleCustomHexChange = (value: string) => {
    setCustomHex(value);
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      setSelectedColor(value);
      requestAnimationFrame(() => {
        scrollToColor(value, "smooth");
      });
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (nameError) {
      setNameError(null);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mode === "edit_folder") {
      const parsedColor = libraryFolderColorFormSchema.safeParse({ color: selectedColor });
      if (!parsedColor.success) return;
      onSubmitFolderColor?.(parsedColor.data.color);
      onClose();
      return;
    }

    const validation = librarySetFormSchema.safeParse({
      name,
      color: selectedColor,
      parentId,
    });

    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      if (firstIssue.path[0] === "name") {
        setNameError(firstIssue.message);
      }
      return;
    }

    setNameError(null);
    onSubmitSet?.(validation.data.name, validation.data.color, validation.data.parentId);
    onClose();
  };

  // 현재 색상 명칭
  const currentPreset = LIBRARY_LABEL_COLOR_PRESETS.find(
    (p) => p.color.toLowerCase() === selectedColor.toLowerCase()
  );
  const colorDisplayName = currentPreset
    ? currentPreset.label
    : t("library_modal.custom_color_name");

  const isLight = isLightColor(selectedColor);
  const displayName =
    name.trim() ||
    (mode === "edit_folder"
      ? initialName || t("library_modal.default_folder_name")
      : mode === "create_set"
      ? t("library_modal.default_new_set_name")
      : t("library_modal.default_set_name"));
  const shortName = displayName.slice(0, 2);

  // 모드별 텍스트 및 아이콘 매핑
  const modalConfig = {
    create_set: {
      title: t("sidebar.create_set_title"),
      subtitle: t("sidebar.create_set_desc"),
      icon: <BookmarkPlus className="w-4 h-4 text-theme-accent" />,
      submitLabel: t("common.create"),
      submitIcon: <Plus className="w-3.5 h-3.5" />,
      isSubmitDisabled: !name.trim() || name.length > 100,
    },
    edit_set: {
      title: t("sidebar.edit_set_title"),
      subtitle: t("sidebar.edit_set_desc"),
      icon: <Tag className="w-4 h-4 text-theme-accent" />,
      submitLabel: t("common.save"),
      submitIcon: <Check className="w-3.5 h-3.5" />,
      isSubmitDisabled: !name.trim() || name.length > 100,
    },
    edit_folder: {
      title: t("sidebar.folder_color_title"),
      subtitle: t("sidebar.folder_color_desc"),
      icon: <Folder className="w-4 h-4 text-theme-accent" />,
      submitLabel: t("common.apply"),
      submitIcon: <Check className="w-3.5 h-3.5" />,
      isSubmitDisabled: false,
    },
  }[mode];


  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={modalConfig.title}
      subtitle={modalConfig.subtitle}
      icon={modalConfig.icon}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          {/* 선택 색상 정보 인디케이터 */}
          <div className="flex items-center gap-2">
            <span
              style={{ backgroundColor: selectedColor }}
              className="w-3.5 h-3.5 rounded-full ring-1 ring-theme-border shadow-2xs shrink-0"
            />
            <span className="text-xs font-semibold text-theme-text">
              {colorDisplayName}
            </span>
            <span className="text-[11px] font-mono text-theme-text-muted uppercase">
              {selectedColor}
            </span>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-theme-border text-xs font-medium text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={modalConfig.isSubmitDisabled}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-theme-accent text-theme-accent-text text-xs font-semibold hover:bg-theme-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
            >
              {modalConfig.submitIcon}
              {modalConfig.submitLabel}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* 1. 실시간 미리보기 카드 (Live Preview) */}
        <div className="p-3.5 rounded-xl bg-theme-surface-header/80 border border-theme-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              style={{ backgroundColor: selectedColor }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0 ring-1 ring-black/10 dark:ring-white/10"
            >
              {mode === "edit_folder" ? (
                <Folder className="w-4 h-4" />
              ) : (
                <Tag className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider block">
                {mode === "edit_folder"
                  ? t("library_modal.folder_label")
                  : t("library_modal.set_label")}
              </span>
              <span className="text-sm font-bold text-theme-text truncate block">
                {displayName}
              </span>
            </div>
          </div>

          {/* 뱃지 프리뷰 2종 */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            {/* 사이드바 항목 형태 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-theme-sidebar border border-theme-border text-xs text-theme-text shadow-2xs">
              <span
                style={{ backgroundColor: selectedColor }}
                className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-theme-surface"
              />
              <span className="text-[11px] font-medium truncate max-w-[110px]">
                {displayName}
              </span>
            </div>

            {/* 폰트 카드 아바타 스택 형태 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-theme-card border border-theme-border text-xs shadow-2xs">
              <div
                style={{
                  backgroundColor: selectedColor,
                  color: isLight ? "#111827" : "#ffffff",
                }}
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ring-1.5 ring-theme-surface shrink-0 shadow-2xs"
              >
                {shortName}
              </div>
              <span className="text-[11px] text-theme-text font-medium truncate max-w-[90px]">
                {displayName}
              </span>
            </div>
          </div>
        </div>

        {/* 2. 이름 입력 (세트 모드일 때만 활성화) */}
        {mode !== "edit_folder" ? (
          <div className="space-y-3.5">
            <div>
              <Input
                ref={nameInputRef}
                label={t("sidebar.set_name_label")}
                prefixIcon={<Tag className="w-4 h-4 text-theme-text-muted" />}
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder={t("sidebar.new_set_placeholder")}
                clearable
                onClear={() => handleNameChange("")}
                error={nameError || undefined}
              />

            </div>

            {/* 상위 세트(위치) 선택 드롭다운 (2depth 제한) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-theme-text">
                  {t("sidebar.set_location_label")}
                </label>
                <span className="text-[10px] text-theme-text-muted font-mono">
                  {parentId
                    ? t("sidebar.depth_2")
                    : t("sidebar.depth_1")}
                </span>
              </div>

              {hasChildren ? (
                <div className="px-3 py-2 rounded-xl bg-theme-input/40 border border-theme-border/60 text-xs text-theme-text-muted flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Folder className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                    <span>{t("sidebar.parent_has_children_locked")}</span>
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <Folder className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
                  <select
                    value={parentId ?? ""}
                    onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-theme-input/60 hover:bg-theme-input border border-theme-border focus:border-theme-accent focus:ring-2 focus:ring-theme-accent/20 rounded-xl pl-9 pr-8 py-2 text-xs text-theme-text transition-all outline-none cursor-pointer appearance-none"
                  >
                    <option value="">{t("sidebar.set_parent_root")}</option>
                    {availableParents
                      .filter((p) => p.parent_id == null && p.id !== currentSetId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {`📁 ${p.name}`}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-xl bg-theme-input/30 border border-theme-border/50 text-xs text-theme-text-muted flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{initialName}</span>
          </div>
        )}

        {/* 3. 라벨 색상 팔레트 탐색 영역 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-theme-text">
                {t("sidebar.label_color")}
              </span>
              <span className="text-[11px] text-theme-text-muted">
                {t("sidebar.label_color_desc")}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRandomizeColor}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-theme-border bg-theme-hover/40 hover:bg-theme-hover text-[11px] font-medium text-theme-text-muted hover:text-theme-text transition-all cursor-pointer shadow-2xs"
              title={t("sidebar.random_color")}
            >
              <Shuffle className="w-3 h-3 text-theme-accent" />
              <span>{t("sidebar.random_color")}</span>
            </button>
          </div>

          {/* 200종 컬러 팔레트 그리드 */}
          <div
            ref={paletteContainerRef}
            className="grid grid-cols-10 gap-2 max-h-[220px] overflow-y-auto p-1 pr-1.5 scrollbar-thin"
          >
            {LIBRARY_LABEL_COLOR_PRESETS.map((preset) => {
              const isSelected =
                selectedColor.toLowerCase() === preset.color.toLowerCase();
              const light = isLightColor(preset.color);

              return (
                <button
                  key={preset.color}
                  type="button"
                  data-color={preset.color.toLowerCase()}
                  onClick={() => handleSelectColor(preset.color)}
                  style={{ backgroundColor: preset.color }}
                  title={`${preset.label} (${preset.color})`}
                  className={`aspect-square rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-2xs relative hover:scale-110 ${
                    isSelected
                      ? "ring-3 ring-theme-accent ring-offset-2 ring-offset-theme-surface scale-105 z-10 shadow-sm"
                      : "border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                  }`}
                >
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 stroke-[2.5] ${
                        light ? "text-black" : "text-white"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 커스텀 HEX 직접 입력 필드 */}
          <div className="pt-2 border-t border-theme-border/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-theme-accent" />
              <span className="text-xs font-medium text-theme-text-muted">
                {t("sidebar.custom_color")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => handleSelectColor(e.target.value)}
                className="w-7 h-7 rounded-lg border border-theme-border cursor-pointer bg-transparent p-0.5"
              />
              <input
                type="text"
                value={customHex}
                onChange={(e) => handleCustomHexChange(e.target.value)}
                placeholder="#000000"
                maxLength={7}
                className="w-24 px-2.5 py-1 text-xs font-mono uppercase bg-theme-input/60 border border-theme-border rounded-lg text-theme-text focus:outline-none focus:border-theme-accent"
              />
            </div>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
