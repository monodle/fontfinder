import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FontMetadata, FontSet } from "../types/font";
import {
  Copy,
  Folder,
  FolderOpen,
  Heart,
  Zap,
  ZapOff,
  Tag,
  Check,
  Download,
  Layers,
  Trash2,
  Shield,
  ChevronRight,
  Search,
  Minus,
  Split,
  Info,
  CornerDownRight,
} from "lucide-react";
import { fontService } from "../services/fontService";
import { isFontFavorite } from "../utils/fontSortUtils";
import { getFontFamilyName } from "../utils/fontLocalization";
import { formatBatchInstallFeedback, formatBatchUninstallFeedback } from "../utils/batchFeedback";

interface SetGroupItem {
  parent: FontSet;
  children: FontSet[];
  isParentMatching: boolean;
  isContextOnlyParent: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  fonts: FontMetadata[];
  sets: FontSet[];
  favoriteIds: Set<number>;
  activatedFontIds?: Set<number>;
  currentSetId?: number | null;
  setMap?: Map<number, Set<number>>;
  onClose: () => void;
  onToggleFavorite: (fontId: number) => void;
  onToggleActivate?: (font: FontMetadata) => void;
  onBulkActivate?: (fontIds: number[], activate: boolean) => void;
  onAddToSet: (setId: number, fontId: number) => void;
  onRemoveFromSet?: (setId: number, fontId: number) => void;
  onBulkFavorite?: (fontIds: number[], add: boolean) => void;
  onBulkAddToSet?: (setId: number, fontIds: number[]) => void;
  onBulkRemoveFromSet?: (setId: number, fontIds: number[]) => void;
  onRequestUninstall?: (fonts: FontMetadata[]) => void;
  onRequestRemoveFromSet?: (setId: number, fonts: FontMetadata[]) => void;
  onRefreshList?: () => void;
  onActionFeedback?: (msg: string) => void;
  onClearSelection?: () => void;
  onOpenDiff?: (fonts: FontMetadata[]) => void;
  onOpenFontInfo?: (fonts: FontMetadata[]) => void;
}

