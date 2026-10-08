import { useState, useCallback, useEffect } from "react";
import { FontMetadata } from "../types/font";
import { STORAGE_KEYS } from "../config/storageKeys";
import { storageBooleanSchema } from "../schemas";

interface UseAppHotkeysProps {
  currentSetId: number | null;
  selectedFontIds: Set<number>;
  filteredFonts: FontMetadata[];
  onRequestRemoveFromSet: (setId: number, fonts: FontMetadata[]) => void;
}

export function useAppHotkeys({
  currentSetId,
  selectedFontIds,
  filteredFonts,
  onRequestRemoveFromSet,
}: UseAppHotkeysProps) {
  // 사이드바 접기/펼치기 상태
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return storageBooleanSchema.parse(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED));
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
      } catch (err) {
        console.error("사이드바 상태 저장 실패:", err);
      }
      return next;
    });
  }, []);

  // 전역 브라우저 기본 우클릭 차단
  useEffect(() => {
    const handleContextMenuGlobal = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", handleContextMenuGlobal);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenuGlobal);
    };
  }, []);

  // 단축키 이벤트 리스너 (Ctrl/Cmd+B: 사이드바 토글, Delete/Backspace: 서재 폰트 제거)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleSidebar();
        return;
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        currentSetId !== null &&
        selectedFontIds.size > 0
      ) {
        e.preventDefault();
        const selectedFonts = filteredFonts.filter((f) => selectedFontIds.has(f.id));
        if (selectedFonts.length > 0) {
          onRequestRemoveFromSet(currentSetId, selectedFonts);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentSetId, selectedFontIds, filteredFonts, onRequestRemoveFromSet, handleToggleSidebar]);

  return {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    handleToggleSidebar,
  };
}
