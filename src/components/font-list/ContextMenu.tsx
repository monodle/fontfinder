import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FontMetadata, FontSet } from "../../types/font";
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
import { fontService } from "../../services/fontService";
import { isFavoriteCategoryFont as isFontFavorite } from "../../utils/fontFilterUtils";
import { getFontFamilyName } from "../../utils/fontLocalization";
import { formatBatchInstallFeedback, formatBatchUninstallFeedback } from "../../utils/batchFeedback";
import { IS_MAC } from "../../utils/platform";

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
  onRequestDeactivate?: (fonts: FontMetadata[]) => void;
  onRequestRemoveFromSet?: (setId: number, fonts: FontMetadata[]) => void;
  onRefreshList?: () => void;
  onActionFeedback?: (msg: string) => void;
  onClearSelection?: () => void;
  onOpenDiff?: (fonts: FontMetadata[]) => void;
  onOpenFontInfo?: (fonts: FontMetadata[]) => void;
}

type SubmenuType = "set" | "copy" | null;

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
  onRequestDeactivate,
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

  const isFontUsable = (f: FontMetadata) =>
    !f.isMissing && f.install_status !== "unplugged" && f.install_status !== "deleted";

  const isWoffFont = (f: { format: string }) => f.format === "Woff" || f.format === "Woff2";

  // 사용 가능한 폰트 필터링
  const usableFonts = useMemo(() => fonts.filter(isFontUsable), [fonts]);

  // 1. 즐겨찾기 상태 분류
  const unfavoritedFonts = useMemo(
    () => usableFonts.filter((f) => !isFontFavorite(f, favoriteIds)),
    [usableFonts, favoriteIds]
  );
  const favoritedFonts = useMemo(
    () => usableFonts.filter((f) => isFontFavorite(f, favoriteIds)),
    [usableFonts, favoriteIds]
  );

  // 2. 임시 활성화 상태 분류 (외부 폰트만 해당)
  const activatableFonts = useMemo(
    () => usableFonts.filter((f) => f.source !== "system" && f.source !== "user" && !isWoffFont(f)),
    [usableFonts]
  );
  const inactiveActivatableFonts = useMemo(
    () => activatableFonts.filter((f) => !activatedFontIds?.has(f.id)),
    [activatableFonts, activatedFontIds]
  );
  const activeActivatableFonts = useMemo(
    () => activatableFonts.filter((f) => activatedFontIds?.has(f.id)),
    [activatableFonts, activatedFontIds]
  );

  // 3. 시스템 설치 / 제거 / 보호 분류
  const installableFonts = useMemo(
    () => usableFonts.filter((f) => f.source !== "system" && f.source !== "user" && !isWoffFont(f)),
    [usableFonts]
  );
  const uninstallableFonts = useMemo(
    () => usableFonts.filter((f) => f.source === "user"),
    [usableFonts]
  );
  const systemFonts = useMemo(
    () => fonts.filter((f) => f.source === "system"),
    [fonts]
  );

  // 서재 상태 (현재 열려있는 서재 세트 화면인지 여부)
  const isInCurrentSet = currentSetId !== null && currentSetId !== undefined;

  // 폰트 비교 라벨
  const diffLabel = useMemo(() => {
    if (fonts.length === 0) return t("context_menu.diff_compare");
    if (fonts.length === 1) return t("context_menu.diff_compare_1");
    if (fonts.length <= 5) {
      return t("context_menu.diff_compare_n", {
        count: fonts.length,
      });
    }
    return t("context_menu.diff_compare_top5");
  }, [fonts.length, t]);

  const handleDiffClick = useCallback(() => {
    if (fonts.length === 0) return;
    onClose();
    if (fonts.length > 5) {
      onActionFeedback?.(
        t("diff.top5_sliced_notice")
      );
      onOpenDiff?.(fonts.slice(0, 5));
    } else {
      onOpenDiff?.(fonts);
    }
  }, [fonts, onClose, onActionFeedback, onOpenDiff, t]);

  // 서브메뉴(2depth) 상태 관리
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuType>(null);
  const [setSearchQuery, setSetSearchQuery] = useState("");

  const setTriggerRef = useRef<HTMLDivElement>(null);
  const setSubmenuRef = useRef<HTMLDivElement>(null);
  const copyTriggerRef = useRef<HTMLDivElement>(null);
  const copySubmenuRef = useRef<HTMLDivElement>(null);

  const [setSubmenuPosition, setSetSubmenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [copySubmenuPosition, setCopySubmenuPosition] = useState<{ left: number; top: number } | null>(null);
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
      return parents.map((p) => ({
        parent: p,
        children: childrenMap.get(p.id) ?? [],
        isParentMatching: true,
        isContextOnlyParent: false,
      }));
    }

    const groups: SetGroupItem[] = [];

    for (const parent of parents) {
      const parentMatches = parent.name.toLowerCase().includes(query);
      const allChildren = childrenMap.get(parent.id) ?? [];
      const matchingChildren = allChildren.filter((c) =>
        c.name.toLowerCase().includes(query)
      );

      if (parentMatches && matchingChildren.length === 0) {
        groups.push({
          parent,
          children: [],
          isParentMatching: true,
          isContextOnlyParent: false,
        });
      } else if (!parentMatches && matchingChildren.length > 0) {
        groups.push({
          parent,
          children: matchingChildren,
          isParentMatching: false,
          isContextOnlyParent: true,
        });
      } else if (parentMatches && matchingChildren.length > 0) {
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

  const totalVisibleSetCount = useMemo(() => {
    let count = 0;
    for (const g of structuredSetGroups) {
      count += 1 + g.children.length;
    }
    return count;
  }, [structuredSetGroups]);

  const getEstimatedSetSubmenuHeight = useCallback(() => {
    const hasSearch = sets.length >= 5;
    const searchHeight = hasSearch ? 36 : 0;
    const padding = 14;
    const count = totalVisibleSetCount;
    let listHeight = 44;
    if (count > 0) {
      listHeight = Math.min(260, count * 34);
    }
    return searchHeight + listHeight + padding;
  }, [sets.length, totalVisibleSetCount]);

  // 1depth 메뉴 화면 경계 밖 벗어남 방지
  const adjustedX = Math.max(8, Math.min(x, window.innerWidth - 240));
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - 380));

  // 공통 2depth 서브메뉴 위치 계산 함수
  const calculateSubmenuPosition = useCallback(
    (
      triggerEl: HTMLElement | null,
      submenuEl: HTMLElement | null,
      fallbackHeight: number,
      fallbackWidth = 216
    ) => {
      const triggerRect = triggerEl?.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();

      if (!triggerRect && !menuRect) {
        return { left: adjustedX + 224, top: adjustedY };
      }

      const refRect = triggerRect ?? menuRect!;
      const baseMenuRect = menuRect ?? refRect;

      const submenuRect = submenuEl?.getBoundingClientRect();
      const submenuWidth = submenuRect && submenuRect.width > 0 ? submenuRect.width : fallbackWidth;
      const submenuHeight = submenuRect && submenuRect.height > 0 ? submenuRect.height : fallbackHeight;

      const SCREEN_PADDING = 8;
      const HORIZONTAL_GAP = 4;
      const VERTICAL_ITEM_ALIGN_OFFSET = 6;

      const spaceOnRight = window.innerWidth - baseMenuRect.right - SCREEN_PADDING;
      const spaceOnLeft = baseMenuRect.left - SCREEN_PADDING;

      let left: number;
      if (spaceOnRight >= submenuWidth + HORIZONTAL_GAP) {
        left = baseMenuRect.right + HORIZONTAL_GAP;
      } else if (spaceOnLeft >= submenuWidth + HORIZONTAL_GAP) {
        left = baseMenuRect.left - submenuWidth - HORIZONTAL_GAP;
      } else {
        left = spaceOnRight >= spaceOnLeft
          ? baseMenuRect.right + HORIZONTAL_GAP
          : baseMenuRect.left - submenuWidth - HORIZONTAL_GAP;
      }
      left = Math.max(SCREEN_PADDING, Math.min(left, window.innerWidth - submenuWidth - SCREEN_PADDING));

      const topAlignY = refRect.top - VERTICAL_ITEM_ALIGN_OFFSET;
      const bottomAlignY = refRect.bottom + VERTICAL_ITEM_ALIGN_OFFSET - submenuHeight;

      const fitsDownwards = (topAlignY + submenuHeight) <= (window.innerHeight - SCREEN_PADDING);
      const fitsUpwards = bottomAlignY >= SCREEN_PADDING;

      let top: number;
      if (fitsDownwards) {
        top = topAlignY;
      } else if (fitsUpwards) {
        top = bottomAlignY;
      } else {
        const spaceBelow = window.innerHeight - refRect.top;
        const spaceAbove = refRect.bottom;
        top = spaceBelow >= spaceAbove ? topAlignY : bottomAlignY;
      }

      top = Math.max(SCREEN_PADDING, Math.min(top, window.innerHeight - submenuHeight - SCREEN_PADDING));

      return { left: Math.round(left), top: Math.round(top) };
    },
    [adjustedX, adjustedY]
  );

  const updateSubmenuPositions = useCallback(() => {
    if (activeSubmenu === "set") {
      const pos = calculateSubmenuPosition(
        setTriggerRef.current,
        setSubmenuRef.current,
        getEstimatedSetSubmenuHeight(),
        216
      );
      setSetSubmenuPosition(pos);
    } else if (activeSubmenu === "copy") {
      const pos = calculateSubmenuPosition(
        copyTriggerRef.current,
        copySubmenuRef.current,
        88,
        192
      );
      setCopySubmenuPosition(pos);
    }
  }, [activeSubmenu, calculateSubmenuPosition, getEstimatedSetSubmenuHeight]);

  const openSubmenu = useCallback(
    (type: SubmenuType) => {
      if (submenuTimerRef.current) {
        clearTimeout(submenuTimerRef.current);
        submenuTimerRef.current = null;
      }
      if (type === "set") {
        const pos = calculateSubmenuPosition(
          setTriggerRef.current,
          setSubmenuRef.current,
          getEstimatedSetSubmenuHeight(),
          216
        );
        setSetSubmenuPosition(pos);
      } else if (type === "copy") {
        const pos = calculateSubmenuPosition(
          copyTriggerRef.current,
          copySubmenuRef.current,
          88,
          192
        );
        setCopySubmenuPosition(pos);
      }
      setActiveSubmenu(type);
    },
    [calculateSubmenuPosition, getEstimatedSetSubmenuHeight]
  );

  const closeSubmenuWithDelay = useCallback((delay = 200) => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
    }
    submenuTimerRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, delay);
  }, []);

  const closeSubmenuImmediately = useCallback(() => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
    setActiveSubmenu(null);
  }, []);

  const keepSubmenuOpen = useCallback(() => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    if (activeSubmenu) {
      updateSubmenuPositions();
    }
  }, [activeSubmenu, totalVisibleSetCount, updateSubmenuPositions]);

  useEffect(() => {
    if (!activeSubmenu) return;
    const handleResize = () => updateSubmenuPositions();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeSubmenu, updateSubmenuPositions]);

  useEffect(() => {
    return () => {
      if (submenuTimerRef.current) {
        clearTimeout(submenuTimerRef.current);
      }
    };
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedMenu = menuRef.current?.contains(target);
      const clickedSetSubmenu = setSubmenuRef.current?.contains(target);
      const clickedCopySubmenu = copySubmenuRef.current?.contains(target);
      if (!clickedMenu && !clickedSetSubmenu && !clickedCopySubmenu) {
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

  if (!primaryFont) return null;

  // --- 액션 핸들러들 ---

  // 1-1. 즐겨찾기 등록
  const handleFavoriteAdd = () => {
    if (unfavoritedFonts.length === 0) return;
    if (onBulkFavorite) {
      onBulkFavorite(unfavoritedFonts.map((f) => f.id), true);
    } else {
      unfavoritedFonts.forEach((f) => onToggleFavorite(f.id));
    }
    onClearSelection?.();
    onClose();
  };

  // 1-2. 즐겨찾기 제거 (확인창 없이 즉시 반영)
  const handleFavoriteRemove = () => {
    if (favoritedFonts.length === 0) return;
    if (onBulkFavorite) {
      onBulkFavorite(favoritedFonts.map((f) => f.id), false);
    } else {
      favoritedFonts.forEach((f) => onToggleFavorite(f.id));
    }
    onClearSelection?.();
    onClose();
  };

  // 1-3. 서재 세트 등록
  const getSetMembershipState = (setId: number): "all" | "some" | "none" => {
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
  };

  const handleSetAction = (setId: number) => {
    const state = getSetMembershipState(setId);
    if (state === "all") {
      onActionFeedback?.(t("context_menu.already_in_set"));
      onClose();
      return;
    }

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

  // 1-4. 서재에서 제거 (확인창 필수)
  const handleRemoveFromCurrentSet = () => {
    if (!isInCurrentSet || currentSetId === null || currentSetId === undefined) return;
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

  // 2-1. 임시활성화 등록
  const handleActivateAdd = () => {
    if (inactiveActivatableFonts.length === 0) return;
    if (onBulkActivate) {
      onBulkActivate(inactiveActivatableFonts.map((f) => f.id), true);
    } else {
      inactiveActivatableFonts.forEach((f) => onToggleActivate?.(f));
    }
    onClearSelection?.();
    onClose();
  };

  // 2-2. 임시활성화 해제 (확인창 필수)
  const handleActivateRemove = () => {
    if (activeActivatableFonts.length === 0) return;
    if (onRequestDeactivate) {
      onRequestDeactivate(activeActivatableFonts);
      onClose();
      return;
    }
    // 폴백
    if (onBulkActivate) {
      onBulkActivate(activeActivatableFonts.map((f) => f.id), false);
    } else {
      activeActivatableFonts.forEach((f) => onToggleActivate?.(f));
    }
    onClearSelection?.();
    onClose();
  };

  // 2-3. 시스템 설치
  const handleInstallAll = async () => {
    if (installableFonts.length === 0) {
      onActionFeedback?.(t("toast.no_installable_fonts"));
      onClose();
      return;
    }

    try {
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

  // 2-4. 시스템 제거 (확인창 필수)
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

  // 4-1. 복사 핸들러
  const handleCopyName = () => {
    const names = fonts.map((f) => getFontFamilyName(f, i18n.language)).join("\n");
    navigator.clipboard.writeText(names);
    onActionFeedback?.(
      isMulti
        ? t("context_menu.copy_names", { count: fonts.length })
        : t("toast.copy_name")
    );
    onClose();
  };

  const handleCopyPath = () => {
    const paths = fonts.map((f) => f.file_path).join("\n");
    navigator.clipboard.writeText(paths);
    onActionFeedback?.(
      isMulti
        ? t("context_menu.copy_paths", { count: fonts.length })
        : t("toast.copy_path")
    );
    onClose();
  };

  // 4-2. 파일 탐색기 열기
  const handleShowInFolder = () => {
    if (primaryFont) {
      if (!isFontUsable(primaryFont)) {
        onActionFeedback?.(t("toast.folder_open_failed"));
        onClose();
        return;
      }
      fontService.showInFolder(primaryFont.file_path).catch((err) => {
        console.error("탐색기 열기 실패:", err);
        onActionFeedback?.(t("toast.folder_open_failed"));
      });
    }
    onClose();
  };


  // 각 그룹에 렌더링될 항목이 존재하는지 여부
  const hasGroup1Items =
    unfavoritedFonts.length > 0 ||
    favoritedFonts.length > 0 ||
    usableFonts.length > 0 ||
    isInCurrentSet;

  const hasGroup2Items =
    inactiveActivatableFonts.length > 0 ||
    activeActivatableFonts.length > 0 ||
    installableFonts.length > 0 ||
    uninstallableFonts.length > 0 ||
    systemFonts.length > 0;

  const hasGroup3Items = Boolean(onOpenDiff && fonts.length > 0);

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 w-56 rounded-xl bg-theme-surface border border-theme-border shadow-xl shadow-black/20 p-1.5 text-xs text-theme-text select-none"
        style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* [Header] 선택 정보 */}
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

        {/* ------------------------------------------------------------- */}
        {/* [Group 1] 즐겨찾기 & 서재 관리 */}
        {/* ------------------------------------------------------------- */}

        {/* 1-1. 즐겨찾기 등록 (미등록 폰트가 포함되어 있을 때) */}
        {unfavoritedFonts.length > 0 && (
          <button
            type="button"
            onClick={handleFavoriteAdd}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
            <span>
              {!isMulti || favoritedFonts.length === 0
                ? t("context_menu.favorite_add")
                : t("context_menu.bulk_favorite_add", {
                  count: unfavoritedFonts.length,
                })}
            </span>
          </button>
        )}

        {/* 1-2. 즐겨찾기 제거 (등록된 폰트가 포함되어 있을 때 - 항상 빨간색, 확인창 없음) */}
        {favoritedFonts.length > 0 && (
          <button
            type="button"
            onClick={handleFavoriteRemove}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-medium transition-colors cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
            <span>
              {!isMulti || unfavoritedFonts.length === 0
                ? t("context_menu.favorite_remove")
                : t("context_menu.bulk_favorite_remove", {
                  count: favoritedFonts.length,
                })}
            </span>
          </button>
        )}

        {/* 1-3. 서재 세트 등록 > 2depth */}
        {usableFonts.length > 0 && (
          <div
            ref={setTriggerRef}
            onMouseEnter={() => openSubmenu("set")}
            onMouseLeave={() => closeSubmenuWithDelay(200)}
            className="relative"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (activeSubmenu === "set") {
                  closeSubmenuImmediately();
                } else {
                  openSubmenu("set");
                }
              }}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSubmenu === "set"
                  ? "bg-theme-hover text-theme-text"
                  : "hover:bg-theme-hover text-theme-text"
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

        {/* 1-4. 서재에서 제거 (서재 세트 화면일 때만 노출 - 항상 빨간색, 확인창 필수) */}
        {isInCurrentSet && (
          <button
            type="button"
            onClick={handleRemoveFromCurrentSet}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-medium transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>
              {isMulti
                ? t("context_menu.bulk_remove_from_set", {
                  count: fonts.length,
                })
                : t("context_menu.remove_from_set")}
            </span>
          </button>
        )}

        {/* 구분선: Group 1 -> Group 2 */}
        {hasGroup1Items && hasGroup2Items && (
          <div className="my-1 border-t border-theme-border-subtle" />
        )}

        {/* ------------------------------------------------------------- */}
        {/* [Group 2] 임시활성화 & 시스템 제어 */}
        {/* ------------------------------------------------------------- */}

        {/* 2-1. 임시활성화 등록 (미활성화 외부 폰트가 있을 때) */}
        {inactiveActivatableFonts.length > 0 && (
          <button
            type="button"
            onClick={handleActivateAdd}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span>
              {!isMulti || activeActivatableFonts.length === 0
                ? t("context_menu.activate")
                : t("context_menu.bulk_activate", {
                  count: inactiveActivatableFonts.length,
                })}
            </span>
          </button>
        )}

        {/* 2-2. 임시활성화 해제 (활성화된 폰트가 있을 때 - 항상 빨간색, 확인창 필수) */}
        {activeActivatableFonts.length > 0 && (
          <button
            type="button"
            onClick={handleActivateRemove}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-medium transition-colors cursor-pointer"
          >
            <ZapOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>
              {!isMulti || inactiveActivatableFonts.length === 0
                ? t("context_menu.deactivate")
                : t("context_menu.bulk_deactivate", {
                  count: activeActivatableFonts.length,
                })}
            </span>
          </button>
        )}

        {/* 2-3. 시스템 설치 (미설치 외부 폰트가 있을 때) */}
        {installableFonts.length > 0 && (
          <button
            type="button"
            onClick={handleInstallAll}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
            <span>
              {isMulti
                ? t("context_menu.bulk_install", {
                  count: installableFonts.length,
                })
                : t("context_menu.install")}
            </span>
          </button>
        )}

        {/* 2-4. 시스템 제거 (사용자 설치 폰트가 있을 때 - 항상 빨간색, 확인창 필수) */}
        {uninstallableFonts.length > 0 && (
          <button
            type="button"
            onClick={handleUninstallAll}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-medium transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>
              {isMulti
                ? t("context_menu.bulk_uninstall", {
                  count: uninstallableFonts.length,
                })
                : t("context_menu.uninstall")}
            </span>
          </button>
        )}

        {/* 2-5. 시스템 보호 안내 (운영체제 기본 내장 폰트가 포함되어 있을 때) */}
        {systemFonts.length > 0 && (
          <div
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-theme-text-muted select-none cursor-default opacity-75"
            title={t("context_menu.system_protected_title")}
            onMouseEnter={closeSubmenuImmediately}
          >
            <Shield className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
            <span className="truncate">
              {isMulti
                ? t("context_menu.system_protected_count", {
                  count: systemFonts.length,
                })
                : t("context_menu.system_protected_label")}
            </span>
          </div>
        )}

        {/* 구분선: Group 2 -> Group 3 */}
        {(hasGroup1Items || hasGroup2Items) && hasGroup3Items && (
          <div className="my-1 border-t border-theme-border-subtle" />
        )}

        {/* ------------------------------------------------------------- */}
        {/* [Group 3] 폰트 비교 */}
        {/* ------------------------------------------------------------- */}
        {onOpenDiff && fonts.length > 0 && (
          <button
            type="button"
            onClick={handleDiffClick}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
          >
            <Split className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span>{diffLabel}</span>
          </button>
        )}

        {/* 구분선: Group 3 -> Group 4 */}
        <div className="my-1 border-t border-theme-border-subtle" />

        {/* ------------------------------------------------------------- */}
        {/* [Group 4] 복사 > 2depth & 파일 탐색기 보기 */}
        {/* ------------------------------------------------------------- */}

        {/* 4-1. 복사 > 2depth 서브메뉴 트리거 */}
        <div
          ref={copyTriggerRef}
          onMouseEnter={() => openSubmenu("copy")}
          onMouseLeave={() => closeSubmenuWithDelay(200)}
          className="relative"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeSubmenu === "copy") {
                closeSubmenuImmediately();
              } else {
                openSubmenu("copy");
              }
            }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSubmenu === "copy"
                ? "bg-theme-hover text-theme-text"
                : "hover:bg-theme-hover text-theme-text"
              }`}
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <Copy className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
              <span className="truncate">{t("context_menu.copy")}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
          </button>
        </div>

        {/* 4-2. 파일 탐색기(파인더)에서 보기 */}
        {isFontUsable(primaryFont) && (
          <button
            type="button"
            onClick={handleShowInFolder}
            onMouseEnter={closeSubmenuImmediately}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
            <span>
              {IS_MAC
                ? t("context_menu.show_in_folder_mac")
                : t("context_menu.show_in_folder")}
            </span>
          </button>
        )}

        {/* ------------------------------------------------------------- */}
        {/* [Group 5] 폰트 정보 */}
        {/* ------------------------------------------------------------- */}
        {fonts.length > 0 && (
          <>
            <div className="my-1 border-t border-theme-border-subtle" />
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFontInfo?.(fonts);
              }}
              onMouseEnter={closeSubmenuImmediately}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-theme-accent shrink-0" />
              <span>
                {isMulti
                  ? t("context_menu.view_font_info_n", {
                    count: fonts.length,
                  })
                  : t("context_menu.view_font_info")}
              </span>
            </button>
          </>
        )}
      </div>

      {/* ============================================================= */}
      {/* 2depth 서브메뉴: 서재 세트 등록 목록 */}
      {/* ============================================================= */}
      {activeSubmenu === "set" &&
        setSubmenuPosition &&
        createPortal(
          <div
            ref={setSubmenuRef}
            onMouseEnter={keepSubmenuOpen}
            onMouseLeave={() => closeSubmenuWithDelay(200)}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 w-52 rounded-xl bg-theme-surface border border-theme-border shadow-2xl shadow-black/25 p-1.5 text-xs text-theme-text select-none animate-in fade-in duration-100"
            style={{
              left: `${setSubmenuPosition.left}px`,
              top: `${setSubmenuPosition.top}px`,
            }}
          >
            {/* 세트 검색창 */}
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

            {/* 서재 세트 계층 목록 */}
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
                              ? t("context_menu.already_in_set")
                              : t("context_menu.add_to_set")
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

                      {/* 2depth 자식 노드 목록 */}
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
                                    ? t("context_menu.already_in_set")
                                    : t("context_menu.add_to_set")
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

      {/* ============================================================= */}
      {/* 2depth 서브메뉴: 복사 (글꼴 이름 복사, 파일 경로 복사) */}
      {/* ============================================================= */}
      {activeSubmenu === "copy" &&
        copySubmenuPosition &&
        createPortal(
          <div
            ref={copySubmenuRef}
            onMouseEnter={keepSubmenuOpen}
            onMouseLeave={() => closeSubmenuWithDelay(200)}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 w-48 rounded-xl bg-theme-surface border border-theme-border shadow-2xl shadow-black/25 p-1.5 text-xs text-theme-text select-none animate-in fade-in duration-100"
            style={{
              left: `${copySubmenuPosition.left}px`,
              top: `${copySubmenuPosition.top}px`,
            }}
          >
            {/* 글꼴 이름 복사 */}
            <button
              type="button"
              onClick={handleCopyName}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
              <span className="truncate">
                {isMulti
                  ? t("context_menu.copy_names", {
                    count: fonts.length,
                  })
                  : t("context_menu.copy_name")}
              </span>
            </button>

            {/* 파일 경로 복사 */}
            <button
              type="button"
              onClick={handleCopyPath}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-theme-hover text-theme-text transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
              <span className="truncate">
                {isMulti
                  ? t("context_menu.copy_paths", {
                    count: fonts.length,
                  })
                  : t("context_menu.copy_path")}
              </span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
