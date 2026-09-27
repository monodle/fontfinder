import { useEffect, RefObject } from "react";

interface UseSearchShortcutProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  isModalOpen?: boolean;
  hasSelection?: boolean;
  onClearSelection?: () => void;
}

/**
 * Cmd+F / Ctrl+F (및 슬래시 /) 단축키 입력 시 현재 탭의 검색창으로 즉시 포커스하는 훅
 * - 모달 열림 상태 제외
 * - 비포커스 상태에서의 자동 타이핑 가로채기는 완전히 배제하여 OS 네이티브 한글 IME 조합 보장
 */
export function useTypeToSearch({
  searchInputRef,
  isModalOpen = false,
  hasSelection = false,
  onClearSelection,
}: UseSearchShortcutProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. 모달, 온보딩, 컨텍스트 메뉴 등이 열려 있을 때는 단축키 동작 차단
      if (isModalOpen) return;

      // 2. Cmd+F / Ctrl+F (표준 검색 단축키)
      const isFindShortcut =
        (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "f";

      // 3. / (슬래시) 단축키 (입력 필드 외부에서 누를 때만 동작)
      const activeEl = document.activeElement;
      const tagName = (activeEl?.tagName || "").toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        activeEl?.getAttribute("contenteditable") === "true";

      const isSlashShortcut =
        !e.metaKey && !e.ctrlKey && !e.altKey && e.key === "/" && !isEditable;

      if (!isFindShortcut && !isSlashShortcut) return;

      e.preventDefault();

      // 다중 선택 모드가 켜져 있다면 먼저 선택 해제
      if (hasSelection && onClearSelection) {
        onClearSelection();
      }

      requestAnimationFrame(() => {
        const input = searchInputRef.current;
        if (input) {
          input.focus();
          input.select();
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchInputRef, isModalOpen, hasSelection, onClearSelection]);
}
