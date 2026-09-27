import { useState, useCallback, useEffect } from "react";
import { FontMetadata } from "../types/font";

interface UseFontSelectionProps {
  filteredFonts: FontMetadata[];
  activeCategory: string;
}

export function useFontSelection({ filteredFonts, activeCategory }: UseFontSelectionProps) {
  const [selectedFont, setSelectedFont] = useState<FontMetadata | null>(null);
  const [selectedFontIds, setSelectedFontIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // 선택 전체 해제
  const handleClearSelection = useCallback(() => {
    setSelectedFontIds(new Set());
    setLastSelectedId(null);
    setSelectedFont(null);
  }, []);

  // 전체 선택 (언플러그드 폰트 제외)
  const handleSelectAll = useCallback(() => {
    if (filteredFonts.length === 0) return;
    const allIds = new Set(
      filteredFonts
        .filter((f) => !f.isMissing && f.install_status !== "unplugged")
        .map((f) => f.id)
    );
    setSelectedFontIds(allIds);
  }, [filteredFonts]);

  // 개별 폰트 클릭 / Cmd(Ctrl)+클릭 / Shift+클릭 선택 핸들러
  const handleSelectFont = useCallback(
    (font: FontMetadata, e: React.MouseEvent) => {
      // 언플러그드/삭제됨(연결 끊김) 폰트는 좌클릭 선택 동작 완전 차단
      if (
        font.isMissing ||
        font.install_status === "unplugged" ||
        font.install_status === "deleted"
      ) {
        return;
      }

      // 1. Cmd(Mac) / Ctrl(Win) + 클릭: 개별 토글 다중 선택
      if (e.metaKey || e.ctrlKey) {
        setSelectedFontIds((prev) => {
          const next = new Set(prev);
          if (next.has(font.id)) {
            next.delete(font.id);
          } else {
            next.add(font.id);
          }
          return next;
        });
        setSelectedFont(font);
        setLastSelectedId(font.id);
        return;
      }

      // 2. Shift + 클릭: 마지막 선택 항목이 유효하고 선택된 항목이 있을 때만 연속 범위 선택 (비활성화 폰트 제외)
      if (e.shiftKey && lastSelectedId && selectedFontIds.size > 0) {
        const lastIndex = filteredFonts.findIndex((f) => f.id === lastSelectedId);
        const currentIndex = filteredFonts.findIndex((f) => f.id === font.id);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = filteredFonts
            .slice(start, end + 1)
            .filter(
              (f) =>
                !f.isMissing &&
                f.install_status !== "unplugged" &&
                f.install_status !== "deleted"
            )
            .map((f) => f.id);

          setSelectedFontIds((prev) => {
            const next = new Set(prev);
            rangeIds.forEach((id) => next.add(id));
            return next;
          });
        } else {
          setSelectedFontIds(new Set([font.id]));
          setLastSelectedId(font.id);
        }
        setSelectedFont(font);
        return;
      }

      // 3. 일반 클릭:
      // 이미 단일 선택된 상태에서 해당 폰트를 다시 클릭하면 선택 해제
      if (selectedFontIds.has(font.id) && selectedFontIds.size === 1) {
        setSelectedFontIds(new Set());
        setLastSelectedId(null);
        setSelectedFont(null);
        return;
      }

      // 선택되지 않았거나 다중 선택 상태인 경우 해당 폰트만 단일 선택
      setSelectedFontIds(new Set([font.id]));
      setLastSelectedId(font.id);
      setSelectedFont(font);
    },
    [filteredFonts, lastSelectedId, selectedFontIds]
  );

  // 마우스 드래그 영역 선택 콜백
  const handleSelectionChange = useCallback(
    (newIds: Set<string>) => {
      setSelectedFontIds(newIds);
      if (newIds.size === 0) {
        setLastSelectedId(null);
        return;
      }
      const firstId = Array.from(newIds)[0];
      const font = filteredFonts.find((f) => f.id === firstId);
      if (font) setSelectedFont(font);
      setLastSelectedId(firstId);
    },
    [filteredFonts]
  );

  // 카테고리 변경 시 선택 상태 초기화
  useEffect(() => {
    handleClearSelection();
  }, [activeCategory, handleClearSelection]);

  // 목록 변경 시 선택 동기화 (선택된 폰트가 현재 목록에 없으면 첫 번째 선택 또는 해제)
  useEffect(() => {
    if (filteredFonts.length === 0) {
      setSelectedFont(null);
      return;
    }
    if (selectedFont && !filteredFonts.some((f) => f.id === selectedFont.id)) {
      setSelectedFont(filteredFonts[0]);
    }
  }, [filteredFonts, selectedFont]);

  // 전역 단축키 (Cmd+A 전체선택, Esc 선택해제)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleSelectAll();
      } else if (e.key === "Escape") {
        handleClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSelectAll, handleClearSelection]);

  return {
    selectedFont,
    setSelectedFont,
    selectedFontIds,
    setSelectedFontIds,
    lastSelectedId,
    setLastSelectedId,
    handleSelectFont,
    handleSelectionChange,
    handleClearSelection,
    handleSelectAll,
  };
}