export function ContextMenu({
  x,
  y,
  fonts,
  sets,
  favoriteIds,
  activatedFontIds,
  currentSetId,
  setMap,
  onClose,
  onToggleFavorite,
  onToggleActivate,
  onBulkActivate,
  onAddToSet,
  onRemoveFromSet,
  onBulkFavorite,
  onBulkAddToSet,
  onBulkRemoveFromSet,
  onRequestUninstall,
  onRequestRemoveFromSet,
  onRefreshList,
  onActionFeedback,
  onClearSelection,
  onOpenDiff,
  onOpenFontInfo,
}: ContextMenuProps) {
  const { t, i18n } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const isMulti = fonts.length > 1;
  const primaryFont = fonts[0];

  const diffLabel = useMemo(() => {
    if (fonts.length === 0) return t("context_menu.diff_compare", "[폰트 비교]");
    if (fonts.length === 1) return t("context_menu.diff_compare_1", "[폰트 비교 (1)]");
    if (fonts.length <= 5)
      return t("context_menu.diff_compare_n", {
        count: fonts.length,
        defaultValue: `[폰트 비교 (${fonts.length})]`,
      });
    return t("context_menu.diff_compare_top5", "[폰트 비교 (상위 5개)]");
  }, [fonts.length, t]);

  const handleDiffClick = useCallback(() => {
    if (fonts.length === 0) return;
    onClose();
    if (fonts.length > 5) {
      onActionFeedback?.(
        t("diff.top5_sliced_notice", "최대 5개 폰트만 비교 슬롯에 등록되었습니다.")
      );
      onOpenDiff?.(fonts.slice(0, 5));
    } else {
      onOpenDiff?.(fonts);
    }
  }, [fonts, onClose, onActionFeedback, onOpenDiff, t]);

  // 서브메뉴(2depth) 상태 관리
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [setSearchQuery, setSetSearchQuery] = useState("");
  const [submenuPosition, setSubmenuPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const submenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const structuredSetGroups = useMemo<SetGroupItem[]>(() => {
    const query = setSearchQuery.trim().toLowerCase();
    const parents = sets.filter((s) => s.parent_id == null);
    const childrenMap = new Map<number, FontSet[]>();
    for (const s of sets) {
      if (s.parent_id != null) {
        const list = childrenMap.get(s.parent_id) ?? [];
        list.push(s);
        childrenMap.set(s.parent_id, list);
      }
    }

    if (!query) {
      // 검색어가 없을 때는 전체 1depth 및 그 하위 2depth 계층 노출
      return parents.map((p) => ({
        parent: p,
        children: childrenMap.get(p.id) ?? [],
        isParentMatching: true,
        isContextOnlyParent: false,
      }));
    }

    // 검색어 필터링 규칙:
    // 1) 2depth 일치 시: 상위 1depth 부모를 맥락 헤더로 함께 노출
    // 2) 1depth 일치 시: 1depth만 단독 노출 (하위 2depth 자식은 숨김)
    // 3) 둘 다 일치 시: 1depth와 일치하는 2depth만 함께 노출
    const groups: SetGroupItem[] = [];

    for (const parent of parents) {
      const parentMatches = parent.name.toLowerCase().includes(query);
      const allChildren = childrenMap.get(parent.id) ?? [];
      const matchingChildren = allChildren.filter((c) =>
        c.name.toLowerCase().includes(query)
      );

      if (parentMatches && matchingChildren.length === 0) {
        // 1depth만 매칭된 경우: 1depth만 단독 노출 (자식 숨김)
        groups.push({
          parent,
          children: [],
          isParentMatching: true,
          isContextOnlyParent: false,
        });
      } else if (!parentMatches && matchingChildren.length > 0) {
        // 2depth만 매칭된 경우: 부모를 맥락 헤더로 함께 노출
        groups.push({
          parent,
          children: matchingChildren,
          isParentMatching: false,
          isContextOnlyParent: true,
        });
      } else if (parentMatches && matchingChildren.length > 0) {
        // 둘 다 매칭된 경우: 부모 및 일치하는 자식 모두 노출
        groups.push({
          parent,
          children: matchingChildren,
          isParentMatching: true,
          isContextOnlyParent: false,
        });
      }
    }

    return groups;
  }, [sets, setSearchQuery]);

  // 화면에 렌더링될 총 항목 개수 계산
  const totalVisibleSetCount = useMemo(() => {
    let count = 0;
    for (const g of structuredSetGroups) {
      count += 1 + g.children.length;
    }
    return count;
  }, [structuredSetGroups]);

  // 서브메뉴 예상 높이 계산 (마운트 전 초기 배치 및 측정 전 폴백용)
  const getEstimatedSubmenuHeight = useCallback(() => {
    const hasSearch = sets.length >= 5;
    const searchHeight = hasSearch ? 36 : 0;
    const padding = 14; // p-1.5(상하 6*2) + border(1*2)
    const count = totalVisibleSetCount;
    let listHeight = 44; // 세트 없음 안내 높이
    if (count > 0) {
      listHeight = Math.min(260, count * 34);
    }
    return searchHeight + listHeight + padding;
  }, [sets.length, totalVisibleSetCount]);

  const updateSubmenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current?.getBoundingClientRect() ?? triggerRect;

    // 실제 렌더링된 서브메뉴 크기 (마운트 전이면 예상 크기 사용)
    const submenuRect = submenuRef.current?.getBoundingClientRect();
    const submenuWidth = submenuRect && submenuRect.width > 0 ? submenuRect.width : 216;
    const submenuHeight = submenuRect && submenuRect.height > 0
      ? submenuRect.height
      : getEstimatedSubmenuHeight();

    const SCREEN_PADDING = 8;
    const HORIZONTAL_GAP = 4;
    // 서브메뉴 컨테이너 패딩(p-1.5 = 6px)을 감안하여 아이템 수평선 일치
    const VERTICAL_ITEM_ALIGN_OFFSET = 6;

    // 1. 가로 (X축) 위치 계산: 1depth 메뉴 바로 옆에 배치
    const spaceOnRight = window.innerWidth - menuRect.right - SCREEN_PADDING;
    const spaceOnLeft = menuRect.left - SCREEN_PADDING;

    let left: number;
    if (spaceOnRight >= submenuWidth + HORIZONTAL_GAP) {
      // 우측 공간 충분 -> 1depth 메뉴 바로 오른쪽에 붙임
      left = menuRect.right + HORIZONTAL_GAP;
    } else if (spaceOnLeft >= submenuWidth + HORIZONTAL_GAP) {
      // 우측 공간 부족하고 좌측 공간 충분 -> 1depth 메뉴 바로 왼쪽에 붙임
      left = menuRect.left - submenuWidth - HORIZONTAL_GAP;
    } else {
      // 양쪽 모두 좁은 경우 더 넓은 쪽 선택
      left = spaceOnRight >= spaceOnLeft
        ? menuRect.right + HORIZONTAL_GAP
        : menuRect.left - submenuWidth - HORIZONTAL_GAP;
    }
    left = Math.max(SCREEN_PADDING, Math.min(left, window.innerWidth - submenuWidth - SCREEN_PADDING));

    // 2. 세로 (Y축) 위치 계산:
    // - 아래쪽으로 펼칠 때 (Top 정렬): 서브메뉴 첫 항목이 '서재 세트 등록' 항목과 수평 정렬
    const topAlignY = triggerRect.top - VERTICAL_ITEM_ALIGN_OFFSET;
    // - 위쪽으로 펼칠 때 (Bottom 정렬): 서브메뉴 마지막 항목이 '서재 세트 등록' 항목과 수평 정렬
    const bottomAlignY = triggerRect.bottom + VERTICAL_ITEM_ALIGN_OFFSET - submenuHeight;

    const fitsDownwards = (topAlignY + submenuHeight) <= (window.innerHeight - SCREEN_PADDING);
    const fitsUpwards = bottomAlignY >= SCREEN_PADDING;

    let top: number;
    if (fitsDownwards) {
      // 아래쪽 공간이 충분하면 아래로 펼침 (Top 기준 정렬)
      top = topAlignY;
    } else if (fitsUpwards) {
      // 아래쪽 공간이 부족하고 위쪽 공간이 충분하면 위로 펼침 (Bottom 기준 정렬)
      top = bottomAlignY;
    } else {
      // 둘 다 빠듯할 경우 화면에서 더 많은 영역을 확보할 수 있는 방향 선택
      const spaceBelow = window.innerHeight - triggerRect.top;
      const spaceAbove = triggerRect.bottom;
      top = spaceBelow >= spaceAbove ? topAlignY : bottomAlignY;
    }

    // 최종 화면 경계 벗어남 방지 (클램프)
    top = Math.max(SCREEN_PADDING, Math.min(top, window.innerHeight - submenuHeight - SCREEN_PADDING));

    setSubmenuPosition({
      left: Math.round(left),
      top: Math.round(top),
    });
  }, [getEstimatedSubmenuHeight]);

  const openSubmenu = useCallback(() => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
    updateSubmenuPosition();
    setIsSubmenuOpen(true);
  }, [updateSubmenuPosition]);

  const closeSubmenuWithDelay = useCallback((delay = 220) => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
    }
    submenuTimerRef.current = setTimeout(() => {
      setIsSubmenuOpen(false);
    }, delay);
  }, []);

  const closeSubmenuImmediately = useCallback(() => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
    setIsSubmenuOpen(false);
  }, []);

  const keepSubmenuOpen = useCallback(() => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
  }, []);

  // 서브메뉴 열림 상태 또는 목록 변경 시 실제 DOM 측정 후 위치 동기화
  useLayoutEffect(() => {
    if (isSubmenuOpen) {
      updateSubmenuPosition();
    }
  }, [isSubmenuOpen, totalVisibleSetCount, updateSubmenuPosition]);

  // 창 크기 변경 시 위치 재조정
  useEffect(() => {
    if (!isSubmenuOpen) return;
    const handleResize = () => {
      updateSubmenuPosition();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isSubmenuOpen, updateSubmenuPosition]);

  useEffect(() => {
    return () => {
      if (submenuTimerRef.current) {
        clearTimeout(submenuTimerRef.current);
      }
    };
  }, []);

  // 외부 클릭 시 닫기 (서브메뉴 클릭 포함)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedMenu = menuRef.current?.contains(target);
      const clickedSubmenu = submenuRef.current?.contains(target);
      if (!clickedMenu && !clickedSubmenu) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // 화면 경계 밖으로 벗어나는 것 방지
  const adjustedX = Math.max(8, Math.min(x, window.innerWidth - 240));
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - 360));

  const isFontUsable = (f: FontMetadata) =>
    !f.isMissing && f.install_status !== "unplugged" && f.install_status !== "deleted";

  const handleCopyName = () => {
    const names = fonts.map((f) => getFontFamilyName(f, i18n.language)).join("\n");
    navigator.clipboard.writeText(names);
    onActionFeedback?.(isMulti ? t("toast.copy_names", { count: fonts.length }) : t("toast.copy_name"));
    onClose();
  };

  const handleCopyPath = () => {
    const paths = fonts.map((f) => f.file_path).join("\n");
    navigator.clipboard.writeText(paths);
    onActionFeedback?.(isMulti ? t("toast.copy_paths", { count: fonts.length }) : t("toast.copy_path"));
    onClose();
  };

  const handleShowInFolder = () => {
    if (primaryFont) {
      if (!isFontUsable(primaryFont)) {
        onActionFeedback?.(t("toast.folder_open_failed", "파일이 연결되어 있지 않거나 삭제되었습니다."));
        onClose();
        return;
      }
      fontService.showInFolder(primaryFont.file_path).catch((err) => {
        console.error("탐색기 열기 실패:", err);
        onActionFeedback?.(t("toast.folder_open_failed", "폴더를 열지 못했습니다."));
      });
    }
    onClose();
  };

  const isWoffFont = (f: { format: string }) => f.format === "Woff" || f.format === "Woff2";

  const isPrimaryActivatable =
    isFontUsable(primaryFont) && primaryFont.source !== "system" && primaryFont.source !== "user" && !isWoffFont(primaryFont);
  const activatableFonts = fonts.filter(
    (f) => isFontUsable(f) && f.source !== "system" && f.source !== "user" && !isWoffFont(f)
  );
  const hasActivatable = activatableFonts.length > 0;

  const handleActivateToggle = async () => {
    if (!isMulti) {
      if (!isPrimaryActivatable) return;
      onToggleActivate?.(primaryFont);
    } else {
      if (!hasActivatable) return;
      const allActivated = activatableFonts.every((f) => activatedFontIds?.has(f.id));
      if (onBulkActivate) {
        onBulkActivate(
          activatableFonts.map((f) => f.id),
          !allActivated
        );
      } else {
        activatableFonts.forEach((f) => onToggleActivate?.(f));
      }
    }
    onClearSelection?.();
    onClose();
  };

  const handleInstallAll = async () => {
    const installableFonts = fonts.filter(
      (f) => isFontUsable(f) && f.source !== "system" && f.source !== "user" && !isWoffFont(f)
    );
    if (installableFonts.length === 0) {
      onActionFeedback?.(t("toast.no_installable_fonts"));
      onClose();
      return;
    }

    try {
      // 1. 임시 활성화된 글꼴이 있다면 먼저 임시 활성화부터 해제
      const activatedToDeactivate = installableFonts.filter((f) => activatedFontIds?.has(f.id));
      if (activatedToDeactivate.length > 0) {
        const items = activatedToDeactivate.map((f) => ({ font_id: f.id, path: f.file_path }));
        try {
          await fontService.deactivateFonts(items);
          if (onBulkActivate) {
            onBulkActivate(activatedToDeactivate.map((f) => f.id), false);
          } else {
            activatedToDeactivate.forEach((f) => onToggleActivate?.(f));
          }
        } catch (deactErr) {
          console.warn("설치 전 임시 활성화 해제 오류(설치 계속 진행):", deactErr);
        }
      }

      // 2. 그 다음 설치 진행
      const paths = installableFonts.map((f) => f.file_path);
      const result = await fontService.installFonts(paths);
      onActionFeedback?.(formatBatchInstallFeedback(result, t));
      onRefreshList?.();
      onClearSelection?.();
    } catch (e) {
      console.error(e);
      onActionFeedback?.(t("toast.install_failed", { error: String(e) }));
    }
    onClose();
  };

  // 서재 세트 소속 상태: 전체 포함("all"), 일부 포함("some"), 미포함("none")
  const getSetMembershipState = useCallback(
    (setId: number): "all" | "some" | "none" => {
      const idsInSet = setMap?.get(setId);
      if (!idsInSet || idsInSet.size === 0) return "none";

      if (!isMulti) {
        return idsInSet.has(primaryFont.id) ? "all" : "none";
      }

      let matchCount = 0;
      for (const f of fonts) {
        if (idsInSet.has(f.id)) {
          matchCount++;
        }
      }

      if (matchCount === fonts.length) return "all";
      if (matchCount > 0) return "some";
      return "none";
    },
    [fonts, isMulti, primaryFont, setMap]
  );

  const handleRemoveFromCurrentSet = () => {
    if (currentSetId === null || currentSetId === undefined) return;
    if (onRequestRemoveFromSet) {
      onRequestRemoveFromSet(currentSetId, isMulti ? fonts : [primaryFont]);
      onClose();
      return;
    }
    if (!isMulti) {
      onRemoveFromSet?.(currentSetId, primaryFont.id);
    } else {
      if (onBulkRemoveFromSet) {
        onBulkRemoveFromSet(currentSetId, fonts.map((f) => f.id));
      } else {
        fonts.forEach((f) => onRemoveFromSet?.(currentSetId, f.id));
      }
    }
    onClearSelection?.();
    onClose();
  };

  const handleFavoriteAction = () => {
    if (!isMulti) {
      onToggleFavorite(primaryFont.id);
    } else {
      const allFavorited = fonts.every((f) => isFontFavorite(f, favoriteIds));
      if (onBulkFavorite) {
        onBulkFavorite(
          fonts.map((f) => f.id),
          !allFavorited
        );
      } else {
        fonts.forEach((f) => onToggleFavorite(f.id));
      }
    }
    onClearSelection?.();
    onClose();
  };

  const handleSetAction = (setId: number) => {
    const state = getSetMembershipState(setId);
    if (state === "all") {
      // 이미 전체 포함된 경우: 제거하지 않고 등록 완료 상태 안내
      onActionFeedback?.(t("toast.already_in_set", "이미 해당 서재에 등록되어 있습니다."));
      onClose();
      return;
    }

    // 일부 포함("some") 또는 미포함("none"): 선택된 모든 폰트를 해당 세트에 등록
    if (!isMulti) {
      onAddToSet(setId, primaryFont.id);
    } else {
      if (onBulkAddToSet) {
        onBulkAddToSet(
          setId,
          fonts.map((f) => f.id)
        );
      } else {
        fonts.forEach((f) => onAddToSet(setId, f.id));
      }
    }
    onClearSelection?.();
    onClose();
  };

  if (!primaryFont) return null;

  const isFavorite = isMulti
    ? fonts.every((f) => isFontFavorite(f, favoriteIds))
    : isFontFavorite(primaryFont, favoriteIds);

  const uninstallableFonts = fonts.filter((f) => isFontUsable(f) && f.source === "user");
  const hasUninstallable = uninstallableFonts.length > 0;

  const handleUninstallAll = async () => {
    if (uninstallableFonts.length === 0) return;
    if (onRequestUninstall) {
      onRequestUninstall(uninstallableFonts);
      onClose();
      return;
    }
    try {
      const paths = uninstallableFonts.map((f) => f.file_path);
      const result = await fontService.uninstallFonts(paths);
      onActionFeedback?.(formatBatchUninstallFeedback(result, t));
      onRefreshList?.();
      onClearSelection?.();
    } catch (e) {
      console.error(e);
      onActionFeedback?.(t("toast.uninstall_failed", { error: String(e) }));
    }
    onClose();
  };

  const isActivated = isMulti
    ? fonts.every((f) => activatedFontIds?.has(f.id))
    : activatedFontIds?.has(primaryFont.id) ?? false;

  const installableFonts = fonts.filter(
    (f) => f.source !== "system" && f.source !== "user" && !isWoffFont(f)
  );
  const hasInstallable = installableFonts.length > 0;
  const isAllSystem = isMulti && fonts.length > 0 && fonts.every((f) => f.source === "system");
  const isInCurrentSet = currentSetId !== null && currentSetId !== undefined;

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 w-56 rounded-xl bg-theme-surface border border-theme-border shadow-xl shadow-black/20 p-1.5 text-xs text-theme-text select-none"
        style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header Info */}
        <div className="px-2.5 py-1.5 border-b border-theme-border-subtle mb-1">
          {isMulti ? (
            <div className="flex items-center gap-1.5 text-theme-accent">
              <Layers className="w-3.5 h-3.5" />
              <p className="font-semibold text-xs truncate">
                {t("context_menu.selected_count", { count: fonts.length })}
              </p>
            </div>
          ) : (
            <>
              <p className="font-semibold text-xs text-theme-text truncate">
                {getFontFamilyName(primaryFont, i18n.language)}
              </p>
              <p className="text-[10px] text-theme-text-muted truncate font-mono">
                {primaryFont.subfamily_name} · {primaryFont.format}
              </p>
            </>
          )}
        </div>

        {/* 2. 즐겨찾기 관련: 사용 가능한 폰트가 있을 때만 */}
        {fonts.some((f) => isFontUsable(f)) && (
          <>
            <button
              onClick={handleFavoriteAction}
              onMouseEnter={closeSubmenuImmediately}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  isFavorite ? "text-rose-500 fill-rose-500" : "text-theme-text-muted"
                }`}
              />
              <span>
                {isMulti
                  ? isFavorite
                    ? t("context_menu.bulk_favorite_remove", { count: fonts.length })
                    : t("context_menu.bulk_favorite_add", { count: fonts.length })
                  : isFavorite
                    ? t("context_menu.favorite_remove")
                    : t("context_menu.favorite_add")}
              </span>
            </button>
            <div className="my-1 border-t border-theme-border-subtle" />
          </>
        )}

        {/* 3. 시스템 관련 (임시 활성화, 시스템 설치, 시스템 제거, 시스템 보호) */}
        {/* 3-1. 임시 활성화: 외부 폰트만 활성화 가능 */}
        {(!isMulti ? isPrimaryActivatable : hasActivatable) && (
          <button
            onClick={handleActivateToggle}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
          >
            {isActivated ? (
              <ZapOff className="w-3.5 h-3.5 text-theme-accent" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-theme-accent" />
            )}
            <span>
              {isMulti
                ? isActivated
                  ? t("context_menu.bulk_deactivate", { count: activatableFonts.length })
                  : t("context_menu.bulk_activate", { count: activatableFonts.length })
                : isActivated
                  ? t("context_menu.deactivate")
                  : t("context_menu.activate")}
            </span>
          </button>
        )}

        {/* 3-2. 시스템 설치 (미설치 폰트) */}
        {isMulti ? (
          hasInstallable && (
            <button
              onClick={handleInstallAll}
              onMouseEnter={closeSubmenuImmediately}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-theme-text-muted" />
              <span>{t("context_menu.bulk_install", { count: installableFonts.length })}</span>
            </button>
          )
        ) : (
          isFontUsable(primaryFont) && primaryFont.source !== "system" && primaryFont.source !== "user" && (
            !isWoffFont(primaryFont) ? (
              <button
                onClick={handleInstallAll}
                onMouseEnter={closeSubmenuImmediately}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-theme-text-muted" />
                <span>{t("context_menu.install")}</span>
              </button>
            ) : (
              <div
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-theme-text-muted select-none cursor-default opacity-60"
                title={t("context_menu.woff_unsupported_title", "WOFF/WOFF2 형식은 웹 전용 폰트로, OS 시스템 활성화 및 설치를 지원하지 않습니다.")}
                onMouseEnter={closeSubmenuImmediately}
              >
                <Download className="w-3.5 h-3.5 text-theme-text-muted" />
                <span>{t("context_menu.web_only_font", "웹 전용 폰트 (설치 불가)")}</span>
              </div>
            )
          )
        )}

        {/* 3-3. 시스템에서 글꼴 제거 (사용자 설치 폰트) */}
        {isMulti ? (
          hasUninstallable && (
            <button
              onClick={handleUninstallAll}
              onMouseEnter={closeSubmenuImmediately}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>{t("context_menu.bulk_uninstall", { count: uninstallableFonts.length })}</span>
            </button>
          )
        ) : (
          isFontUsable(primaryFont) && primaryFont.source === "user" && (
            <button
              onClick={handleUninstallAll}
              onMouseEnter={closeSubmenuImmediately}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>{t("context_menu.uninstall")}</span>
            </button>
          )
        )}

        {/* 3-4. 시스템 보호 글꼴 안내 (시스템 내장 폰트) */}
        {isMulti ? (
          isAllSystem && (
            <div
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-theme-text-muted select-none cursor-default"
              title={t("context_menu.system_protected_title")}
              onMouseEnter={closeSubmenuImmediately}
            >
              <Shield className="w-3.5 h-3.5 text-theme-text-muted" />
              <span>{t("context_menu.system_protected_count", { count: fonts.length })}</span>
            </div>
          )
        ) : (
          primaryFont.source === "system" && (
            <div
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-theme-text-muted select-none cursor-default"
              title={t("context_menu.system_protected_title")}
              onMouseEnter={closeSubmenuImmediately}
            >
              <Shield className="w-3.5 h-3.5 text-theme-text-muted" />
              <span>{t("context_menu.system_protected_label")}</span>
            </div>
          )
        )}

        {/* 시스템 동작 항목이 하나라도 있을 때 구분선 표시 */}
        {((!isMulti ? isPrimaryActivatable : hasActivatable) ||
          (isMulti ? hasInstallable : (isFontUsable(primaryFont) && primaryFont.source !== "system" && primaryFont.source !== "user")) ||
          (isMulti ? hasUninstallable : (isFontUsable(primaryFont) && primaryFont.source === "user")) ||
          (isMulti ? isAllSystem : primaryFont.source === "system")) && (
          <div className="my-1 border-t border-theme-border-subtle" />
        )}

        {/* 4. 서재 관련 (서재 세트 등록 2depth 서브메뉴, 현재 서재에서 제거) */}
        {/* 4-1. 서재 세트 등록 (2depth 서브메뉴 트리거): 사용 가능한 폰트가 있을 때만 표시 */}
        {fonts.some((f) => isFontUsable(f)) && (
          <div
            ref={triggerRef}
            onMouseEnter={openSubmenu}
            onMouseLeave={() => closeSubmenuWithDelay(220)}
            className="relative"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isSubmenuOpen) {
                  setIsSubmenuOpen(false);
                } else {
                  openSubmenu();
                }
              }}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
                isSubmenuOpen ? "bg-theme-hover text-theme-text" : "hover:bg-theme-hover text-theme-text"
              }`}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <Tag className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                <span className="truncate">
                  {isMulti
                    ? t("context_menu.bulk_add_to_set", { count: fonts.length })
                    : t("context_menu.add_to_set")}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
            </button>
          </div>
        )}

        {/* 4-2. 현재 서재 세트에서 제거 */}
        {isInCurrentSet && (
          <button
            onClick={handleRemoveFromCurrentSet}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5 text-rose-500" />
            <span>
              {isMulti
                ? t("context_menu.bulk_remove_from_set", { count: fonts.length })
                : t("context_menu.remove_from_set")}
            </span>
          </button>
        )}

        {(fonts.some((f) => isFontUsable(f)) || isInCurrentSet) && (
          <div className="my-1 border-t border-theme-border-subtle" />
        )}

        {/* 4.5 전문가용 글리프 Diff 비교 모달 */}
        {onOpenDiff && (
          <>
            <button
              onClick={handleDiffClick}
              onMouseEnter={closeSubmenuImmediately}
              disabled={fonts.length === 0}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Split className="w-3.5 h-3.5 text-theme-accent" />
              <span>{diffLabel}</span>
            </button>
            <div className="my-1 border-t border-theme-border-subtle" />
          </>
        )}

        {/* 5. 정보 및 탐색 관련 (이름 복사, 경로 복사, 파일 탐색기 열기) */}
        <button
          onClick={handleCopyName}
          onMouseEnter={closeSubmenuImmediately}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5 text-theme-text-muted" />
          <span>{isMulti ? t("context_menu.copy_names", { count: fonts.length }) : t("context_menu.copy_name")}</span>
        </button>

        <button
          onClick={handleCopyPath}
          onMouseEnter={closeSubmenuImmediately}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 text-theme-text-muted" />
          <span>{isMulti ? t("context_menu.copy_paths", { count: fonts.length }) : t("context_menu.copy_path")}</span>
        </button>

        {!isMulti && isFontUsable(primaryFont) && (
          <button
            onClick={handleShowInFolder}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-theme-text-muted" />
            <span>{t("context_menu.show_in_folder")}</span>
          </button>
        )}

        {/* 6. 최하단 폰트 정보 보기 */}
        {fonts.length > 0 && (
          <>
            <div className="my-1 border-t border-theme-border-subtle" />
            <button
              onClick={() => {
                onClose();
                onOpenFontInfo?.(fonts);
              }}
              onMouseEnter={closeSubmenuImmediately}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-theme-accent" />
              <span>
                {isMulti
                  ? t("context_menu.view_font_info_n", {
                      count: fonts.length,
                      defaultValue: `폰트 정보 보기 (${fonts.length}개)`,
                    })
                  : t("context_menu.view_font_info", "폰트 정보 보기")}
              </span>
            </button>
          </>
        )}
      </div>

      {/* 2depth 서브메뉴: 부모 Stacking Context 영향 없이 독립적으로 렌더링되도록 Portal 사용 */}
      {isSubmenuOpen &&
        createPortal(
          <div
            ref={submenuRef}
            onMouseEnter={keepSubmenuOpen}
            onMouseLeave={() => closeSubmenuWithDelay(220)}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 w-52 rounded-xl bg-theme-surface border border-theme-border shadow-2xl shadow-black/25 p-1.5 text-xs text-theme-text select-none animate-in fade-in duration-100"
            style={{
              left: `${submenuPosition.left}px`,
              top: `${submenuPosition.top}px`,
            }}
          >
            {/* 세트 검색 인풋 표시 */}
            {sets.length >= 1 && (
              <div className="relative mb-1.5 px-0.5">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-theme-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={setSearchQuery}
                  onChange={(e) => setSetSearchQuery(e.target.value)}
                  placeholder={t("context_menu.search_sets")}
                  className="w-full pl-7 pr-2 py-1 text-[11px] bg-theme-hover/60 border border-theme-border-subtle rounded-md text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-theme-accent"
                  autoFocus
                />
              </div>
            )}

            {/* 서재 세트 계층 목록 (3depth 팝업 없이 단일 패널 내 인덴트 계층 표시) */}
            <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar px-0.5">
              {sets.length === 0 ? (
                <div className="px-3 py-3 text-center text-theme-text-muted text-[11px]">
                  {t("context_menu.no_sets")}
                </div>
              ) : structuredSetGroups.length === 0 ? (
                <div className="px-3 py-3 text-center text-theme-text-muted text-[11px]">
                  {t("context_menu.no_matching_sets")}
                </div>
              ) : (
                structuredSetGroups.map((group) => {
                  const parentState = getSetMembershipState(group.parent.id);
                  return (
                    <div key={group.parent.id} className="space-y-0.5">
                      {/* 1depth 부모 노드 */}
                      {group.isContextOnlyParent ? (
                        <div className="flex items-center gap-1.5 px-2 pt-1 pb-0.5 text-[10px] font-semibold text-theme-text-muted select-none">
                          <Folder className="w-3 h-3 text-theme-text-muted/70 shrink-0" />
                          <span className="truncate">{group.parent.name}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetAction(group.parent.id)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer group hover:bg-theme-hover text-theme-text font-medium"
                          title={
                            parentState === "all"
                              ? t("context_menu.already_in_set", "이미 등록되어 있습니다")
                              : t("context_menu.add_to_set", "서재 세트 등록")
                          }
                        >
                          <div className="flex items-center gap-1.5 truncate min-w-0">
                            {group.children.length > 0 ? (
                              <Folder className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                            ) : group.parent.color ? (
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs border border-white/20"
                                style={{ backgroundColor: group.parent.color }}
                              />
                            ) : (
                              <Tag className="w-3 h-3 text-theme-accent shrink-0" />
                            )}
                            <span className="truncate text-xs">{group.parent.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {parentState === "all" && (
                              <Check className="w-3.5 h-3.5 text-theme-accent stroke-[2.5]" />
                            )}
                            {parentState === "some" && (
                              <Minus className="w-3.5 h-3.5 text-theme-accent stroke-[2.5]" />
                            )}
                            {group.parent.count !== undefined && (
                              <span className="text-[10px] text-theme-text-muted bg-theme-hover/80 px-1.5 py-0.5 rounded font-mono">
                                {group.parent.count}
                              </span>
                            )}
                          </div>
                        </button>
                      )}

                      {/* 2depth 자식 노드 목록 (들여쓰기 및 꺾쇠 인디케이터) */}
                      {group.children.length > 0 && (
                        <div className="ml-3 pl-2 border-l border-theme-border/60 space-y-0.5">
                          {group.children.map((child) => {
                            const childState = getSetMembershipState(child.id);
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => handleSetAction(child.id)}
                                className="w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-left transition-colors cursor-pointer group hover:bg-theme-hover text-theme-text/90 hover:text-theme-text"
                                title={
                                  childState === "all"
                                    ? t("context_menu.already_in_set", "이미 등록되어 있습니다")
                                    : t("context_menu.add_to_set", "서재 세트 등록")
                                }
                              >
                                <div className="flex items-center gap-1.5 truncate min-w-0">
                                  <CornerDownRight className="w-2.5 h-2.5 text-theme-text-muted/60 shrink-0" />
                                  {child.color ? (
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0 shadow-2xs border border-white/20"
                                      style={{ backgroundColor: child.color }}
                                    />
                                  ) : (
                                    <Tag className="w-2.5 h-2.5 text-theme-accent/80 shrink-0" />
                                  )}
                                  <span className="truncate text-[11px]">{child.name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {childState === "all" && (
                                    <Check className="w-3 h-3 text-theme-accent stroke-[2.5]" />
                                  )}
                                  {childState === "some" && (
                                    <Minus className="w-3 h-3 text-theme-accent stroke-[2.5]" />
                                  )}
                                  {child.count !== undefined && (
                                    <span className="text-[9px] text-theme-text-muted bg-theme-hover/60 px-1 py-0.2 rounded font-mono">
                                      {child.count}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
