import { useCallback } from "react";
import { fontService } from "../../services/fontService";

export interface UseFontFavoriteActionsProps {
  favoriteIds: Set<number>;
  setFavoriteIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  handleClearSelection: () => void;
}

export function useFontFavoriteActions({
  favoriteIds,
  setFavoriteIds,
  handleClearSelection,
}: UseFontFavoriteActionsProps) {
  // 즐겨찾기 토글 (단일 정수 ID 기반 직관적 토글)
  const handleToggleFavorite = useCallback(
    async (fontId: number) => {
      try {
        const isCurrentFav = favoriteIds.has(fontId);
        await fontService.toggleFavorite(fontId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isCurrentFav) {
            next.delete(fontId);
          } else {
            next.add(fontId);
          }
          return next;
        });
      } catch (err) {
        console.error("즐겨찾기 토글 실패:", err);
      }
    },
    [favoriteIds, setFavoriteIds]
  );

  // 일괄 즐겨찾기 변경
  const handleBulkFavorite = useCallback(
    async (fontIds: number[], add: boolean) => {
      try {
        const toProcess = fontIds.filter((id) => (add ? !favoriteIds.has(id) : favoriteIds.has(id)));
        if (toProcess.length > 0) {
          await fontService.setFavoritesBulk(toProcess, add);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (add) {
              toProcess.forEach((id) => next.add(id));
            } else {
              toProcess.forEach((id) => next.delete(id));
            }
            return next;
          });
        }
        handleClearSelection();
      } catch (err) {
        console.error("일괄 즐겨찾기 변경 실패:", err);
      }
    },
    [favoriteIds, handleClearSelection, setFavoriteIds]
  );

  return {
    handleToggleFavorite,
    handleBulkFavorite,
  };
}
